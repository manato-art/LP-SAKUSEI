/**
 * 配信ページ（サーバー側・実パス `/lp/:uid`）＝**配信URLの実体**（FAQ「配信URLを取得する」）。
 *
 * 以前はクライアント側ハッシュルート `/#/ab/:uid`（`src/app/pages/delivery.ts`、廃止済み）が
 * この役割を担っていたが、実物と同じ「実パスを直接開ける」配信URLにするためサーバー側SSRへ
 * 移した（JavaScript無しでも表示できる）。旧URLは `main.ts` がここへリダイレクトする。
 * ロジック（pickDeliveryVersion・LPベースCSS・記事設定の反映・動画自動再生）は旧クライアント版
 * から移植したもの。DOM非依存の関数はそのまま `src/app/*` から import して二重管理を避ける
 * （`master-style.ts` / `lp-base-css.ts` / `lp-video.ts` はいずれも純粋関数・定数でDOMに依存しない。
 * cross-boundary import は `panel-link-replace.ts` が `src/shared/link-html.ts` を読む既存の前例に倣う）。
 */
import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import type { Request as ExpressRequest, Response } from 'express'
import { getState, setState } from '../store/store.ts'
import { getMasterStyleSheet } from '../store/master-style-sheet.ts'
import { getHtmlSetting } from '../store/html-tags.ts'
import { bulkTagsForFolder } from '../store/bulk-tags.ts'
import { bumpMetric, recordConversion } from '../store/actions.ts'
import { shouldExclude } from '../store/exclusions.ts'
import type { RequestLogEntry } from '../store/types.ts'
import { broadcastConversion, type ConversionPush } from '../ws/cable.ts'
import { toDateKey } from '../store/metrics.ts'
import type { AbTest, Article, State } from '../store/types.ts'
import { LP_BASE_CSS } from '../../src/app/lp-base-css.ts'
import { WIDGET_RESET_CSS, neutralizeWidgetStyles } from '../../src/shared/sb-preview-css.ts'
import { LP_FONTS_URL, externalWidgetLibs } from '../../src/shared/lp-page-assets.ts'
import { buildLpLinkParamsScript } from './lp-link-params-script.ts'
import { splitHeaderImage } from '../../src/shared/header-image.ts'
import { masterStyleIframeCss } from '../../src/app/master-style.ts'
import { withAutoplayVideos } from '../../src/app/lp-video.ts'
import { buildAnimCss, buildAnimRuntimeScript } from '../../src/app/anim/anim-presets.ts'
import { buildCvScriptBody, buildTrackingScriptBody } from '../../src/shared/tracking-tag.ts'
import { buildVisitorContext, pickDeliveryVersion } from './delivery-targeting.ts'
import { buildFollowPopupSnippet, buildPopupSnippet } from './delivery-popup-html.ts'
import {
  escapeHtml,
  renderExcludePage,
  renderNotice,
  renderPreviewNotice,
} from './delivery-notice.ts'

export const deliveryRouter: Router = Router()

/** 除外リンクを開いたブラウザに残す目印のCookie名 */
const EXCLUDE_COOKIE = 'sb_report_exclude'

/** 既定の配信Version幅（実物のデフォルト） */
const DELIVERY_WIDTH = 620

/**
 * 配信ページ末尾に挿入するスクリプト。
 * data-link-url / data-tracking-urls 属性を持つ `<img>` を
 * クリック可能な `<a>` でラップし、計測URLへのビーコンも飛ばす。
 */
const IMAGE_LINK_SCRIPT = `<script>(function(){
  document.querySelectorAll('img[data-link-url]').forEach(function(img){
    var url=img.getAttribute('data-link-url');
    if(!url)return;
    var target=img.getAttribute('data-link-target')||'_blank';
    var trackRaw=img.getAttribute('data-tracking-urls');
    var tracks=[];
    try{if(trackRaw)tracks=JSON.parse(trackRaw)}catch(e){}
    var a=document.createElement('a');
    a.href=url;
    a.target=target;
    if(target==='_blank')a.rel='noopener noreferrer';
    a.style.display='inline-block';
    img.parentNode.insertBefore(a,img);
    a.appendChild(img);
    a.addEventListener('click',function(){
      tracks.forEach(function(t){
        try{navigator.sendBeacon(t)}catch(e){new Image().src=t}
      });
    });
  });
  document.querySelectorAll('img[data-tracking-urls]:not([data-link-url])').forEach(function(img){
    var trackRaw=img.getAttribute('data-tracking-urls');
    var tracks=[];
    try{if(trackRaw)tracks=JSON.parse(trackRaw)}catch(e){}
    if(!tracks.length)return;
    img.style.cursor='pointer';
    img.addEventListener('click',function(){
      tracks.forEach(function(t){
        try{navigator.sendBeacon(t)}catch(e){new Image().src=t}
      });
    });
  });
})()</script>`

/**
 * このクローン自身のレポート計測スクリプト（配信URL `/lp/:uid` 専用）。
 * - ページ表示ごとに PV を1つ記録する（`POST /lp/:uid/__track` へ event:'pv'）。
 * - 「計測機能付きリンク（＝このシステムで計測する）」のクリックだけを click として記録する。
 *   その目印は実物と同じ **`sb_tracking=true`**（tel: だけは `data-sb-tracking="true"` 属性）。
 *   これは実 Quill Link blot 由来の正規シグナルで（src/shared/link-html.ts）、リンク置換ツールの
 *   「計測機能付きリンクに変更」・テキストリンクの「レポート計測する」・画像リンクの
 *   「このシステムで計測する」が全て同じこの目印を出す。目印の無いリンクは計測しない。
 * 記録先は `state.metrics`（ab_test スコープ＋version スコープ）で、レポートの
 * PV / クリック / CTR 等がここから集計される。
 *
 * ★プレビュー（`/preview/:versionUid`）にはこのスクリプトを入れない＝計測しない。
 * keepalive でリンク遷移時のクリックも取りこぼさない。
 */
/**
 * リクエスト記録の間引き。
 *
 * 件数だけで切ると、アクセスの多いLPでは数日で古いぶんが消え、
 * レポート除外画面の「1年」表示が実際より少なく出る（画面が嘘をつく）。
 * **保持は日数で決め**、件数の上限はメモリを守るための最後の砦として残す。
 */
/** 画面の期間ボタンが最長1年なので、少し余裕を持たせた日数だけ持つ */
const REQUEST_LOG_DAYS = 400
/**
 * 件数の上限。state.json を丸ごと書き直す作りなので、
 * 大きくしすぎるとデプロイのたびに重いファイルを読み書きすることになる。
 * 1件およそ150バイトなので、5万件で 7〜8MB 程度に収まる。
 */
const REQUEST_LOG_MAX = 50_000

export function pruneRequestLogs(
  logs: readonly RequestLogEntry[],
  today: string,
): RequestLogEntry[] {
  const limit = new Date(`${today}T00:00:00`)
  limit.setDate(limit.getDate() - REQUEST_LOG_DAYS)
  const oldest = toDateKey(limit)
  const kept = logs.filter((log) => log.date >= oldest)
  return kept.length > REQUEST_LOG_MAX ? kept.slice(-REQUEST_LOG_MAX) : kept
}

/** ブラウザに残した除外の目印（Cookie）を読む */
function excludeTokenFromCookie(cookie: string | undefined): string {
  if (cookie === undefined || cookie === '') return ''
  for (const part of cookie.split(';')) {
    const [k, v] = part.split('=')
    if (k?.trim() === EXCLUDE_COOKIE) return decodeURIComponent(v?.trim() ?? '')
  }
  return ''
}

/** 本体と同じく、_sb_global は同じブラウザで同じIDを使い続ける（読めない値なら新しく作る） */
function knownGlobalId(cookie: string | undefined): string | null {
  for (const part of (cookie ?? '').split(';')) {
    const [key, raw] = part.split('=')
    const value = raw?.trim() ?? ''
    if (key?.trim() === '_sb_global' && /^[A-Za-z0-9._-]{1,100}$/.test(value)) return value
  }
  return null
}

/** 送信元IP。Railway等のプロキシ経由では X-Forwarded-For の先頭が実体。 */
function clientIp(req: ExpressRequest): string {
  const forwarded = req.get('x-forwarded-for')
  if (forwarded !== undefined && forwarded !== '') {
    const first = forwarded.split(',')[0]?.trim()
    if (first !== undefined && first !== '') return first
  }
  return req.ip ?? ''
}

/**
 * リファラは**オリジンまで**に丸める。
 * 実物の一覧も `https://<SNSのドメイン>/` のようにサイト単位で並んでいる。
 * パス以降は個人が特定され得るので残さない。
 */
function refererOrigin(raw: string | undefined): string {
  if (raw === undefined || raw === '') return ''
  try {
    const u = new URL(raw)
    return `${u.origin}/`
  } catch {
    // `android-app://…` のような非HTTPのリファラはそのまま（実物にも出ている）
    return raw.split('?')[0] ?? ''
  }
}

/** 計測タグが知らせたURL（無ければリファラ）のクエリを `k=v` の配列にする */
function queryPairsOf(reported: unknown, req: ExpressRequest): string[] {
  const candidates = [
    typeof reported === 'string' ? reported : '',
    req.get('referer') ?? '',
  ]
  for (const candidate of candidates) {
    if (candidate === '') continue
    try {
      const u = new URL(candidate)
      const pairs = [...u.searchParams.entries()].map(([k, v]) => `${k}=${v}`)
      if (pairs.length > 0) return pairs
    } catch {
      /* URLでなければ次の候補へ */
    }
  }
  return []
}

/**
 * 計測タグが知らせてきたページURLを、保存してよい形に絞る。
 * - http / https 以外は捨てる
 * - クエリ・ハッシュは落とす（広告パラメータや個人情報を保存しない）
 * - 自分自身のホスト（＝自前配信）は「外部LP」ではないので捨てる
 */
function externalUrlFrom(value: unknown, selfHost: string): string | null {
  if (typeof value !== 'string' || value === '') return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (url.host === selfHost) return null
  return `${url.origin}${url.pathname}`
}

function buildTrackingScript(uid: string, versionUid: string): string {
  // 中身は外部タグ（`/t/:uid.js`）と**同じ実装**を使う。以前はここに独自のコピーがあり、
  // 片方だけ直して「直したのに直らない」を招いていた（実際に踏んだ）。単一の出所にする。
  const endpoint = `/lp/${encodeURIComponent(uid)}/__track`
  return `<script>${buildTrackingScriptBody(endpoint, versionUid)}</script>`
}













/**
 * 配信するVersionを1つ選ぶ。6条件（デバイス/OS/キャリア/流入元/時間/日付）を満たすVersionから
 * 配信割合で重み付け抽選する。満たすVersionが無ければ段階的にフォールバック
 * （割合条件を外す→デバイス条件だけ→生存Version全体）して「何も出ない」を避ける。
 */

/**
 * AFFILICODE連携: 本文中の外部リンク(http/https)へ計測用パラメーターを付与する。
 * SB公式FAQ準拠: squadbeyond_uid / sb_tracking=true / sb_article_uid。
 * 既にクエリがあれば & で連結する。アンカー(#)やパラメーター重複は素朴に扱う。
 */
function appendAffilicodeParams(html: string, articleUid: string, visitorId: string): string {
  const params = `squadbeyond_uid=${encodeURIComponent(visitorId)}&sb_tracking=true&sb_article_uid=${encodeURIComponent(articleUid)}`
  return html.replace(/href="(https?:\/\/[^"]*)"/g, (_m, url: string) => {
    if (url.includes('sb_tracking=true')) return `href="${url}"`
    const [base, hash = ''] = url.split('#')
    const sep = (base ?? '').includes('?') ? '&' : '?'
    return `href="${base}${sep}${params}${hash ? `#${hash}` : ''}"`
  })
}




function findAbTest(state: State, uid: string): AbTest | undefined {
  return state.abTests.find((t) => t.uid === uid)
}

function firstArticle(state: State, abTest: AbTest): Article | undefined {
  return state.articles.filter((a) => a.ab_test_id === abTest.id)[0]
}

deliveryRouter.get('/lp/:uid', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return renderNotice(res, req.params.uid)

  const article = firstArticle(state, abTest)
  if (article === undefined) return renderNotice(res, req.params.uid)

  const versions = state.versions.filter((v) => v.article_id === article.id)
  const ctx = buildVisitorContext(req)
  const device = ctx.device
  const version = pickDeliveryVersion(versions, ctx)
  if (version === null) {
    res
      .status(404)
      .type('html')
      .send(
        `<!doctype html><html lang="ja"><head><meta charset="utf-8">` +
          `<title>配信できるVersionがありません</title></head>` +
          `<body style="font-family:'Hiragino Sans',sans-serif;padding:40px">配信できるVersionがありません</body></html>`,
      )
    return
  }

  // 記事設定（Version設定）をLPへ反映する
  const styleCss = masterStyleIframeCss(getMasterStyleSheet(state, article.uid))
  // タグ設定（noindex・head/bodyへの差し込みタグ）＝ 個別タグ(Article) ＋ 一括タグ(範囲一致)
  const htmlSetting = getHtmlSetting(state, article.uid)
  const bulkTags = bulkTagsForFolder(state, abTest.team_id, abTest.folder_id)
  const headTags =
    htmlSetting.html_tags
      .filter((t) => t.document_property === 'head')
      .map((t) => t.body)
      .join('') + bulkTags.map((b) => b.head_js).join('')
  const bodyTags =
    htmlSetting.html_tags
      .filter((t) => t.document_property === 'body')
      .map((t) => t.body)
      .join('') + bulkTags.map((b) => b.body_js).join('')
  // noindex は 個別タグ or いずれかの一括タグが指定していれば含める
  const noindexOn = htmlSetting.noindex || bulkTags.some((b) => b.noindex)
  const robotsMeta = noindexOn ? '<meta name="robots" content="noindex,nofollow">' : ''

  // 計測ツール・ASP＝AFFILICODE のとき、SB公式FAQ準拠の連携用パラメーターを本文リンクへ付与する。
  // 付与するパラメーター: squadbeyond_uid / sb_tracking=true / sb_article_uid
  const affilicodeOn = bulkTags.some((b) => b.asp === 'AFFILICODE')
  // 訪問者の目印（本体と同じく、LPを見るたびに新しいID＝Cookie _sb_tu）。リンクの squadbeyond_uid にも使う
  const visitorId = randomUUID()
  // ヘッダー画像（本文の先頭の `<!--header-image:…-->`）は、プレビューと同じく本文の上の画像にする
  const { headerHtml, body: versionBody } = splitHeaderImage(version.html)
  const versionHtml = affilicodeOn ? appendAffilicodeParams(versionBody, article.uid, visitorId) : versionBody
  // Widget に紛れ込んだ SquadBeyond のプレビュー用CSSが、ページの背景・余白・高さを上書きしないようにする。
  // 保存データは書き換えず、ここで取り除く。Widget の見た目に要る指定は Widget の中だけに効かせて置く。
  const lp = neutralizeWidgetStyles(versionHtml)

  // 離脱防止ポップアップ（指示80）: 有効なポップアップのHTML/JS/CSSをLP末尾に挿入
  const exitPopups = (state.exitPopups ?? []).filter(
    (p) => p.ab_test_id === abTest.id && p.enabled,
  )
  const popupHtml = exitPopups.length === 0
    ? ''
    : exitPopups.map((p) => buildPopupSnippet(p, device)).join('')

  // 追尾型ポップアップ（指示85）: 有効な追従バナーをLP末尾に挿入
  const followPopups = (state.followPopups ?? []).filter(
    (p) => p.ab_test_id === abTest.id && p.enabled,
  )
  const followHtml = followPopups.length === 0
    ? ''
    : followPopups.map((p) => buildFollowPopupSnippet(p, device)).join('')

  const html =
    `<!doctype html><html lang="ja"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    robotsMeta +
    `<title>${escapeHtml(abTest.page_title || abTest.title)}</title>` +
    `<link rel="stylesheet" href="${LP_FONTS_URL}">` +
    `<style>body{margin:0 auto;max-width:${DELIVERY_WIDTH}px;font-family:"Hiragino Sans",sans-serif;background:#fff}` +
    `${LP_BASE_CSS}${version.css}${styleCss}${buildAnimCss()}${lp.hasWidget ? WIDGET_RESET_CSS : ''}</style>` +
    externalWidgetLibs(lp.html) +
    headTags +
    `</head><body>${headerHtml}${withAutoplayVideos(lp.html)}${bodyTags}${popupHtml}${followHtml}` +
    IMAGE_LINK_SCRIPT +
    // 本文のリンクに、本体と同じく LP のパラメーター・訪問者ID・記事uid を付ける（中間ページへは article_url も）
    buildLpLinkParamsScript(article.uid) +
    buildTrackingScript(abTest.uid, version.uid) +
    buildAnimRuntimeScript() +
    `</body></html>`

  // 本体と同じ Cookie（2026-09-11 本体の配信で確認）: _sb_a＝記事uid・_sb_tu＝見るたびに新しいID（どちらも5分）、
  // _sb_global＝同じブラウザでは同じID（20年）。リンクのスクリプトが JS で _sb_tu を読むので HttpOnly にしない
  const inFiveMinutes = new Date(Date.now() + 5 * 60 * 1000)
  const inTwentyYears = new Date()
  inTwentyYears.setUTCFullYear(inTwentyYears.getUTCFullYear() + 20)
  res.cookie('_sb_a', article.uid, { expires: inFiveMinutes, sameSite: 'lax', path: '/' })
  res.cookie('_sb_tu', visitorId, { expires: inFiveMinutes, sameSite: 'lax', path: '/' })
  res.cookie('_sb_global', knownGlobalId(req.get('cookie')) ?? randomUUID(), { expires: inTwentyYears, sameSite: 'lax', path: '/' })

  // 配信内容はStateの更新に応じて即時反映すべきなのでキャッシュしない
  res.set('Cache-Control', 'no-cache')
  res.type('html').send(html)
})

/**
 * 配信計測エンドポイント（配信URL `/lp/:uid` からのビーコン受け口）。
 * PV（表示）とクリック（計測ON リンクのみ）を `state.metrics` に加算する。
 * ab_test スコープ（レポート全体）と version スコープ（Version別）の両方を更新。
 * 実データを持ち込まないクローン方針に沿い、記録するのは PV/クリック数の集計のみ。
 */
/**
 * 外部LP（別アカウントのSquadBeyond等）からの計測ビーコンを受け取れるようCORSを許可する。
 * 自前配信(/lp/)は同一オリジンなので不要だが、他所でホストされたLPのタグ設定に計測タグを
 * 貼るケース（＝このシステムのレポートに外部LPを並べる）はクロスオリジンになる。
 * Origin を絞っても防御にはならない（uid さえ知っていれば curl で投げられる元から公開の
 * エンドポイント）ため、ブラウザ用に * を返す。
 */
/**
 * 計測ビーコンのCORS。
 *
 * 除外リンクの目印（Cookie）を外部LPからも届かせるため、資格情報つきを許可する。
 * 資格情報つきのときワイルドカードは使えないので、送信元のオリジンをそのまま返す。
 * 受け取るのは計測の値だけで、この口から読み出せるものは無い。
 */
function setTrackCors(res: Response, origin: string | undefined): void {
  res.setHeader('Access-Control-Allow-Origin', origin !== undefined && origin !== '' ? origin : '*')
  if (origin !== undefined && origin !== '') {
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Max-Age', '600')
}

/**
 * 除外リンク。「メールアドレス」で登録した本人にこのURLを開いてもらうと、
 * そのブラウザに目印（Cookie）が残り、以後そのブラウザからのアクセスは
 * レポートに数えなくなる。
 *
 * なぜこの形か: Webサイトからブラウザのログインアカウント（Chromeに
 * ログインしているGoogleアカウント）は読めない。読めたら誰でも訪問者の
 * メールアドレスを取れてしまうので、ブラウザが渡さない。
 * そこで「本人に一度だけ開いてもらう」ことで、そのブラウザだと判る印を残す。
 */
deliveryRouter.get('/exclude/:token', (req, res) => {
  const token = req.params.token
  const rule = getState().reportExclusions.find((r) => r.exclude_token === token)
  const ok = rule !== undefined
  if (ok) {
    // 2年。ブラウザのデータを消すと外れるので、その旨も画面に書く。
    res.cookie(EXCLUDE_COOKIE, token, {
      maxAge: 2 * 365 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'none',
      secure: true,
      path: '/',
    })
  }
  const email = rule?.conditions.find((c) => c.kind === 'email')?.value ?? ''
  res
    .status(ok ? 200 : 404)
    .type('html')
    .send(renderExcludePage(ok, email))
})


/**
 * 計測スクリプトの配信（外部LPが `<script src>` で読み込む）。
 *
 * 相手のLPには1行のローダーだけを貼ってもらい、中身はここから配る。
 * こうすると計測ロジックを直したときに**貼り直しが要らない**（GA・Metaピクセルと同じ方式）。
 *   /t/:uid.js     … PV / クリック / ヒートマップ（LP本体に貼る）
 *   /t/:uid.cv.js  … CV（サンクスページに貼る）
 *
 * script は CORS の対象外なので配信側に許可は要らない。中のビーコンが叩く
 * `/lp/:uid/__track` 側で許可済み。キャッシュは短め（修正を当日中に行き渡らせる）。
 */
function serveTrackingScript(res: Response, body: string): void {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
  // 5分キャッシュ + 再検証中は古いものを使わせる（毎回取りに来させない・でも当日中に反映）
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.send(body)
}

/**
 * ビーコンの送信先オリジン。
 *
 * Railway のようなプロキシ配下では `req.protocol` が http を返すことがあり、そのままだと
 * https のLPから http へ送ることになってブラウザに混在コンテンツとして全部ブロックされる
 * （実際にこれで1件も届かなかった）。転送ヘッダを優先し、無ければ localhost 以外は https を使う。
 */
function beaconOrigin(req: { protocol: string; get: (name: string) => string | undefined }): string {
  const host = req.get('host') ?? ''
  const forwarded = req.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)
  const proto = forwarded !== undefined && forwarded !== '' ? forwarded : isLocal ? req.protocol : 'https'
  return `${proto}://${host}`
}

/** LP本体用: `/t/<uid>.js` */
deliveryRouter.get('/t/:uid', (req, res) => {
  const raw = req.params.uid
  const origin = beaconOrigin(req)
  const isCv = raw.endsWith('.cv.js')
  const uid = raw.replace(/\.cv\.js$/, '').replace(/\.js$/, '')
  const endpoint = `${origin}/lp/${encodeURIComponent(uid)}/__track`
  serveTrackingScript(res, isCv ? buildCvScriptBody(endpoint) : buildTrackingScriptBody(endpoint))
})

/** CORSプリフライト（Content-Type: application/json のPOSTはプリフライトされる） */
deliveryRouter.options('/lp/:uid/__track', (req, res) => {
  setTrackCors(res, req.get('origin'))
  res.sendStatus(204)
})

deliveryRouter.post('/lp/:uid/__track', (req, res) => {
  setTrackCors(res, req.get('origin'))
  const abTest = findAbTest(getState(), req.params.uid)
  if (abTest === undefined) {
    res.status(404).json({ ok: false })
    return
  }
  // sendBeacon はクロスオリジンだと text/plain でしか送れないため、文字列で来る場合がある。
  // 中身はJSONなのでここで解釈する（壊れていたら空扱いにして落とさない）。
  const raw = req.body as unknown
  const parsed: unknown =
    typeof raw === 'string'
      ? ((): unknown => {
          try {
            return JSON.parse(raw)
          } catch {
            return {}
          }
        })()
      : (raw ?? {})
  const body = (parsed ?? {}) as {
    event?: unknown
    version?: unknown
    amount?: unknown
    /** 計測タグが知らせる、測っているページのURL（origin+pathname） */
    u?: unknown
  }
  const versionUid = typeof body.version === 'string' ? body.version : ''
  const date = toDateKey(new Date())

  /**
   * レポート除外の判定は**すべての計測より先**に行う。
   * 実物の説明は「指定条件に合致するアクセスをレポート集計から除外します。
   * サイト閲覧は可能ですが、数値には反映されません」なので、
   * PV・クリックだけでなくCV・ヒートマップも数えない。
   * ページ自体は普通に表示されているので、応答は ok を返す。
   */
  const visitor: RequestLogEntry = {
    team_id: abTest.team_id,
    date,
    ip: clientIp(req),
    referer: refererOrigin(req.get('referer')),
    params: queryPairsOf(body.u, req),
    excluded: false,
    exclude_token: excludeTokenFromCookie(req.get('cookie')),
  }
  const isExcluded = shouldExclude(visitor, getState().reportExclusions)
  if (body.event === 'pv') {
    // 記録はPVのときだけ残す（1アクセス1件にする。クリックやCVで重複させない）
    setState((s) => ({
      ...s,
      requestLogs: pruneRequestLogs([...s.requestLogs, { ...visitor, excluded: isExcluded }], date),
    }))
  }
  if (isExcluded) {
    res.json({ ok: true, excluded: true })
    return
  }

  // ── CV（実測）: CV計測タグ（サンクスページ）からの通知 ──
  // 合成CVを廃止したので、CVが増える経路はここだけ。売上(amount)は任意で、
  // 送られてこなければ0（金額を発明しない）。
  if (body.event === 'cv') {
    const amount =
      typeof body.amount === 'number' && Number.isFinite(body.amount) ? Math.max(0, body.amount) : 0
    let pushed: ConversionPush | null = null
    setState((s) => {
      const out = recordConversion(s, {
        ab_test_uid: abTest.uid,
        version_uid: versionUid,
        media_id: abTest.media_id,
        amount,
      })
      const media = out.state.media.find((m) => m.id === abTest.media_id)
      const version = out.state.versions.find((v) => v.uid === versionUid)
      pushed = {
        uid: out.conversion.uid,
        ab_test_uid: abTest.uid,
        ab_test_title: abTest.title,
        version_name: version?.name ?? '',
        media: media === undefined ? null : { name: media.name, icon_name: media.icon_name },
        amount,
        occurred_at: new Date(out.conversion.occurred_at * 1000).toISOString(),
      }
      return out.state
    })
    if (pushed !== null) broadcastConversion(pushed)
    res.json({ ok: true })
    return
  }

  // ── ヒートマップ（実測）: 計測タグが離脱時にまとめて送る位置情報 ──
  // 回数ではなく「ページのどこか」を積む。到達率/離脱率/滞在時間/クリック数の材料。
  if (body.event === 'heatmap') {
    const hb = body as unknown as {
      bands?: unknown
      reach?: unknown
      dwell?: unknown
      exit_band?: unknown
      clicks?: unknown
    }
    const bands = typeof hb.bands === 'number' && hb.bands > 0 && hb.bands <= 100 ? hb.bands : 20
    const numArray = (v: unknown, n: number): number[] => {
      const src = Array.isArray(v) ? v : []
      return Array.from({ length: n }, (_, i) => {
        const x = src[i]
        return typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0
      })
    }
    const reach = numArray(hb.reach, bands)
    const dwell = numArray(hb.dwell, bands)
    const exitBand =
      typeof hb.exit_band === 'number' && hb.exit_band >= 0 && hb.exit_band < bands
        ? Math.floor(hb.exit_band)
        : 0
    const clicks = (Array.isArray(hb.clicks) ? hb.clicks : [])
      .slice(0, 300)
      .map((c) => c as { x?: unknown; y?: unknown })
      .filter((c) => typeof c.x === 'number' && typeof c.y === 'number')
      .map((c) => ({ x: c.x as number, y: c.y as number }))

    setState((s) => {
      // 分割数(bands)も一致条件に入れる。分割数を変えたときに、
      // 古い配列へ新しい長さの値を足し込んで数字を壊さないため。
      const idx = s.heatmapStats.findIndex(
        (h) =>
          h.ab_test_uid === abTest.uid &&
          h.version_uid === versionUid &&
          h.date === date &&
          h.bands === bands,
      )
      const base =
        idx === -1
          ? {
              ab_test_uid: abTest.uid,
              version_uid: versionUid,
              date,
              bands,
              pv: 0,
              reach: new Array<number>(bands).fill(0),
              exit: new Array<number>(bands).fill(0),
              dwell_ms: new Array<number>(bands).fill(0),
              dwell_n: new Array<number>(bands).fill(0),
              clicks: [] as { x: number; y: number }[],
            }
          : s.heatmapStats[idx]!
      const merged = {
        ...base,
        pv: base.pv + 1,
        reach: base.reach.map((v, i) => v + (reach[i] ?? 0)),
        exit: base.exit.map((v, i) => v + (i === exitBand ? 1 : 0)),
        dwell_ms: base.dwell_ms.map((v, i) => v + (dwell[i] ?? 0)),
        dwell_n: base.dwell_n.map((v, i) => v + ((dwell[i] ?? 0) > 0 ? 1 : 0)),
        // クリックは増え続けるので上限を設ける（古いものから捨てる）
        clicks: [...base.clicks, ...clicks].slice(-5000),
      }
      return {
        ...s,
        heatmapStats:
          idx === -1
            ? [...s.heatmapStats, merged]
            : s.heatmapStats.map((h, i) => (i === idx ? merged : h)),
      }
    })
    res.json({ ok: true })
    return
  }

  const event: 'pv' | 'click' = body.event === 'click' ? 'click' : 'pv'
  const delta = event === 'click' ? { click: 1 } : { pv: 1 }

  // 外部LPの所在。ヒートマップの背景に実LPを敷くために覚えておく。
  // 自前配信（このサーバー自身のホスト）は Version のHTMLを背景に使うので対象外。
  const reportedUrl = externalUrlFrom(body.u, req.get('host') ?? '')

  setState((s) => {
    let next: State = { ...s, metrics: bumpMetric(s, abTest.uid, 'ab_test', date, delta) }
    if (versionUid !== '') {
      next = { ...next, metrics: bumpMetric(next, versionUid, 'version', date, delta) }
    }
    if (reportedUrl !== null && reportedUrl !== abTest.external_url) {
      next = {
        ...next,
        abTests: next.abTests.map((t) =>
          t.uid === abTest.uid ? { ...t, external_url: reportedUrl } : t,
        ),
      }
    }
    return next
  })
  res.json({ ok: true })
})

/**
 * プレビューページ（サーバー側・実パス `/preview/:versionUid`）。
 *
 * 配信URLと同じくSSRで完結する。認証不要＝プレビューURLは共有用途（§9-1）。
 * 配信との違い:
 *   - version uid で直引き（配信はab_test uidで抽選）
 *   - 計測OFF（tracking URL のビーコンは飛ばさない）
 *   - 警告バナー表示（「このLPは検証用です」）
 */
deliveryRouter.get('/preview/:versionUid', (req, res) => {
  const state = getState()
  const versionUid = req.params.versionUid

  // version uid → version → article → ab_test を逆引き
  const version = state.versions.find((v) => v.uid === versionUid)
  if (version === undefined) {
    res.status(404).type('html').send(renderPreviewNotice(versionUid))
    return
  }
  const article = state.articles.find((a) => a.id === version.article_id)
  if (article === undefined) {
    res.status(404).type('html').send(renderPreviewNotice(versionUid))
    return
  }
  const abTest = state.abTests.find((t) => t.id === article.ab_test_id)

  // 記事設定（Version設定）をLPへ反映する
  const styleCss = masterStyleIframeCss(getMasterStyleSheet(state, article.uid))

  // ヘッダー画像をHTMLコメントから復元（公開LPと同じタグ）
  const { headerHtml, body: bodyHtml } = splitHeaderImage(version.html)
  // 公開LPと同じく、Widget に紛れ込んだプレビュー用CSSがページ全体を上書きしないようにする
  const lp = neutralizeWidgetStyles(bodyHtml)

  const title = abTest !== undefined
    ? `${escapeHtml(abTest.title)} - ${escapeHtml(version.name)} プレビュー`
    : `${escapeHtml(version.name)} プレビュー`

  // 指示174: プレビューでも離脱防止/表示直後/追尾ポップを発動させる（配信と同じ）。
  // （従来はプレビューにスニペットを入れておらず、プレビューURLでは一切出なかった）
  const previewDevice = buildVisitorContext(req).device
  const previewPopupHtml = abTest === undefined
    ? ''
    : (getState().exitPopups ?? [])
        .filter((p) => p.ab_test_id === abTest.id && p.enabled)
        .map((p) => buildPopupSnippet(p, previewDevice))
        .join('')
  const previewFollowHtml = abTest === undefined
    ? ''
    : (getState().followPopups ?? [])
        .filter((p) => p.ab_test_id === abTest.id && p.enabled)
        .map((p) => buildFollowPopupSnippet(p, previewDevice))
        .join('')

  const html =
    `<!doctype html><html lang="ja"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<meta name="robots" content="noindex,nofollow">` +
    `<title>${title}</title>` +
    `<link rel="stylesheet" href="${LP_FONTS_URL}">` +
    `<style>body{margin:0 auto;max-width:${DELIVERY_WIDTH}px;font-family:"Hiragino Sans",sans-serif;background:#fff}` +
    `${LP_BASE_CSS}${version.css}${styleCss}` +
    `.preview-banner{position:sticky;top:0;z-index:99999;background:#D32F2F;` +
    `padding:14px 20px;margin:0;display:flex;align-items:center;gap:10px;` +
    `font-size:15px;font-weight:700;color:#fff;` +
    `font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;` +
    `box-shadow:0 2px 8px rgba(0,0,0,.25)}` +
    `.preview-banner svg{flex-shrink:0}` +
    `.preview-note{font-weight:500;font-size:13px;color:rgba(255,255,255,.85);margin-left:8px}` +
    `.preview-close{margin-left:auto;background:none;border:none;color:rgba(255,255,255,.7);` +
    `cursor:pointer;padding:4px;display:flex;align-items:center;flex-shrink:0}` +
    `.preview-close:hover{color:#fff}` +
    buildAnimCss() +
    (lp.hasWidget ? WIDGET_RESET_CSS : '') +
    `</style>` +
    externalWidgetLibs(lp.html) +
    `</head><body>` +
    `<div class="preview-banner" id="preview-banner">` +
    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>` +
    `<span>このLPは検証用です。入稿しないでください。</span>` +
    `<span class="preview-note">※計測されません</span>` +
    `<button class="preview-close" onclick="document.getElementById('preview-banner').remove()" aria-label="閉じる">` +
    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>` +
    `</button>` +
    `</div>` +
    headerHtml +
    withAutoplayVideos(lp.html) +
    previewPopupHtml +
    previewFollowHtml +
    buildAnimRuntimeScript() +
    `</body></html>`

  res.set('Cache-Control', 'no-cache')
  res.type('html').send(html)
})




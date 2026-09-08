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
import { Router } from 'express'
import type { Response } from 'express'
import { getState, setState } from '../store/store.ts'
import { getMasterStyleSheet } from '../store/master-style-sheet.ts'
import { getHtmlSetting } from '../store/html-tags.ts'
import { bulkTagsForFolder } from '../store/bulk-tags.ts'
import { bumpMetric, recordConversion } from '../store/actions.ts'
import { broadcastConversion, type ConversionPush } from '../ws/cable.ts'
import { toDateKey } from '../store/metrics.ts'
import type { AbTest, Article, ExitPopup, FollowPopup, State, Version } from '../store/types.ts'
import { LP_BASE_CSS } from '../../src/app/lp-base-css.ts'
import { masterStyleIframeCss } from '../../src/app/master-style.ts'
import { withAutoplayVideos } from '../../src/app/lp-video.ts'
import { buildAnimCss, buildAnimRuntimeScript } from '../../src/app/anim/anim-presets.ts'
import { buildCvScriptBody, buildTrackingScriptBody } from '../../src/shared/tracking-tag.ts'

export const deliveryRouter: Router = Router()

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
function buildTrackingScript(uid: string, versionUid: string): string {
  const endpoint = `/lp/${encodeURIComponent(uid)}/__track`
  return `<script>(function(){
  var U=${JSON.stringify(endpoint)},V=${JSON.stringify(versionUid)};
  function send(ev){try{
    fetch(U,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:ev,version:V}),keepalive:true});
  }catch(e){}}
  send('pv');
  document.addEventListener('click',function(e){
    var a=e.target&&e.target.closest&&e.target.closest('a');
    if(!a)return;
    var href=a.getAttribute('href')||'';
    var tracked=/^tel:/i.test(href)?(a.getAttribute('data-sb-'+'tracking')==='true'):/[?&]sb_tracking=true(?:[&#]|$)/.test(href);
    if(tracked)send('click');
  },true);

  /* ── ヒートマップ用の収集 ──
     実物のヒートマップは「到達率 / 離脱率 / 滞在時間 / クリック数」の4モードを持つ。
     どれもページ内の**位置**が要るので、回数だけでなく縦位置を集める。
     ページ全体を BANDS 等分し、
       reach[i]  : そのバンドまで到達したか（1回の訪問につき最大到達まで1）
       dwell[i]  : そのバンドが画面内にあった時間(ms)
       exitBand  : 最後に見ていたバンド（＝離脱位置）
       clicks    : クリックの相対座標（x は幅比、y はページ高さ比）
     離脱時にまとめて1回だけ送る（スクロールのたびに送らない）。 */
  var BANDS=20;
  var reach=new Array(BANDS).fill(0), dwell=new Array(BANDS).fill(0), clicks=[];
  var lastT=Date.now(), maxBand=0, sent=false;
  function docH(){ return Math.max(1, document.documentElement.scrollHeight - window.innerHeight); }
  function curBand(){
    var p=window.scrollY/docH();
    return Math.max(0, Math.min(BANDS-1, Math.floor(p*BANDS)));
  }
  function tick(){
    var now=Date.now(), b=curBand();
    // 画面内に入っているバンドすべてに滞在時間を配る（1バンドだけだと長いLPで偏る）
    var top=window.scrollY/ (docH()+window.innerHeight), bot=(window.scrollY+window.innerHeight)/(docH()+window.innerHeight);
    var from=Math.max(0,Math.floor(top*BANDS)), to=Math.min(BANDS-1,Math.floor(bot*BANDS));
    for(var i=from;i<=to;i++) dwell[i]+=(now-lastT);
    lastT=now;
    if(b>maxBand)maxBand=b;
  }
  window.addEventListener('scroll',tick,{passive:true});
  setInterval(tick,1000);
  document.addEventListener('click',function(e){
    var h=document.documentElement.scrollHeight||1, w=window.innerWidth||1;
    clicks.push({x:Math.round((e.clientX/w)*1000)/1000, y:Math.round(((e.pageY)/h)*1000)/1000});
    if(clicks.length>300)clicks.shift();
  },true);
  function flush(){
    if(sent)return; sent=true; tick();
    for(var i=0;i<=maxBand;i++) reach[i]=1;
    try{
      var body=JSON.stringify({event:'heatmap',version:V,bands:BANDS,
        reach:reach,dwell:dwell,exit_band:curBand(),clicks:clicks});
      if(navigator.sendBeacon) navigator.sendBeacon(U,new Blob([body],{type:'application/json'}));
      else fetch(U,{method:'POST',headers:{'Content-Type':'application/json'},body:body,keepalive:true});
    }catch(e){}
  }
  window.addEventListener('pagehide',flush);
  document.addEventListener('visibilitychange',function(){ if(document.hidden)flush(); });
})()</script>`
}

type DeviceKind = 'sp' | 'tablet' | 'pc'
type MobileOS = 'android' | 'ios'
type Carrier = 'docomo' | 'au' | 'softbank'

/** 訪問者の出し分け判定に使う文脈（1リクエストぶん） */
interface VisitorContext {
  device: DeviceKind
  /** モバイルOS。PC等では null */
  mobileOS: MobileOS | null
  /** 回線キャリア。ブラウザだけでは判定不可のため通常 null。?__carrier= で検証用に指定可 */
  carrier: Carrier | null
  /** URLクエリ（流入元別の照合に使う） */
  query: Record<string, string>
  /** 現在時刻 HH:MM（時間別） */
  nowHHMM: string
  /** 今日 YYYY-MM-DD（日付別） */
  today: string
}

/** 訪問者のデバイスを User-Agent から判定する（sp / tablet / pc）。クライアント版と同じ判定式。 */
function detectDevice(userAgent: string): DeviceKind {
  if (/iPad|Tablet|Nexus 7|Nexus 10|Kindle|Silk|PlayBook/i.test(userAgent)) return 'tablet'
  if (/Mobile|iPhone|Android.*Mobile|Windows Phone|iPod/i.test(userAgent)) return 'sp'
  return 'pc'
}

/** モバイルOSを User-Agent から判定（PC等は null） */
function detectMobileOS(userAgent: string): MobileOS | null {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios'
  if (/Android/i.test(userAgent)) return 'android'
  return null
}

/** キャリアは通常判定不可。検証用に ?__carrier=docomo|au|softbank で指定できる。 */
function detectCarrier(raw: unknown): Carrier | null {
  return raw === 'docomo' || raw === 'au' || raw === 'softbank' ? raw : null
}

/**
 * 現在の日本時間(JST)を HH:MM / YYYY-MM-DD で返す。
 * 時間別・日付別の出し分けは実SB（日本向けサービス）と同じく **日本時間**で判定する。
 * 本番サーバー(Railway)のTZはUTCなので、`new Date().getHours()` をそのまま使うと
 * 日本の日中でも時間帯条件が外れる（例: JST12:00=UTC03:00 が 06:00-22:00 の範囲外扱い）
 * バグになる。Intl でタイムゾーンを Asia/Tokyo に固定して判定する。
 */
function jstNow(): { hhmm: string; today: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? ''
  const hour = get('hour') === '24' ? '00' : get('hour') // 一部環境で 24:xx を返すため丸める
  return { hhmm: `${hour}:${get('minute')}`, today: `${get('year')}-${get('month')}-${get('day')}` }
}

function buildVisitorContext(req: import('express').Request): VisitorContext {
  const ua = req.headers['user-agent'] ?? ''
  const query: Record<string, string> = {}
  for (const [k, v] of Object.entries(req.query)) {
    query[k] = Array.isArray(v) ? String(v[0] ?? '') : String(v ?? '')
  }
  const { hhmm, today } = jstNow()
  return {
    device: detectDevice(ua),
    mobileOS: detectMobileOS(ua),
    carrier: detectCarrier(req.query['__carrier']),
    query,
    nowHHMM: hhmm,
    today,
  }
}

/** そのVersionが、指定デバイスへ配信可か（デバイス別ON/OFF）。未設定は全ON扱い。 */
function targetsDevice(version: Version, device: DeviceKind): boolean {
  return version.device_targets?.[device] !== false
}

/** 流入元別: URLクエリが1件のルールに一致するか */
function matchesParamRule(rule: { name: string; match: string; value: string }, query: Record<string, string>): boolean {
  const candidates = rule.name !== '' ? [query[rule.name]] : Object.values(query)
  for (const raw of candidates) {
    if (raw === undefined) continue
    if (rule.match === 'exact' && raw === rule.value) return true
    if (rule.match === 'prefix' && raw.startsWith(rule.value)) return true
    if (rule.match === 'suffix' && raw.endsWith(rule.value)) return true
    if (rule.match === 'contains' && raw.includes(rule.value)) return true
  }
  return false
}

/** 時間別: now が from〜to（HH:MM）内か。日をまたぐ範囲(22:00〜02:00)も許容 */
function inTimeRange(now: string, from: string, to: string): boolean {
  if (from === '' || to === '') return true
  return from <= to ? now >= from && now <= to : now >= from || now <= to
}

/** 日付別: today が from〜to（YYYY-MM-DD、ISO文字列比較）内か */
function inDatePeriod(today: string, from: string, to: string): boolean {
  if (from === '' && to === '') return true
  if (from !== '' && today < from) return false
  if (to !== '' && today > to) return false
  return true
}

/**
 * そのVersionが、この訪問者に配信可能か（6条件すべてを掛け算で判定）。
 * 各設定は「未設定＝制限なし（対象）」がデフォルト。デバイス別・パラメーター未登録は常に対象。
 */
function isEligible(v: Version, ctx: VisitorContext): boolean {
  // デバイス別
  if (!targetsDevice(v, ctx.device)) return false
  // モバイルOS別: いずれかON指定があれば「モバイル かつ そのOS」のみ対象（PCは除外）
  if (v.os_targets && (v.os_targets.android || v.os_targets.ios)) {
    if (ctx.mobileOS === null) return false
    if (!v.os_targets[ctx.mobileOS]) return false
  }
  // キャリア別: 判定できた場合のみ適用（通常は判定不可＝スキップ＝対象）
  if (ctx.carrier !== null && v.carrier_targets && (v.carrier_targets.docomo || v.carrier_targets.au || v.carrier_targets.softbank)) {
    if (!v.carrier_targets[ctx.carrier]) return false
  }
  // 流入元別（旧パラメーター別）: ルールがあれば1件以上一致が必要。未登録は常に対象。
  if (v.param_rules && v.param_rules.length > 0) {
    if (!v.param_rules.some((r) => matchesParamRule(r, ctx.query))) return false
  }
  // 時間別: 範囲があれば1件以上に該当する時刻のみ対象
  if (v.time_ranges && v.time_ranges.length > 0) {
    if (!v.time_ranges.some((r) => inTimeRange(ctx.nowHHMM, r.from, r.to))) return false
  }
  // 日付別: off期間中は除外。on期間があれば on期間中のみ対象。期間無しは適用しない。
  if (v.date_periods && v.date_periods.length > 0) {
    const inOff = v.date_periods.some((p) => p.mode === 'off' && inDatePeriod(ctx.today, p.from, p.to))
    if (inOff) return false
    const onPeriods = v.date_periods.filter((p) => p.mode === 'on')
    if (onPeriods.length > 0 && !onPeriods.some((p) => inDatePeriod(ctx.today, p.from, p.to))) return false
  }
  return true
}

/**
 * 配信するVersionを1つ選ぶ。6条件（デバイス/OS/キャリア/流入元/時間/日付）を満たすVersionから
 * 配信割合で重み付け抽選する。満たすVersionが無ければ段階的にフォールバック
 * （割合条件を外す→デバイス条件だけ→生存Version全体）して「何も出ない」を避ける。
 */
/**
 * 配信するVersionを配信割合どおりに選ぶ（指示173）。
 *
 * 配信割合0%のVersionは**絶対に配信しない**。
 * 以前は「割合1%以上の候補が無ければ割合を無視した候補へ落ちる」フォールバックがあり、
 * 全部0%のときや出し分け条件から外れたときに0%のVersionが表示されていた。
 * 重み付けも `Math.max(1, ratio)` で0%を1%扱いしていた。どちらも割合を裏切るのでやめる。
 *
 * 候補が無い場合は null を返し、呼び出し側が「配信できるVersionがありません」を出す。
 * 表示できるものを無理に探すより、割合設定どおりに「配信しない」が正しい。
 *
 * なおプレビュー(`/preview/:versionUid`)はVersionを直接指定して開くので、
 * 配信割合とは無関係に必ずそのVersionが出る（検証用途なのでこれが正しい）。
 */
function pickDeliveryVersion(versions: readonly Version[], ctx: VisitorContext): Version | null {
  const pool = versions.filter(
    (v) => v.archived !== true && v.distribution_ratio >= 1 && isEligible(v, ctx),
  )
  if (pool.length === 0) return null
  const total = pool.reduce((sum, v) => sum + v.distribution_ratio, 0)
  if (total <= 0) return null
  let ticket = Math.random() * total
  for (const version of pool) {
    ticket -= version.distribution_ratio
    if (ticket <= 0) return version
  }
  // 浮動小数の誤差で最後まで残ったときは末尾（割合の合計を超えたケース）
  return pool[pool.length - 1] ?? null
}

/** ランダムな計測用uid（訪問ごとに変わる。SBのsquadbeyond_uid相当） */
function genSquadbeyondUid(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

/**
 * AFFILICODE連携: 本文中の外部リンク(http/https)へ計測用パラメーターを付与する。
 * SB公式FAQ準拠: squadbeyond_uid / sb_tracking=true / sb_article_uid。
 * 既にクエリがあれば & で連結する。アンカー(#)やパラメーター重複は素朴に扱う。
 */
function appendAffilicodeParams(html: string, articleUid: string): string {
  const uid = genSquadbeyondUid()
  const params = `squadbeyond_uid=${encodeURIComponent(uid)}&sb_tracking=true&sb_article_uid=${encodeURIComponent(articleUid)}`
  return html.replace(/href="(https?:\/\/[^"]*)"/g, (_m, url: string) => {
    if (url.includes('sb_tracking=true')) return `href="${url}"`
    const [base, hash = ''] = url.split('#')
    const sep = (base ?? '').includes('?') ? '&' : '?'
    return `href="${base}${sep}${params}${hash ? `#${hash}` : ''}"`
  })
}

/**
 * ウィジェットが必要とする外部JSライブラリを、本文HTMLの内容から判定して <head> に読み込む。
 * 実SBのカルーセル等のウィジェットは Swiper / SmoothScroll / jQuery / GLightbox 前提で書かれており、
 * これらを読み込まないと内蔵JS（new Swiper 等）が ReferenceError で動かない。
 * 同期 <script> を head に置くことで、body内のウィジェットJSより前に定義される。
 */
function externalWidgetLibs(html: string): string {
  const tags: string[] = []
  if (/jQuery\s*\(|(?:^|[^\w.$])\$\(/.test(html)) {
    tags.push('<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>')
  }
  if (/new Swiper|class="[^"]*\bswiper|\bswiper-(?:container|wrapper|slide)/i.test(html)) {
    tags.push('<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css">')
    tags.push('<script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>')
  }
  if (/new SmoothScroll|SmoothScroll\s*\(/.test(html)) {
    tags.push('<script src="https://cdn.jsdelivr.net/npm/smooth-scroll@16.1.3/dist/smooth-scroll.polyfills.min.js"></script>')
  }
  if (/GLightbox|glightbox/i.test(html)) {
    tags.push('<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/glightbox/dist/css/glightbox.min.css">')
    tags.push('<script src="https://cdn.jsdelivr.net/npm/glightbox/dist/js/glightbox.min.js"></script>')
  }
  return tags.join('')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 実在しないID等で開かれたときの案内ページ（クライアント版 showNotice のSSR版） */
function renderNotice(res: import('express').Response, uid: string): void {
  const looksLikePlaceholder = /[<>]/.test(uid)
  const html =
    `<!doctype html><html lang="ja"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>配信ページが見つかりません</title>` +
    `<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;` +
    `padding:24px;font-family:"Hiragino Sans",sans-serif;background:#ECECEC}` +
    `.card{background:#fff;border-radius:8px;padding:28px 32px;max-width:520px;text-align:center;` +
    `box-shadow:0 1px 6px rgba(0,0,0,.12);line-height:1.9}` +
    `.title{font-size:16px;font-weight:600;margin-bottom:8px}` +
    `.desc{font-size:13px;color:#555}</style></head><body>` +
    `<div class="card">` +
    `<div class="title">このURLの配信ページは見つかりません</div>` +
    `<div class="desc">指定されたID「${escapeHtml(uid)}」のbeyondページが存在しません。` +
    (looksLikePlaceholder
      ? '<br><b>&lt;uid&gt; は差し込み用の記号です。</b>実際のIDに置き換えてください。'
      : '') +
    `</div></div></body></html>`
  res.status(404).type('html').send(html)
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
  const versionHtml = affilicodeOn ? appendAffilicodeParams(version.html, article.uid) : version.html

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
    `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&family=Noto+Serif+JP:wght@400;700&family=Shippori+Mincho:wght@400;700&family=M+PLUS+Rounded+1c:wght@400;700&family=Zen+Maru+Gothic:wght@400;700&family=Kosugi+Maru&family=Dela+Gothic+One&family=RocknRoll+One&family=Reggae+One&family=Yuji+Syuku&family=Hachi+Maru+Pop&family=Yomogi&display=swap">` +
    `<style>body{margin:0 auto;max-width:${DELIVERY_WIDTH}px;font-family:"Hiragino Sans",sans-serif;background:#fff}` +
    `${LP_BASE_CSS}${version.css}${styleCss}${buildAnimCss()}</style>` +
    externalWidgetLibs(versionHtml) +
    headTags +
    `</head><body>${withAutoplayVideos(versionHtml)}${bodyTags}${popupHtml}${followHtml}` +
    IMAGE_LINK_SCRIPT +
    buildTrackingScript(abTest.uid, version.uid) +
    buildAnimRuntimeScript() +
    `</body></html>`

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
function setTrackCors(res: Response): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Max-Age', '600')
}

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

/** LP本体用: `/t/<uid>.js` */
deliveryRouter.get('/t/:uid', (req, res) => {
  const raw = req.params.uid
  const origin = `${req.protocol}://${req.get('host') ?? ''}`
  const isCv = raw.endsWith('.cv.js')
  const uid = raw.replace(/\.cv\.js$/, '').replace(/\.js$/, '')
  const endpoint = `${origin}/lp/${encodeURIComponent(uid)}/__track`
  serveTrackingScript(res, isCv ? buildCvScriptBody(endpoint) : buildTrackingScriptBody(endpoint))
})

/** CORSプリフライト（Content-Type: application/json のPOSTはプリフライトされる） */
deliveryRouter.options('/lp/:uid/__track', (_req, res) => {
  setTrackCors(res)
  res.sendStatus(204)
})

deliveryRouter.post('/lp/:uid/__track', (req, res) => {
  setTrackCors(res)
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
  const body = (parsed ?? {}) as { event?: unknown; version?: unknown; amount?: unknown }
  const versionUid = typeof body.version === 'string' ? body.version : ''
  const date = toDateKey(new Date())

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
      const idx = s.heatmapStats.findIndex(
        (h) =>
          h.ab_test_uid === abTest.uid && h.version_uid === versionUid && h.date === date,
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
  setState((s) => {
    let next: State = { ...s, metrics: bumpMetric(s, abTest.uid, 'ab_test', date, delta) }
    if (versionUid !== '') {
      next = { ...next, metrics: bumpMetric(next, versionUid, 'version', date, delta) }
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

  // ヘッダー画像をHTMLコメントから復元
  const headerMatch = version.html.match(/^<!--header-image:(.+?)-->/)
  const headerHtml = headerMatch !== null
    ? `<img src="${escapeHtml(headerMatch[1] ?? '')}" style="display:block;width:100%;object-fit:cover;position:sticky;top:0;z-index:10;max-height:200px" alt="ヘッダー画像">`
    : ''
  const bodyHtml = headerMatch !== null ? version.html.slice(headerMatch[0].length) : version.html

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
    `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&family=Noto+Serif+JP:wght@400;700&family=Shippori+Mincho:wght@400;700&family=M+PLUS+Rounded+1c:wght@400;700&family=Zen+Maru+Gothic:wght@400;700&family=Kosugi+Maru&family=Dela+Gothic+One&family=RocknRoll+One&family=Reggae+One&family=Yuji+Syuku&family=Hachi+Maru+Pop&family=Yomogi&display=swap">` +
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
    `</style>` +
    externalWidgetLibs(bodyHtml) +
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
    withAutoplayVideos(bodyHtml) +
    previewPopupHtml +
    previewFollowHtml +
    buildAnimRuntimeScript() +
    `</body></html>`

  res.set('Cache-Control', 'no-cache')
  res.type('html').send(html)
})

/** プレビューが見つからないときの案内 */
function renderPreviewNotice(versionUid: string): string {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>プレビューが見つかりません</title>` +
    `<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;` +
    `padding:24px;font-family:"Hiragino Sans",sans-serif;background:#ECECEC}` +
    `.card{background:#fff;border-radius:8px;padding:28px 32px;max-width:520px;text-align:center;` +
    `box-shadow:0 1px 6px rgba(0,0,0,.12);line-height:1.9}` +
    `.title{font-size:16px;font-weight:600;margin-bottom:8px}` +
    `.desc{font-size:13px;color:#555}</style></head><body>` +
    `<div class="card">` +
    `<div class="title">このプレビューURLは見つかりません</div>` +
    `<div class="desc">Version「${escapeHtml(versionUid)}」が存在しないか、削除されています。</div>` +
    `</div></body></html>`
}

/**
 * 離脱防止ポップアップのHTMLスニペットを構築する（指示80）。
 * デバイスフィルタを適用し、マッチしないポップアップは出さない。
 * 離脱防止トリガー: ページ離脱（mouseout / visibilitychange）で表示。
 */
function buildPopupSnippet(popup: ExitPopup, device: 'sp' | 'tablet' | 'pc'): string {
  // デバイスフィルタ
  if (device === 'sp' && !popup.device_sp) return ''
  if (device === 'tablet' && !popup.device_tablet) return ''
  if (device === 'pc' && !popup.device_pc) return ''

  const popupId = `exit-popup-${popup.uid}`
  const animClass = popup.animation !== 'none' ? popup.animation : ''

  // リンク設定（キャンバス画像と同じ規約）: 遷移先 link_url / 新タブ link_target / 計測URL tracking_urls。
  // 旧データはこれらを持たない場合があるので既定値で守る。
  const epLink = popup.link_url ?? ''
  const epTarget = popup.link_target === '_self' ? '_self' : '_blank'
  const epPins = Array.isArray(popup.tracking_urls) ? popup.tracking_urls : []

  // アニメーションCSS（エントランス9種 + 内部アニメ用キーフレーム）
  const animCss = `
    @keyframes epFadeIn { from{opacity:0} to{opacity:1} }
    @keyframes epSlideUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
    @keyframes epSlideDown { from{opacity:0;transform:translateY(-30px)} to{opacity:1;transform:translateY(0)} }
    @keyframes epSlideLeft { from{opacity:0;transform:translateX(-50px)} to{opacity:1;transform:translateX(0)} }
    @keyframes epSlideRight { from{opacity:0;transform:translateX(50px)} to{opacity:1;transform:translateX(0)} }
    @keyframes epZoomIn { from{opacity:0;transform:scale(.8)} to{opacity:1;transform:scale(1)} }
    @keyframes epBounceIn { 0%{opacity:0;transform:scale(.3)} 50%{opacity:1;transform:scale(1.05)} 70%{transform:scale(.95)} 100%{opacity:1;transform:scale(1)} }
    @keyframes epElastic { 0%{opacity:0;transform:scale(.5)} 55%{opacity:1;transform:scale(1.12)} 75%{transform:scale(.96)} 100%{opacity:1;transform:scale(1)} }
    @keyframes epFlipIn { 0%{opacity:0;transform:perspective(400px) rotateX(90deg)} 40%{transform:perspective(400px) rotateX(-10deg)} 70%{transform:perspective(400px) rotateX(10deg)} 100%{opacity:1;transform:perspective(400px) rotateX(0)} }
    @keyframes epConfettiFall { 0%{transform:translateY(0) rotate(0deg);opacity:1} 100%{transform:translateY(400px) rotate(720deg);opacity:0} }
    @keyframes epPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
    .ep-overlay { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:99999; display:none; align-items:center; justify-content:center; }
    .ep-overlay.visible { display:flex; }
    .ep-content { max-width:min(500px,92vw); width:fit-content; max-height:80vh; overflow:auto; position:relative; scrollbar-width:none; -ms-overflow-style:none; }
    .ep-content::-webkit-scrollbar { width:0; height:0; display:none; }
    .ep-content.fade { animation:epFadeIn .3s ease }
    .ep-content.slideUp { animation:epSlideUp .4s ease }
    .ep-content.slideDown { animation:epSlideDown .4s ease }
    .ep-content.slideLeft { animation:epSlideLeft .4s ease }
    .ep-content.slideRight { animation:epSlideRight .4s ease }
    .ep-content.zoomIn { animation:epZoomIn .3s ease }
    .ep-content.bounceIn { animation:epBounceIn .6s ease }
    .ep-content.elastic { animation:epElastic .8s ease }
    .ep-content.flipIn { animation:epFlipIn .6s ease }
    .ep-close { position:absolute; top:8px; right:8px; width:28px; height:28px; border-radius:50%; background:#fff; border:1px solid #ddd; cursor:pointer; font-size:14px; display:flex; align-items:center; justify-content:center; box-shadow:0 1px 4px rgba(0,0,0,.15); z-index:2; }
  `

  // 種別（指示176）とクリック動作（指示172）
  const popupKind = popup.popup_kind === 'instant' ? 'instant' : 'exit'
  const linkAction = popup.link_action === 'close' ? 'close' : 'link'

  // 統合IIFE: 内部アニメJS(popup.javascript) + トリガーJS を1つのスコープにまとめ、
  // overlay / epId をスコープ変数として共有。'ep-show' カスタムイベントで内部アニメを起動。
  const scriptBody = `(function(){
    var epId='${popupId}';
    var overlay=document.getElementById(epId);
    if(!overlay)return;
    var shown=false;
    var delay=${popup.delay_seconds * 1000};
    var scrollTrigger=${popup.scroll_trigger};
    var scrollPos=${popup.scroll_position};
    var kind=${JSON.stringify(popupKind)};
    var exitTrig=${popup.exit_trigger !== false};
    var backTrig=${popup.back_button_trigger === true};
    var cdTrig=${popup.countdown_trigger === true};
    var cdSec=${popup.countdown_seconds || 0};
    var linkAction=${JSON.stringify(linkAction)};

    function showPopup(){
      if(shown)return;
      // 指示160: 離脱防止ポップは同時に1つだけ表示する（複数有効時に重なって×が2個出るのを防ぐ）。
      if(document.querySelector('.ep-overlay.visible'))return;
      shown=true;
      overlay.classList.add('visible');
      try{overlay.dispatchEvent(new CustomEvent('ep-show'))}catch(e){}
    }
    function closePopup(){ overlay.classList.remove('visible'); }

    // ── 内部アニメーションJS（プリセットが設定）──
    ${popup.javascript}

    if(kind==='instant'){
      // ── 指示176: 表示直後 — LPを開いた直後（delay後・既定0）にオーバーレイ表示 ──
      setTimeout(showPopup, delay);
    } else {
      // ── 指示175: 離脱防止 — 開いた直後には出さず「離脱意図」でのみ出す ──
      // （旧: mouseout全辺 + visibilitychange が読み込み直後に誤発火していた。両方やめる）
      var armed=false;
      setTimeout(function(){ armed=true; }, delay); // 読み込み直後の誤発火を防ぐ猶予
      // PC: カーソルが画面「上端」の外へ出た（＝タブ/URLバー方向へ抜けた）とき。exit_trigger時。
      if(exitTrig){
        document.addEventListener('mouseout',function(e){
          if(!armed)return;
          if(e.clientY<=0 && !e.relatedTarget)showPopup();
        });
      }
      // 戻る操作（ブラウザ戻る/スマホの戻るジェスチャ）で発動。exit_trigger または back_button_trigger時。
      if(exitTrig||backTrig){
        var trapped=false;
        try{history.pushState({epTrap:1},'')}catch(e){}
        window.addEventListener('popstate',function(){
          if(trapped)return;            // 2回目の戻るは通す（離脱を許可）
          trapped=true;
          showPopup();
          try{history.pushState({epTrap:1},'')}catch(e){} // 戻るを1回だけ捕まえてポップ表示
        });
      }
      // カウントダウンで表示
      if(cdTrig&&cdSec>0)setTimeout(showPopup, cdSec*1000);
      // スクロールで表示
      if(scrollTrigger){
        window.addEventListener('scroll',function(){
          var pct=(window.scrollY/(document.body.scrollHeight-window.innerHeight))*100;
          if(pct>=scrollPos)showPopup();
        });
      }
    }

    // ── クリック時の動作（指示172）──
    var epLink=${JSON.stringify(epLink)};
    var epTarget=${JSON.stringify(epTarget)};
    var epPins=${JSON.stringify(epPins)};
    var content=overlay.querySelector('.ep-content');
    if(linkAction!=='close'&&epLink&&content)content.style.cursor='pointer';

    overlay.addEventListener('click',function(e){
      var t=e.target;
      // 背景 or ×ボタン → 閉じる
      if(t===overlay||(t.classList&&t.classList.contains('ep-close'))){closePopup();return;}
      // 指示172: 動作=LPに戻る → 中身タップでも閉じて、元のLPの見ていた位置へ戻る（×と同じ）
      if(linkAction==='close'){closePopup();return;}
      if(!epLink)return;
      // 中身が本物のリンク/ボタン（href が # や javascript: 以外）ならそれを生かす
      var inner=t.closest&&t.closest('a[href]');
      if(inner){var h=inner.getAttribute('href')||'';if(h&&h!=='#'&&!/^javascript:/i.test(h))return;}
      if(t.closest&&t.closest('button'))return;
      // ポップアップ本体クリック → 遷移先へ
      e.preventDefault();
      // 計測URL（ピクセル）発火
      epPins.forEach(function(u){try{navigator.sendBeacon(u)}catch(err){new Image().src=u}});
      // レポート計測(sb_tracking)も拾えるよう、実 <a> クリックで遷移する（画像リンクと同じ経路）
      var a=document.createElement('a');a.href=epLink;a.target=epTarget;
      if(epTarget==='_blank')a.rel='noopener noreferrer';
      document.body.appendChild(a);a.click();a.remove();
    });
  })()`

  return `<style>${animCss}</style>` +
    `<div id="${popupId}" class="ep-overlay">` +
    `<div class="ep-content ${animClass}">` +
    `<button class="ep-close">✕</button>` +
    popup.html +
    `</div></div>` +
    (popup.head_tag !== '' ? popup.head_tag : '') +
    (popup.body_tag !== '' ? popup.body_tag : '') +
    `<script>${scriptBody}<\/script>`
}

/**
 * 追尾型ポップアップのHTMLスニペットを構築する（指示85）。
 * スクロール追従バナー: 画面の上端/下端/角に固定表示される。
 * オーバーレイ無し、ページ閲覧を妨げない控えめな表示。
 */
function buildFollowPopupSnippet(fp: FollowPopup, device: 'sp' | 'tablet' | 'pc'): string {
  if (device === 'sp' && !fp.device_sp) return ''
  if (device === 'tablet' && !fp.device_tablet) return ''
  if (device === 'pc' && !fp.device_pc) return ''

  const fpId = `follow-popup-${fp.uid}`

  // 位置に応じたCSS
  const positionStyles: Record<string, string> = {
    top: 'top:0;left:0;right:0',
    bottom: 'bottom:0;left:0;right:0',
    'bottom-right': 'bottom:16px;right:16px',
    'bottom-left': 'bottom:16px;left:16px',
  }
  const posStyle = positionStyles[fp.position] ?? positionStyles.bottom

  // アニメーション
  const animMap: Record<string, string> = {
    slideUp: 'fpSlideUp .4s ease',
    slideDown: 'fpSlideDown .4s ease',
    fade: 'fpFadeIn .3s ease',
  }
  const animValue = animMap[fp.animation] ?? ''

  const css = `
    @keyframes fpSlideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
    @keyframes fpSlideDown { from{opacity:0;transform:translateY(-20px)} to{opacity:1;transform:translateY(0)} }
    @keyframes fpFadeIn { from{opacity:0} to{opacity:1} }
    #${fpId} { position:fixed;${posStyle};z-index:99990;display:none;${animValue !== '' ? `animation:${animValue};` : ''} }
    #${fpId}.fp-visible { display:block; }
    #${fpId} .fp-close { position:absolute;top:4px;right:4px;width:24px;height:24px;border-radius:50%;background:rgba(0,0,0,.5);color:#fff;border:none;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;z-index:1; }
    ${fp.css}
  `

  const showAfterScroll = fp.show_after_scroll
  const scriptBody = `(function(){
    var el=document.getElementById('${fpId}');if(!el)return;
    var scrollThreshold=${showAfterScroll};
    function show(){el.classList.add('fp-visible')}
    ${showAfterScroll > 0
      ? `window.addEventListener('scroll',function(){
          var pct=(window.scrollY/(document.body.scrollHeight-window.innerHeight))*100;
          if(pct>=scrollThreshold)show();
        });`
      : `show();`
    }
    el.querySelector('.fp-close')?.addEventListener('click',function(){el.remove()});
    ${fp.javascript}
  })()`

  const closeButton = fp.show_close_button
    ? `<button class="fp-close">✕</button>`
    : ''

  return `<style>${css}</style>` +
    `<div id="${fpId}">` +
    closeButton +
    fp.html +
    `</div>` +
    `<script>${scriptBody}<\/script>`
}

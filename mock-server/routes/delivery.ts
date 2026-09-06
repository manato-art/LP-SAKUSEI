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
import { getState } from '../store/store.ts'
import { getMasterStyleSheet } from '../store/master-style-sheet.ts'
import { getHtmlSetting } from '../store/html-tags.ts'
import type { AbTest, Article, ExitPopup, FollowPopup, State, Version } from '../store/types.ts'
import { LP_BASE_CSS } from '../../src/app/lp-base-css.ts'
import { masterStyleIframeCss } from '../../src/app/master-style.ts'
import { withAutoplayVideos } from '../../src/app/lp-video.ts'

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

type DeviceKind = 'sp' | 'tablet' | 'pc'

/** 訪問者のデバイスを User-Agent から判定する（sp / tablet / pc）。クライアント版と同じ判定式。 */
function detectDevice(userAgent: string): DeviceKind {
  if (/iPad|Tablet|Nexus 7|Nexus 10|Kindle|Silk|PlayBook/i.test(userAgent)) return 'tablet'
  if (/Mobile|iPhone|Android.*Mobile|Windows Phone|iPod/i.test(userAgent)) return 'sp'
  return 'pc'
}

/** そのVersionが、指定デバイスへ配信可か（デバイス別ON/OFF）。未設定は全ON扱い。 */
function targetsDevice(version: Version, device: DeviceKind): boolean {
  return version.device_targets?.[device] !== false
}

/**
 * 配信するVersionを1つ選ぶ（FAQ「出し分けロジック＝Branch Operation × デバイス別ON/OFF の掛け算」）。
 * ①非アーカイブ ②配信割合1以上 ③デバイスON を満たすVersionから配信割合で重み付け抽選する。
 * 満たすVersionが無ければ段階的にフォールバックする（デバイス条件だけ→生存Version全体）。
 */
function pickDeliveryVersion(versions: readonly Version[], device: DeviceKind): Version | null {
  const alive = versions.filter((v) => v.archived !== true)
  const eligible = alive.filter((v) => v.distribution_ratio >= 1 && targetsDevice(v, device))
  const deviceAlive = alive.filter((v) => targetsDevice(v, device))
  const pool = eligible.length > 0 ? eligible : deviceAlive.length > 0 ? deviceAlive : alive
  if (pool.length === 0) return null
  const total = pool.reduce((sum, v) => sum + Math.max(1, v.distribution_ratio), 0)
  let ticket = Math.random() * total
  for (const version of pool) {
    ticket -= Math.max(1, version.distribution_ratio)
    if (ticket <= 0) return version
  }
  return pool[0] ?? null
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
  const device = detectDevice(req.headers['user-agent'] ?? '')
  const version = pickDeliveryVersion(versions, device)
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
  // タグ設定（noindex・head/bodyへの差し込みタグ）
  const htmlSetting = getHtmlSetting(state, article.uid)
  const headTags = htmlSetting.html_tags
    .filter((t) => t.document_property === 'head')
    .map((t) => t.body)
    .join('')
  const bodyTags = htmlSetting.html_tags
    .filter((t) => t.document_property === 'body')
    .map((t) => t.body)
    .join('')
  const robotsMeta = htmlSetting.noindex ? '<meta name="robots" content="noindex,nofollow">' : ''

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
    `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&family=Noto+Serif+JP:wght@400;700&family=M+PLUS+Rounded+1c:wght@400;700&family=Kosugi+Maru&family=Sawarabi+Gothic&display=swap">` +
    `<style>body{margin:0 auto;max-width:${DELIVERY_WIDTH}px;font-family:"Hiragino Sans",sans-serif;background:#fff}` +
    `${LP_BASE_CSS}${version.css}${styleCss}</style>` +
    headTags +
    `</head><body>${withAutoplayVideos(version.html)}${bodyTags}${popupHtml}${followHtml}` +
    IMAGE_LINK_SCRIPT +
    `</body></html>`

  // 配信内容はStateの更新に応じて即時反映すべきなのでキャッシュしない
  res.set('Cache-Control', 'no-cache')
  res.type('html').send(html)
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

  const html =
    `<!doctype html><html lang="ja"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<meta name="robots" content="noindex,nofollow">` +
    `<title>${title}</title>` +
    `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&family=Noto+Serif+JP:wght@400;700&family=M+PLUS+Rounded+1c:wght@400;700&family=Kosugi+Maru&family=Sawarabi+Gothic&display=swap">` +
    `<style>body{margin:0 auto;max-width:${DELIVERY_WIDTH}px;font-family:"Hiragino Sans",sans-serif;background:#fff}` +
    `${LP_BASE_CSS}${version.css}${styleCss}` +
    `.preview-banner{background:#fff3cd;border:1px solid #ffc107;padding:10px 16px;margin:0;` +
    `display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:#856404;` +
    `font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}` +
    `.preview-banner svg{flex-shrink:0}` +
    `.preview-note{font-weight:400;font-size:11px;color:#a07a00;margin-left:auto;white-space:nowrap}` +
    `</style>` +
    `</head><body>` +
    `<div class="preview-banner">` +
    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>` +
    `<span>このLPは検証用です。入稿しないでください。</span>` +
    `<span class="preview-note">※計測されません</span>` +
    `</div>` +
    headerHtml +
    withAutoplayVideos(bodyHtml) +
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
    .ep-content { max-width:500px; width:90%; max-height:80vh; overflow:auto; position:relative; }
    .ep-content.fade { animation:epFadeIn .3s ease }
    .ep-content.slideUp { animation:epSlideUp .4s ease }
    .ep-content.slideDown { animation:epSlideDown .4s ease }
    .ep-content.slideLeft { animation:epSlideLeft .4s ease }
    .ep-content.slideRight { animation:epSlideRight .4s ease }
    .ep-content.zoomIn { animation:epZoomIn .3s ease }
    .ep-content.bounceIn { animation:epBounceIn .6s ease }
    .ep-content.elastic { animation:epElastic .8s ease }
    .ep-content.flipIn { animation:epFlipIn .6s ease }
    .ep-close { position:absolute; top:-12px; right:-12px; width:28px; height:28px; border-radius:50%; background:#fff; border:1px solid #ddd; cursor:pointer; font-size:14px; display:flex; align-items:center; justify-content:center; box-shadow:0 1px 4px rgba(0,0,0,.15); z-index:1; }
  `

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

    function showPopup(){
      if(shown)return;
      shown=true;
      overlay.classList.add('visible');
      try{overlay.dispatchEvent(new CustomEvent('ep-show'))}catch(e){}
    }

    // ── 内部アニメーションJS（プリセットが設定）──
    ${popup.javascript}

    // ── 離脱防止トリガー ──
    setTimeout(function(){
      document.addEventListener('mouseout',function(e){
        if(e.clientY<=0||e.clientX<=0||e.clientX>=window.innerWidth||e.clientY>=window.innerHeight)showPopup();
      });
      document.addEventListener('visibilitychange',function(){if(document.hidden)showPopup()});
    },delay);

    if(scrollTrigger){
      window.addEventListener('scroll',function(){
        var pct=(window.scrollY/(document.body.scrollHeight-window.innerHeight))*100;
        if(pct>=scrollPos)showPopup();
      });
    }

    overlay.addEventListener('click',function(e){
      if(e.target===overlay||e.target.classList.contains('ep-close'))overlay.classList.remove('visible');
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

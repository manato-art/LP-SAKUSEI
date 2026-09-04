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
import type { AbTest, Article, ExitPopup, State, Version } from '../store/types.ts'
import { LP_BASE_CSS } from '../../src/app/lp-base-css.ts'
import { masterStyleIframeCss } from '../../src/app/master-style.ts'
import { withAutoplayVideos } from '../../src/app/lp-video.ts'

export const deliveryRouter: Router = Router()

/** 既定の配信Version幅（実物のデフォルト） */
const DELIVERY_WIDTH = 620

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
  const exitPopups = state.exitPopups.filter(
    (p) => p.ab_test_id === abTest.id && p.enabled,
  )
  const popupHtml = exitPopups.length === 0
    ? ''
    : exitPopups.map((p) => buildPopupSnippet(p, device)).join('')

  const html =
    `<!doctype html><html lang="ja"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    robotsMeta +
    `<title>${escapeHtml(abTest.page_title || abTest.title)}</title>` +
    `<style>body{margin:0 auto;max-width:${DELIVERY_WIDTH}px;font-family:"Hiragino Sans",sans-serif;background:#fff}` +
    `${LP_BASE_CSS}${version.css}${styleCss}</style>` +
    headTags +
    `</head><body>${withAutoplayVideos(version.html)}${bodyTags}${popupHtml}</body></html>`

  // 配信内容はStateの更新に応じて即時反映すべきなのでキャッシュしない
  res.set('Cache-Control', 'no-cache')
  res.type('html').send(html)
})

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

  // アニメーションCSS
  const animCss = `
    @keyframes epFadeIn { from { opacity:0 } to { opacity:1 } }
    @keyframes epSlideUp { from { opacity:0; transform:translateY(30px) } to { opacity:1; transform:translateY(0) } }
    @keyframes epSlideDown { from { opacity:0; transform:translateY(-30px) } to { opacity:1; transform:translateY(0) } }
    @keyframes epZoomIn { from { opacity:0; transform:scale(.8) } to { opacity:1; transform:scale(1) } }
    .ep-overlay { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:99999; display:none; align-items:center; justify-content:center; }
    .ep-overlay.visible { display:flex; }
    .ep-content { max-width:500px; width:90%; max-height:80vh; overflow:auto; position:relative; }
    .ep-content.fade { animation: epFadeIn .3s ease; }
    .ep-content.slideUp { animation: epSlideUp .4s ease; }
    .ep-content.slideDown { animation: epSlideDown .4s ease; }
    .ep-content.zoomIn { animation: epZoomIn .3s ease; }
    .ep-close { position:absolute; top:-12px; right:-12px; width:28px; height:28px; border-radius:50%; background:#fff; border:1px solid #ddd; cursor:pointer; font-size:14px; display:flex; align-items:center; justify-content:center; box-shadow:0 1px 4px rgba(0,0,0,.15); z-index:1; }
  `

  // トリガーJS: 離脱防止（PCはmouseout、モバイルはvisibilitychange）
  const triggerJs = `
    (function(){
      var overlay = document.getElementById('${popupId}');
      if (!overlay) return;
      var shown = false;
      var delay = ${popup.delay_seconds * 1000};
      var scrollTrigger = ${popup.scroll_trigger};
      var scrollPos = ${popup.scroll_position};

      function showPopup() {
        if (shown) return;
        shown = true;
        overlay.classList.add('visible');
      }

      // 離脱防止トリガー（マウスがビューポート外へ出たとき）
      setTimeout(function(){
        document.addEventListener('mouseout', function(e) {
          if (e.clientY <= 0 || e.clientX <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
            showPopup();
          }
        });
        // モバイル: タブ切り替え/ブラウザ閉じ
        document.addEventListener('visibilitychange', function() {
          if (document.hidden) showPopup();
        });
      }, delay);

      // スクロールトリガー
      if (scrollTrigger) {
        window.addEventListener('scroll', function() {
          var scrolled = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
          if (scrolled >= scrollPos) showPopup();
        });
      }

      // 閉じるボタン
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay || e.target.classList.contains('ep-close')) {
          overlay.classList.remove('visible');
        }
      });
    })();
  `

  return `<style>${animCss}</style>` +
    `<div id="${popupId}" class="ep-overlay">` +
    `<div class="ep-content ${animClass}">` +
    `<button class="ep-close">✕</button>` +
    popup.html +
    `</div></div>` +
    (popup.head_tag !== '' ? popup.head_tag : '') +
    (popup.body_tag !== '' ? popup.body_tag : '') +
    `<script>${popup.javascript}${triggerJs}<\/script>`
}

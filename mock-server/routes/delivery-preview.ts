/**
 * プレビュー（`/preview/:versionUid`・delivery.ts から分けた・2026-09-24）。
 *
 * 保存したVersionを、配信LPと同じ見た目（LPの基本CSS・Version CSS・LP設定・Widgetの整理）で出す。
 * 計測はしない（計測スクリプト・一括タグ・画像リンクのビーコンを入れない）。
 * 画像のリンクは押せる（以前は押せなかった・点検36）。
 *
 * `renderPreviewDocument` は、エディタの比較モードが「まだ保存していない本文」や「履歴の本文」を
 * 同じ見た目で出すのにも使う（以前は比較モードだけ別の組み立てで、配信と見た目が違った・点検36）。
 */
import { Router } from 'express'
import { getState } from '../store/store.ts'
import { getMasterStyleSheet } from '../store/master-style-sheet.ts'
import type { State, Version } from '../store/types.ts'
import { LP_BASE_CSS } from '../../src/app/lp-base-css.ts'
import { WIDGET_RESET_CSS, neutralizeWidgetStyles } from '../../src/shared/sb-preview-css.ts'
import { LP_FONTS_URL, externalWidgetLibs } from '../../src/shared/lp-page-assets.ts'
import { splitHeaderImage } from '../../src/shared/header-image.ts'
import { masterStyleIframeCss } from '../../src/app/master-style.ts'
import { withAutoplayVideos } from '../../src/app/lp-video.ts'
import { buildAnimCss, buildAnimRuntimeScript } from '../../src/app/anim/anim-presets.ts'
import { buildVisitorContext } from './delivery-targeting.ts'
import { renderPreviewPopups } from './delivery-popups.ts'
import { imageLinkScript } from './delivery-image-links.ts'
import { escapeHtml, renderPreviewNotice } from './delivery-notice.ts'
import { DELIVERY_WIDTH } from './delivery.ts'

export const previewRouter: Router = Router()

export interface PreviewOptions {
  /** 保存したVersionの本文の代わりに出す本文（比較モードの「いまの本文」「履歴の本文」） */
  readonly html?: string
  /** LPの本文だけ（検証用の帯とポップアップを出さない） */
  readonly bare: boolean
  /** ポップアップの出し分けに使う端末 */
  readonly device: ReturnType<typeof buildVisitorContext>['device']
  /** ?popup_draft={uid}: そのポップアップの下書きだけを出す（ポップアップ編集の「下書きを確認」） */
  readonly draftUid?: string
}

/** プレビューのページ全体（Versionが見つからなければ null） */
export function renderPreviewDocument(state: State, version: Version, options: PreviewOptions): string | null {
  const article = state.articles.find((a) => a.id === version.article_id)
  if (article === undefined) return null
  const abTest = state.abTests.find((t) => t.id === article.ab_test_id)

  // 記事設定（Version設定）をLPへ反映する
  const styleCss = masterStyleIframeCss(getMasterStyleSheet(state, article.uid))

  // ヘッダー画像をHTMLコメントから復元（公開LPと同じタグ）
  const { headerHtml, body: bodyHtml } = splitHeaderImage(options.html ?? version.html)
  // 公開LPと同じく、Widget に紛れ込んだプレビュー用CSSがページ全体を上書きしないようにする
  const lp = neutralizeWidgetStyles(bodyHtml)

  const title = abTest !== undefined
    ? `${escapeHtml(abTest.title)} - ${escapeHtml(version.name)} プレビュー`
    : `${escapeHtml(version.name)} プレビュー`

  // 指示174: プレビューでも離脱防止/表示直後/追尾ポップを発動させる（配信と同じ・本番反映した物）。
  // draftUid: 編集画面の「下書きを確認」＝そのポップアップの下書きだけ（delivery-popups.ts・2026-09-24）
  const previewPopupHtml = renderPreviewPopups(
    abTest === undefined ? null : { state, abTest, version, device: options.device },
    { bare: options.bare, draftUid: options.draftUid ?? '' },
  )

  return (
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
    (options.bare ? '' : previewBannerHtml()) +
    headerHtml +
    withAutoplayVideos(lp.html) +
    previewPopupHtml +
    // 画像のリンクは押せるように（計測URLへは送らない）
    imageLinkScript(false) +
    buildAnimRuntimeScript() +
    `</body></html>`
  )
}

previewRouter.get('/preview/:versionUid', (req, res) => {
  const state = getState()
  const versionUid = req.params.versionUid
  const version = state.versions.find((v) => v.uid === versionUid)
  // ?bare=1: LPの本文だけ（2026-09-24）。ポップアップの中身を直す画面の「LPの上に重ねて見る」で後ろに敷く。
  // 検証用の帯とポップアップは出さない（直しているポップアップの後ろに、同じポップアップや帯が重ならないように）
  const html =
    version === undefined
      ? null
      : renderPreviewDocument(state, version, {
          bare: req.query['bare'] === '1',
          device: buildVisitorContext(req).device,
          draftUid: typeof req.query['popup_draft'] === 'string' ? req.query['popup_draft'] : '',
        })
  if (html === null) {
    res.status(404).type('html').send(renderPreviewNotice(versionUid))
    return
  }
  res.set('Cache-Control', 'no-cache')
  res.type('html').send(html)
})

/** プレビューの上の赤い帯（「このLPは検証用です」） */
function previewBannerHtml(): string {
  return (
    `<div class="preview-banner" id="preview-banner">` +
    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>` +
    `<span>このLPは検証用です。入稿しないでください。</span>` +
    `<span class="preview-note">※計測されません</span>` +
    `<button class="preview-close" onclick="document.getElementById('preview-banner').remove()" aria-label="閉じる">` +
    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>` +
    `</button>` +
    `</div>`
  )
}

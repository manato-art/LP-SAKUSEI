/**
 * ヒートマップの列に敷く「自前配信のLP」の文書を組み立てる（純粋関数）。
 *
 * iframe に入れて表示するので、枠の幅（スマホ375px／PC980px）がそのまま画面の幅になる。
 * @media の切り替えも、画面の横幅に対する割合（vw）で決めた大きさも実機と同じ基準になり、
 * LPの長さ＝到達ラインの位置が実機に合う（本人指定・2026-09-11）。
 *
 * 見た目は公開LP（mock-server/routes/delivery.ts の /lp）と同じ土台で組む:
 *   配信幅の body・LP の共通CSS・Version の CSS・記事設定の CSS・Widget の土台・フォント・Widget の外部スタイルシート・ヘッダー画像
 * 入れないもの:
 *   - 計測タグ・スクリプト（表示するたびに計測されてしまう。iframe も sandbox でスクリプトを動かさない）
 *   - ポップアップ（LPの流れの外に重なるもの）
 *   - 表示アニメ（CSS とスクリプトの組なので、スクリプトを動かさないここでは入れない）
 */
import { LP_BASE_CSS } from '../lp-base-css.ts'
import { withAutoplayVideos } from '../lp-video.ts'
import { LP_WIDTH } from '../panels/lp-width-media.ts'
import { WIDGET_RESET_CSS, neutralizeWidgetStyles } from '../../shared/sb-preview-css.ts'
import { LP_FONTS_URL, externalWidgetStylesheets } from '../../shared/lp-page-assets.ts'
import { splitHeaderImage } from '../../shared/header-image.ts'

export interface HeatmapLpSource {
  /** Version の本文HTML */
  readonly html: string
  /** Version の CSS */
  readonly css: string
  /** 記事設定（Version設定）から作った CSS */
  readonly styleCss: string
}

export function buildHeatmapLpDocument(source: HeatmapLpSource): string {
  // 公開LPと同じく、ヘッダー画像（本文の先頭の `<!--header-image:…-->`）は本文の上の画像にする
  const { headerHtml, body } = splitHeaderImage(source.html)
  // 公開LPと同じく、Widget に紛れ込んだ SquadBeyond のプレビュー用CSSがページ全体を上書きしないようにする
  const lp = neutralizeWidgetStyles(body)
  return (
    `<!doctype html><html lang="ja"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<link rel="stylesheet" href="${LP_FONTS_URL}">` +
    `<style>body{margin:0 auto;max-width:${LP_WIDTH}px;font-family:"Hiragino Sans",sans-serif;background:#fff}` +
    `${LP_BASE_CSS}${source.css}${source.styleCss}${lp.hasWidget ? WIDGET_RESET_CSS : ''}</style>` +
    externalWidgetStylesheets(lp.html) +
    `</head><body>${headerHtml}${withAutoplayVideos(lp.html)}</body></html>`
  )
}

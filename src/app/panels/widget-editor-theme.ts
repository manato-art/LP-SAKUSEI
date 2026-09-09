/**
 * Widget編集画面の配色・書体・寸法と、編集対象の型（widget-editor.ts から分離）。
 *
 * 画面を組み立てる関数がファイルをまたいで参照するので、独立させてある。
 */

/** 本番実測のダークUI色 */
export const COLOR = {
  container: '#2B2B2B',
  codePanel: '#151515',
  codeBorder: '#333',
  codeText: '#eeffff',
  labelText: '#fff',
  lineNumberText: '#555',
  divider: '#444',
  toggleBg: '#3a3a3a',
  toggleBgOn: 'var(--sb-accent, #0091FF)',
  brand: 'var(--sb-accent, #0091FF)',
  // Widget 選択UI
  selectBorder: 'var(--sb-accent, #0091FF)',
  selectLabel: '#333',
  selectLabelBg: 'rgba(0,145,255,.9)',
} as const
export const FONT = '"Hiragino Sans","Hiragino Kaku Gothic ProN",sans-serif'
export const MONO = '"SF Mono",Menlo,"Fira Code",monospace'
/**
 * 編集プレビューの幅。配信LP（SSR）の body max-width と揃える＝WYSIWYG。
 * mock-server/routes/delivery.ts の DELIVERY_WIDTH と同値に保つこと。
 */
export const WIDGET_PREVIEW_WIDTH = 620
export interface WidgetEditTarget {
  readonly node: HTMLElement
  readonly html: string
  readonly css: string
  readonly index: number
  readonly length: number
}

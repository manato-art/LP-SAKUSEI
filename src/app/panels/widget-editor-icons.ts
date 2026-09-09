/**
 * Widget編集画面のアイコン（widget-editor.ts から分離）。
 *
 * 共通指示「UIは絵文字をやめSVGアイコンに」に従って、全部SVGで持つ。
 * どれも文字列を返すだけで、状態も引数もほぼ持たない。
 */

export function svgPlus(): string {
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="vertical-align:middle">
    <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`
}
/** 人差し指アイコン（本番の fa-hand-point-up 再現） */
export function svgPointingHand(): string {
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="vertical-align:middle"><path d="M7 1c.55 0 1 .45 1 1v5h1c.55 0 1 .45 1 1l1-1c.55 0 1 .45 1 1v3c0 2.2-1.8 4-4 4H6c-2.2 0-4-1.8-4-4V8c0-.55.45-1 1-1s1 .45 1 1V7c0-.55.45-1 1-1s1 .45 1 1V2c0-.55.45-1 1-1z"/></svg>`
}
/** 分割表示アイコン（コードパネルのビュー切替） */
export function svgViewSplit(): string {
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2">
    <rect x="1" y="2" width="14" height="12" rx="1.5"/>
    <line x1="8" y1="2" x2="8" y2="14"/>
  </svg>`
}
/** コード表示アイコン（コードパネルのビュー切替） */
export function svgViewCode(): string {
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2">
    <path d="M5 4 L2 8 L5 12"/>
    <path d="M11 4 L14 8 L11 12"/>
    <line x1="9" y1="3" x2="7" y2="13"/>
  </svg>`
}
/** 元に戻す */
export function svgToolUndo(): string {
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 5h7a3.5 3.5 0 0 1 0 7H8"/><path d="M5 2L2 5l3 3"/></svg>`
}
/** やり直す */
export function svgToolRedo(): string {
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5H5a3.5 3.5 0 0 0 0 7h1"/><path d="M9 2l3 3-3 3"/></svg>`
}
/** サイズ小 (−) */
export function svgToolSizeMinus(): string {
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="3" y1="7" x2="11" y2="7"/></svg>`
}
/** サイズ大 (+) */
export function svgToolSizePlus(): string {
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="7" y1="3" x2="7" y2="11"/><line x1="3" y1="7" x2="11" y2="7"/></svg>`
}
/** 太字 (B) */
export function svgToolBold(): string {
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 2h4a2.5 2.5 0 0 1 0 5H4zm0 5h4.5a2.5 2.5 0 0 1 0 5H4z"/></svg>`
}
/** 下線 (U) */
export function svgToolUnderline(): string {
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3.5 2v4.5a3.5 3.5 0 0 0 7 0V2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="2" y1="13" x2="12" y2="13" stroke="currentColor" stroke-width="1.2"/></svg>`
}
/** 取り消し線 (S) */
export function svgToolStrikethrough(): string {
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><line x1="1" y1="7" x2="13" y2="7" stroke-width="1.4"/><path d="M9.5 3.5C9 2.8 8.1 2.2 7 2.2c-1.5 0-2.7.9-2.7 2 0 .6.3 1.1.8 1.5"/><path d="M4.5 10.5c.5.7 1.4 1.3 2.5 1.3 1.5 0 2.7-.9 2.7-2 0-.5-.2-.9-.5-1.3"/></svg>`
}
/** 配置（左揃えアイコン + ドロップダウン） */
export function svgToolAlign(): string {
  return `<svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><line x1="1" y1="2.5" x2="11" y2="2.5"/><line x1="1" y1="5.5" x2="8" y2="5.5"/><line x1="1" y1="8.5" x2="11" y2="8.5"/><line x1="1" y1="11.5" x2="8" y2="11.5"/><path d="M14 5.5l2 2-2 2" stroke-width="1.2"/></svg>`
}
/** 斜体 (I) */
export function svgToolItalic(): string {
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><line x1="6" y1="2" x2="10" y2="2"/><line x1="4" y1="12" x2="8" y2="12"/><line x1="8" y1="2" x2="6" y2="12"/></svg>`
}
/** 文字色 (A + カラーバー) */
export function svgToolTextColor(): string {
  return `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M3.5 10L7 2l3.5 8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><line x1="4.8" y1="8" x2="9.2" y2="8" stroke="currentColor" stroke-width="1.2"/><rect x="2" y="12" width="10" height="2" rx=".5" fill="#e53935"/></svg>`
}
/** 背景色 (A + 背景カラーバー) */
export function svgToolBgColor(): string {
  return `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="10" width="12" height="3.5" rx=".5" fill="#ffca28"/><path d="M3.5 9L7 1l3.5 8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><line x1="4.8" y1="7" x2="9.2" y2="7" stroke="currentColor" stroke-width="1.2"/></svg>`
}
/** 画像 */
export function svgToolImage(): string {
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="2" width="11" height="10" rx="1.5"/><circle cx="4.5" cy="5" r="1.2" fill="currentColor" stroke="none"/><path d="M1.5 10l3-3.5 2.5 3 2-1.5L12.5 11"/></svg>`
}
/** マーカー（ペンアイコン） */
export function svgToolMarker(): string {
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 1l3 3-7 7H3v-3z"/><line x1="8" y1="3" x2="11" y2="6"/></svg>`
}
/** リンク（チェーンアイコン） */
export function svgToolLink(): string {
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M6 8a3 3 0 0 0 4.24 0l1.5-1.5a3 3 0 0 0-4.24-4.24L6.62 3.14"/><path d="M8 6a3 3 0 0 0-4.24 0L2.26 7.5a3 3 0 0 0 4.24 4.24l.88-.88"/></svg>`
}
/** 書式クリア（消しゴムアイコン） */
export function svgToolClearFormat(): string {
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 2l4.5 4.5-5 5H3.5L1 9l4-4.5z"/><line x1="5" y1="5.5" x2="9.5" y2="10"/><line x1="1" y1="12.5" x2="13" y2="12.5"/></svg>`
}

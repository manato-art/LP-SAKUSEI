/**
 * LPの編集画面（キャンバス）でのWidgetの見え方（widget-editor.ts から分離・2026-09-22）。
 *
 * - マウスを乗せる／選ぶと青い枠。名前のラベル（「MuiBox-root」など）は出さない
 *   （2026-09-22 本人の依頼「赤丸で囲った文字いらない」）
 * - 編集画面の本文は Quill の `.ql-editor{white-space:pre-wrap}`。Widgetの中までそれが効くと、
 *   HTML の改行・字下げが空の行として残り、枠が縦（や横）に大きくなる
 *   （矢印のWidgetで 配信37px → 編集画面139px。2026-09-22 実測）。
 *   配信（.ql-editor の外）と同じく、Widgetの中は改行・字下げを詰める。Widget 自身が white-space を
 *   指定した要素は、その指定が継承より優先されるので影響しない
 * - 中身がスクリプトで出るWidget（スクリプトが動くまで全部 display:none）は、編集画面では高さ0になり押せない
 *   （配信でも0px。前は改行の空行で偶然押せていた）。押して編集を開けるよう、最低の高さ32pxを持たせる
 * テストは tests/widget-canvas-css.test.ts。
 */
export function widgetSelectionCss(selectBorder: string): string {
  return `
    /* 指示155-2: 編集キャンバス(.ql-editor)は行間1.8のため、Widget内の見出し等(<br>改行)が
       広がりすぎる。配信LP・編集プレビューと同じく1.5を既定にして揃える（Widget自身が
       line-heightを明示した要素は直接指定が継承より優先されるので影響しない）。 */
    .ql-editor section.sb-widget-block { line-height:1.5; white-space:normal; min-height:32px; }
    section.sb-widget-block { cursor:pointer; transition:outline .15s, box-shadow .15s; position:relative; }
    section.sb-widget-block:hover { outline:2px solid ${selectBorder}; outline-offset:-2px; }
    section.sb-widget-block[data-widget-selected="true"] {
      outline:2px solid ${selectBorder}; outline-offset:-2px;
    }
    /* 指示161: ツールバーで付けた素のリンク(<a href>・クラス無し)を、編集プレビューで
       ひと目でリンクと分かる見た目にする（青＋下線）。Widget独自の装飾リンク(.link__button等)は
       クラスを持つので影響しない。 */
    [data-widget-editor] [contenteditable="true"] a:not([class]) {
      color:#0d6efd; text-decoration:underline; cursor:pointer;
    }
  `
}

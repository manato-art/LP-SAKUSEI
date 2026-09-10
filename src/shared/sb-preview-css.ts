/**
 * Widget に紛れ込んだ「SquadBeyond のプレビュー用CSS」を、公開LPで悪さをしない形にする（本人指定・2026-09-10）。
 *
 * Widget ライブラリの見本は iframe で、その <head> に SquadBeyond のプレビュー用CSSが3つ入っている。
 * Widget を追加するとき、これを Widget の中へ丸ごと写していた（1件あたり約30KB）。
 * 公開LPでは Widget の <style> が本文より後ろに来るので、次のように**ページ全体**を上書きしていた:
 *   背景がグレー（#ececec）・LPが左に寄る（margin:0）・高さが画面に固定（100vh）・
 *   記事設定のフォントやLP内リンクの色を上書き・スクロールバーを消す
 * 一方で Widget の見た目の一部（ボタンの文字を受け継ぐ・リンクを黒に 等）はこのCSSに頼っていて、
 * 丸ごと外すとライブラリ25件中20件以上で見た目が変わる（実測）。
 *
 * そこで:
 *   - 3つのCSSは Widget から取り除く（`stripSbPreviewCss`）
 *   - Widget の見た目に要る指定だけを、Widget の中にしか効かない形で1回だけ置く（`WIDGET_RESET_CSS`）
 *     `:where()` で囲むので、Widget 自身のクラス指定より強くならない（元の要素名だけの指定と同じ強さ）
 *   - 編集画面の写し（キャンバス・Widget編集のプレビュー・サムネイル）にも、同じ土台をその場所の範囲に限って置く（`widgetResetCss`）
 * 配信時にこれを行い、保存済みのデータは書き換えない。
 */

/** 1つ目: `#articlePartPreview { … }`（記事設定の既定値。LPにこの id は無いので効き目も無い） */
const PREVIEW_DEFAULTS = /#articlePartPreview\s*\{[^}]*\}(?:\s*#articlePartPreview\s+img\s*\{[^}]*\})?/g

/** 2つ目: ページ全体の指定＋normalize.css（最初と最後の規則で見分ける） */
const PAGE_BASE_START = 'html{height:100vh}body{margin:0 auto;height:100vh;background-color:#ececec'
const PAGE_BASE_END = 'td,th{padding:0}'

/** 3つ目: 編集画面用（CodeMirror・Quill・アイコン文字 等。LPの要素には当たらない） */
const EDITOR_BASE_START = '.CodeMirror{font-family:monospace;height:300px;color:#000;direction:ltr}'
const EDITOR_BASE_END = /\.icon-report:before\{content:"[^"]*"\}/

/** 始まりから終わりまでを切り取る（終わりが見つからなければ触らない） */
function cutBetween(text: string, start: string, end: string | RegExp): string {
  let out = text
  for (;;) {
    const from = out.indexOf(start)
    if (from === -1) return out
    const rest = out.slice(from)
    const m = typeof end === 'string' ? { index: rest.indexOf(end), length: end.length } : end.exec(rest)
    const at = m === null ? -1 : m.index
    if (at === -1 || m === null) return out
    const length = 'length' in m && typeof m.length === 'number' && !Array.isArray(m) ? m.length : (m as RegExpExecArray)[0].length
    out = out.slice(0, from) + out.slice(from + at + length)
  }
}

/** Widget の CSS から、SquadBeyond のプレビュー用CSS（3つ）を取り除く。Widget 自身の指定には触らない。 */
export function stripSbPreviewCss(css: string): string {
  const withoutDefaults = css.replace(PREVIEW_DEFAULTS, '')
  const withoutPage = cutBetween(withoutDefaults, PAGE_BASE_START, PAGE_BASE_END)
  return cutBetween(withoutPage, EDITOR_BASE_START, EDITOR_BASE_END)
}

/**
 * Widget の見た目に要る指定（2つ目のCSSから、ページ全体に効くものを除いた残り）。
 * 並びは元のまま。`body a` は Widget 内の `a` に、`html input` は `input` に読み替える。
 * ページ全体の指定（html / body の高さ・背景・余白・フォント、スクロールバー）は入れない。
 * `body` の `word-wrap:break-word` だけは Widget 内の長い文字の折り返しに効いていたので残す。
 */
const RESET_RULES: readonly (readonly [string, string])[] = [
  ['a', 'color:#000;text-decoration:none'],
  ['[data-is-disable=true]', 'pointer-events:none;opacity:.5'],
  ['', 'word-wrap:break-word'],
  ['article,aside,details,figcaption,figure,footer,header,hgroup,main,menu,nav,section,summary', 'display:block'],
  ['audio,canvas,progress,video', 'display:inline-block;vertical-align:baseline'],
  ['audio:not([controls])', 'display:none;height:0'],
  ['[hidden],template', 'display:none'],
  ['a', 'background-color:transparent'],
  ['a:active,a:hover', 'outline:0'],
  ['abbr[title]', 'border-bottom:1px dotted'],
  ['b,strong', 'font-weight:700'],
  ['dfn', 'font-style:italic'],
  ['h1', 'font-size:2em;margin:.67em 0'],
  ['mark', 'background:#ff0;color:#000'],
  ['small', 'font-size:80%'],
  ['sub,sup', 'font-size:75%;line-height:0;position:relative;vertical-align:baseline'],
  ['sup', 'top:-.5em'],
  ['sub', 'bottom:-.25em'],
  ['img', 'border:0'],
  ['svg:not(:root)', 'overflow:hidden'],
  ['figure', 'margin:1em 40px'],
  ['hr', 'box-sizing:content-box;height:0'],
  ['pre', 'overflow:auto'],
  ['code,kbd,pre,samp', 'font-family:monospace,monospace;font-size:1em'],
  ['button,input,optgroup,select,textarea', 'color:inherit;font:inherit;margin:0'],
  ['button', 'overflow:visible'],
  ['button,select', 'text-transform:none'],
  ['button,input[type=button],input[type=reset],input[type=submit]', '-webkit-appearance:button;cursor:pointer'],
  ['button[disabled],input[disabled]', 'cursor:default'],
  ['button::-moz-focus-inner,input::-moz-focus-inner', 'border:0;padding:0'],
  ['input', 'line-height:normal'],
  ['input[type=checkbox],input[type=radio]', 'box-sizing:border-box;padding:0'],
  ['input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button', 'height:auto'],
  ['input[type=search]', '-webkit-appearance:textfield;box-sizing:content-box'],
  ['input[type=search]::-webkit-search-cancel-button,input[type=search]::-webkit-search-decoration', '-webkit-appearance:none'],
  ['fieldset', 'border:1px solid #c0c0c0;margin:0 2px;padding:.35em .625em .75em'],
  ['legend', 'border:0;padding:0'],
  ['textarea', 'overflow:auto'],
  ['optgroup', 'font-weight:700'],
  ['table', 'border-collapse:collapse;border-spacing:0'],
  ['td,th', 'padding:0'],
]

/** Widget の見た目に要る土台を、scope（Widget の外枠を指すセレクタ）の中に限って書き出す */
export function widgetResetCss(scope: string): string {
  return RESET_RULES.map(([selectors, declarations]) =>
    selectors === ''
      ? `${scope}{${declarations}}`
      : `${selectors
          .split(',')
          .map((s) => `${scope} ${s.trim()}`)
          .join(',')}{${declarations}}`,
  ).join('')
}

/**
 * 配信用の土台（LPに Widget があるとき、<head> に1回だけ置く）。
 * `:where()` で囲むので、Widget 自身のクラス指定より強くならない（元の要素名だけの指定と同じ強さ）。
 */
export const WIDGET_RESET_CSS = widgetResetCss(':where(.sb-widget-block)')

/**
 * LP の HTML にある `<style>` から、SquadBeyond のプレビュー用CSSを取り除く（配信時に使う）。
 * `hasWidget` が true なら、`WIDGET_RESET_CSS` を <head> に置くこと。
 */
export function neutralizeWidgetStyles(html: string): { html: string; hasWidget: boolean } {
  const out = html.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (whole, open: string, body: string, close: string) => {
    const stripped = stripSbPreviewCss(body)
    return stripped === body ? whole : `${open}${stripped}${close}`
  })
  return { html: out, hasWidget: out.includes('sb-widget-block') }
}

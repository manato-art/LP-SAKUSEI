/**
 * 取り込んだ見本（SquadBeyond の Widget・`.sb-custom-part`）の中だけ、SB本体の配信ページと同じ土台にする（2026-10-26）。
 *
 * SB本体の配信ページには、本文（.article-body）の中のすべてに効く指定がある。SBの Widget はこの上で作られている:
 *   - div・p・span・見出しは親の幅を超えない（max-width:100%）
 *   - Widget の画像はブロック・高さは自動（!important）・上下の余白0（記事設定の既定値）
 *   - 段落の余白0・h2 は27px・リンクは下線の青・動画/iframe は上下20px
 *   - normalize は配信ページのもの（figure の余白0・表/入力欄はブラウザの既定）
 * EBIyon はこれを持たず、SB の「編集画面の見本の枠」の土台（WIDGET_RESET_CSS）を当てていたため、
 * 同じ Widget でも見え方が違っていた（例: 15950 の左のロゴが SB では幅0で見えず、EBIyon では見えていた）。
 *
 * そこで取り込んだ見本の中では、WIDGET_RESET_CSS の指定をブラウザの既定に戻し（revert）、SB本体の指定を置く。
 * 頭に id の無い指定なので、Widget 自身の指定（#sb-part-番号.印 …）には SB と同じく負ける。
 * 記事設定から来る文字の大きさ・行間（SBでは .sb-custom に !important）は入れない（EBIyon の記事設定・指示155のまま）。
 * 実測した値は tests/sb-part-css.test.ts。
 */
import { WIDGET_RESET_RULES, widgetResetCss } from './sb-preview-css.ts'

/** SB本体の配信ページの normalize（<head> の1つ目。html・body の指定を除く） */
const SB_NORMALIZE: readonly (readonly [string, string])[] = [
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
  ['figure', 'margin:0'],
  ['hr', 'box-sizing:content-box;height:0'],
  ['pre', 'overflow:auto'],
  ['code,kbd,pre,samp', 'font-family:monospace,monospace;font-size:1em'],
  ['button,input,optgroup,select,textarea', 'color:inherit;font:inherit;margin:0'],
  ['button', 'overflow:visible'],
  ['button,select', 'text-transform:none'],
]

/**
 * SB本体の本文（`body .article-body …`）の指定に、記事設定の既定値（画像・動画）を重ねた結果。
 * 画像の `height:auto!important` は SB では `img:not(.lazyload)` だが、SB は読み込んだ画像から lazyload を外す。
 * EBIyon は遅延読み込みをしない（取り込んだ HTML の lazyload は残ったまま）ので、読み込み後の形で常に当てる。
 */
const SB_ARTICLE: readonly (readonly [string, string])[] = [
  ['h2', 'font-size:27px;margin:0'],
  ['p', 'margin:0'],
  ['a', 'text-decoration:underline;color:#4682b4'],
  ['iframe', 'display:block;max-width:100%;margin-top:20px!important;margin-bottom:20px!important'],
  ['video', 'display:unset!important;max-width:100%;height:auto!important;margin-top:20px!important;margin-bottom:20px!important'],
  ['img', 'display:block!important;max-width:100%;height:auto!important;margin-top:0!important;margin-bottom:0!important'],
]

/** 「,」で並べた頭のそれぞれに prefix を付ける */
function prefixed(selectors: string, prefix: string): string {
  return selectors
    .split(',')
    .map((s) => `${prefix} ${s.trim()}`)
    .join(',')
}

/** 指定の中身の値を、どれもブラウザの既定（revert）にする */
function reverted(declarations: string): string {
  return declarations
    .split(';')
    .map((d) => `${(d.split(':')[0] ?? '').trim()}:revert`)
    .join(';')
}

/** 取り込んだ見本の中の土台（scope＝Widget の外枠を指すセレクタ） */
export function sbPartCss(scope: string): string {
  const part = `${scope} :where(.sb-custom-part)`
  const reverts = WIDGET_RESET_RULES.filter(([selectors]) => selectors !== '').map(
    ([selectors, declarations]) => `${prefixed(selectors, part)}{${reverted(declarations)}}`,
  )
  const normalize = SB_NORMALIZE.map(([selectors, declarations]) => `${prefixed(selectors, part)}{${declarations}}`)
  const article = SB_ARTICLE.map(([selector, declarations]) => `${scope} .sb-custom-part ${selector}{${declarations}}`)
  const width = `${scope} .sb-custom-part,${scope} .sb-custom-part :is(span,p,div,h1,h2,h3,h4,h5,h6){max-width:100%}`
  return [...reverts, ...normalize, width, ...article].join('')
}

/** Widget の土台（これまでの土台＋取り込んだ見本の中の土台）。編集画面の写しは、その場所の範囲で */
export function widgetBaseCss(scope: string): string {
  return widgetResetCss(scope) + sbPartCss(scope)
}

/** 配信・プレビュー・ダウンロード・ヒートマップ用（LPに Widget があるとき <head> に1回だけ置く） */
export const WIDGET_BASE_CSS = widgetBaseCss(':where(.sb-widget-block)')

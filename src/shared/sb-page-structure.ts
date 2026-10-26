/**
 * SquadBeyond の配信ページの形を前提にした見本のために、同じ形を用意する（2026-09-22・見本の全件点検で発覚）。
 *
 * SBの配信ページでは、本文が `.article-body` の中にあり、Widget は1つずつ `.sb-custom` の中にある。
 * ライブラリの見本には、それを探すスクリプト・CSSがある（点検で20件）:
 *   - `document.querySelector('.article-body')` … 画面ワイパーの幕・ページ上部へ戻る・固定ヘッダー・サイドバー
 *   - `btn.closest('.sb-custom')` … 次のWidgetを出す・Widgetの中だけで数える
 *   - `body .article-body .sb-custom img {…}` … 画像の大きさ・余白
 * LP-SAKUSEI のページにはどちらも無く、スクリプトが途中で止まり・CSSが効いていなかった。
 *
 * 使っている見本が入っているLPにだけ足す（入っていないLPは1文字も変えない）。保存データは書き換えない（配信時に足す）。
 * `.article-body` はLPの本文（Widgetを含む）を包む。SBと同じく、その見本のCSSは本文全体に効く。
 *
 * 取り込んだ見本の外枠は、SB本体と同じ div にする（2026-10-26・`.article-body` の直下の div を探す見本のため・sb-parts.ts）。
 */
import { sbPartBlocksAsDiv } from './sb-parts.ts'
import { addWidgetBlockClass } from './widget-editor-attrs.ts'

export function withSbPageStructure(html: string): string {
  const withCustom = html.includes('sb-custom') ? addWidgetBlockClass(html, 'sb-custom') : html
  const shaped = sbPartBlocksAsDiv(withCustom)
  return shaped.includes('article-body') ? `<div class="article-body">${shaped}</div>` : shaped
}

/**
 * 見本（Widgetライブラリのカード）の iframe の srcdoc を読み書きする（2026-09-22・見本の点検と作り変え）。
 *
 * 採取したカードの srcdoc は、ブラウザが書き出したとおり `& < > "` の4つがすべて文字参照になっている
 * （全カテゴリーで確認: 生の `<` `>` は0件）。ほかの文字参照は1件だけ（コメントの中の `&nbsp;`）。
 * なので「戻す → 直す → 4つを付け直す」で、直していない見本は1文字も変わらない（mapSrcdocs は直した見本だけ書き直す）。
 */

export function decodeSrcdoc(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

export function encodeSrcdoc(html: string): string {
  return html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** カードの一覧（HTML）の中の srcdoc それぞれに fix をかける。ほかの部分は触らない */
export function mapSrcdocs(gridHtml: string, fix: (html: string, index: number) => string): string {
  let index = 0
  return gridHtml.replace(/(\ssrcdoc=")([^"]*)(")/g, (whole, open: string, value: string, close: string) => {
    const before = decodeSrcdoc(value)
    const after = fix(before, index)
    index += 1
    return after === before ? whole : `${open}${encodeSrcdoc(after)}${close}`
  })
}

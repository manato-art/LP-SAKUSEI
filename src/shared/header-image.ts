/**
 * ヘッダー画像を、本文の上の画像にする（公開LP・プレビュー・ヒートマップのLP表示で共通・2026-09-11）。
 *
 * エディタはヘッダー画像を、本文の先頭に `<!--header-image:画像のURL-->` として保存する（src/app/pages/editor-html.ts）。
 * プレビューはこれを画像にして出していたが、公開LPはコメントのまま送っていて、見た人にはヘッダー画像が出ていなかった。
 * URL は属性値として出すので、記号はすべてエスケープする（タグを壊させない）。
 */

/** 本文の先頭にあるヘッダー画像の目印 */
const HEADER_IMAGE_COMMENT = /^<!--header-image:(.+?)-->/

/** プレビューで使っていた見た目のまま（上に張り付く・高さ200pxまで） */
const HEADER_IMAGE_STYLE = 'display:block;width:100%;object-fit:cover;position:sticky;top:0;z-index:10;max-height:200px'

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** 本文を「ヘッダー画像のタグ」と「残りの本文」に分ける。ヘッダー画像が無ければタグは空 */
export function splitHeaderImage(html: string): { headerHtml: string; body: string } {
  const match = HEADER_IMAGE_COMMENT.exec(html)
  if (match === null) return { headerHtml: '', body: html }
  return {
    headerHtml: `<img src="${escapeAttribute(match[1] ?? '')}" style="${HEADER_IMAGE_STYLE}" alt="ヘッダー画像">`,
    body: html.slice(match[0].length),
  }
}

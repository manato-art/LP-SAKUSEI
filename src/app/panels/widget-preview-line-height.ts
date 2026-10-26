/**
 * Widget編集の見たまま画面（widget-visual-editor.ts）の行間。配信と同じにする（WYSIWYG）。
 * 自作の Widget は指示155の1.5（配信の `section.sb-widget-block{line-height:1.5}`）。
 * 取り込んだ見本は SB本体と同じく記事設定の行間を継ぐ（2026-10-27 本人選択）。記事設定に行間が無ければ配信と同じく normal。
 */
export function previewLineHeight(html: string, articleLineHeight: string): string {
  if (!/class="sb-custom-part[\s"]/.test(html)) return '1.5'
  return articleLineHeight === '' ? 'normal' : articleLineHeight
}

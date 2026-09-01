/**
 * 配信・プレビュー・ダウンロードで、LP本文（Quillが書き出したHTML）を**編集画面と同じ見た目**で
 * 描くための土台CSS。
 *
 * エディタ内では quill.core.css が `.ql-editor .ql-align-center{text-align:center}` のように
 * `.ql-editor` 配下で効くが、配信ページは `.ql-editor` の外なので、同じ整列/インデントを
 * **非スコープ**で当て直す必要がある（これが無いと配信で全部左揃えになる）。
 */
export const LP_BASE_CSS = [
  '.ql-align-center{text-align:center}',
  '.ql-align-right{text-align:right}',
  '.ql-align-justify{text-align:justify}',
  // Quill のインデント（ql-indent-1〜8）。core.css と同じ 3em 刻み。
  '.ql-indent-1{padding-left:3em}',
  '.ql-indent-2{padding-left:6em}',
  '.ql-indent-3{padding-left:9em}',
  '.ql-indent-4{padding-left:12em}',
  '.ql-indent-5{padding-left:15em}',
  '.ql-indent-6{padding-left:18em}',
  '.ql-indent-7{padding-left:21em}',
  '.ql-indent-8{padding-left:24em}',
  // 画像・動画は枠内に収める
  'img{max-width:100%;height:auto}',
  'video{max-width:100%;height:auto;display:block}',
].join('')

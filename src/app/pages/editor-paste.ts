/**
 * ほかのサイト・資料からコピーして貼ったときは、書式を持ち込まず文字だけを貼る（2026-10-27 本人「書式はコピーしないで」）。
 * 貼った文字は、貼った所の文字と同じ見た目（そこの書体・大きさ・太字など）になる。
 *
 * それまで（指示⑩）は、貼った中身から書体・大きさ・色・背景を外し、太字・斜め・リンク・見出しは残していた。
 * それでも本人「貼っただけで別のフォントになる」「フォントを選んでも変わらない」が起きていた（コピー元の作りによって
 * 残した形が書体を持ち込む）。外す物を数える形をやめ、文字だけにする。
 *
 * - 同じ編集画面の中でコピー・切り取りした物は、書式ごとそのまま貼る（コピーのときに印を一緒に入れて見分ける）
 * - 文字の無い貼り付け（画像だけ等）は横取りしない（今までどおりの入れ方に任せる）
 * - Versionの編集画面（Quill）と、Widget編集の見たまま画面（widget-visual-editor.ts）の両方で使う
 */
import type Quill from 'quill'

/** 同じ編集画面からコピーした印（クリップボードに一緒に入れる） */
export const INTERNAL_COPY_TYPE = 'application/x-lp-sakusei-copy'

/** 貼るときに持ち込まない行の書式（貼った所の行のままにする） */
const LINE_FORMATS: ReadonlySet<string> = new Set(['header', 'list', 'blockquote', 'code-block', 'align', 'indent', 'direction'])

/** HTML の文字だけ（文字の貼り付けが無いときの予備。段落・改行は改行にする） */
function textOfHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n+$/, '')
}

/** 貼る文字（書式なし）。文字が何も無ければ null（横取りしない） */
export function plainPasteText(data: Pick<DataTransfer, 'getData'> | null | undefined): string | null {
  if (data === null || data === undefined) return null
  const text = data.getData('text/plain')
  const plain = text !== '' ? text : textOfHtml(data.getData('text/html'))
  const normalized = plain.replace(/\r\n?/g, '\n')
  return normalized === '' ? null : normalized
}

/** Versionの編集画面に貼るときに使う Quill の一部（テストでは代わりを渡す） */
export interface PlainPasteQuill {
  getSelection(focus?: boolean): { index: number; length: number } | null
  getFormat(index: number, length: number): Record<string, unknown>
  deleteText(index: number, length: number, source?: string): unknown
  insertText(index: number, text: string, formats: Record<string, unknown>, source?: string): unknown
  setSelection(index: number, length: number, source?: string): unknown
}

/** 書式なしの文字を、貼った所の文字と同じ見た目で入れる（選んでいた文字は置き換える） */
export function pastePlainText(quill: PlainPasteQuill, text: string): void {
  const range = quill.getSelection(true)
  if (range === null) return
  // 貼った所の文字の見た目（太字・書体など。行の書式は貼った所の行のまま）
  const here = Object.fromEntries(Object.entries(quill.getFormat(range.index, 0)).filter(([name]) => !LINE_FORMATS.has(name)))
  if (range.length > 0) quill.deleteText(range.index, range.length, 'user')
  quill.insertText(range.index, text, here, 'user')
  quill.setSelection(range.index + text.length, 0, 'user')
}

/** 同じ編集画面の中でコピー・切り取りしたとき、印を一緒に入れる（貼るときに見分ける） */
export function markInternalCopy(el: HTMLElement): void {
  const mark = (e: ClipboardEvent): void => {
    e.clipboardData?.setData(INTERNAL_COPY_TYPE, '1')
  }
  el.addEventListener('copy', mark)
  el.addEventListener('cut', mark)
}

/** ほかからの貼り付けか（同じ編集画面からコピーした印が無い） */
export const isExternalPaste = (e: ClipboardEvent): boolean => !(e.clipboardData?.types.includes(INTERNAL_COPY_TYPE) ?? false)

/** Versionの編集画面の貼り付けを配線する（Quill を作ったあとに呼ぶ＝Quill のコピーの後に印を足す） */
export function wireEditorPaste(quill: Quill): void {
  const root = quill.root
  markInternalCopy(root)
  // Quill の貼り付け（中身を書式ごと取り込む）より先に受ける（capture）。ほかからの文字は、ここで文字だけにして入れる
  root.addEventListener(
    'paste',
    (e) => {
      if (!isExternalPaste(e)) return
      const text = plainPasteText(e.clipboardData)
      if (text === null) return
      e.preventDefault()
      e.stopPropagation()
      pastePlainText(quill as unknown as PlainPasteQuill, text)
    },
    true,
  )
}

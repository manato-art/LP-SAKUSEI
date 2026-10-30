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
 * - 画像の入った中身（SB のLPを全部選んで貼る等）は、画像も入れる（EBIyon に写して置く・リンクは付けない・paste-images.ts）。
 *   2026-10-31 本人「文字はコピーできるけど、画像がそのままコピーできない」。Versionの編集画面だけ
 * - SB の Widget（div.sb-custom）は、見た目のまま EBIyon の Widget として入れる（動きはコピーに入らない・paste-images.ts）
 * - Versionの編集画面（Quill）と、Widget編集の見たまま画面（widget-visual-editor.ts）の両方で使う
 */
import type Quill from 'quill'
import { api } from '../api.ts'
import { toast } from '../ui.ts'
import { pasteParts, pasteWithImages, type ImagePasteQuill, type PastePart } from './paste-images.ts'

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

/** 貼った中身に画像か SB の Widget があれば、文字・画像・Widget に分けたもの。無ければ null（文字だけの貼り付けにする） */
function partsWithImages(data: DataTransfer | null): PastePart[] | null {
  const html = data?.getData('text/html') ?? ''
  if (!/<img\b|sb-custom/i.test(html)) return null
  const parts = pasteParts(new DOMParser().parseFromString(html, 'text/html').body)
  return parts.some((part) => part.kind !== 'text') ? parts : null
}

/** 画像を EBIyon に写してから、元の並びのまま入れる。何枚入ったか・写せなかったかを知らせる */
async function pasteImagesIntoEditor(quill: Quill, parts: readonly PastePart[], versionUid: string): Promise<void> {
  const count = parts.reduce((n, part) => n + (part.kind === 'image' ? 1 : part.kind === 'widget' ? part.images.length : 0), 0)
  toast(count === 0 ? '貼り付けています…' : `画像${String(count)}枚をEBIyonに写しています…（少し時間がかかります）`)
  const copy = (src: string): Promise<string | null> =>
    versionUid === '' ? Promise.resolve(null) : api.copyRemoteImage(versionUid, src).then((res) => res.url, () => null)
  const { images, widgets, failed } = await pasteWithImages(quill as unknown as ImagePasteQuill, parts, copy)
  const done = `画像${String(images)}枚${widgets > 0 ? `・Widget${String(widgets)}個（見た目だけ・動きは入りません）` : ''}を入れました`
  if (failed === 0) toast(done)
  else toast(`${done}。画像${String(failed)}枚は写せませんでした（元のページで画像を保存して、入れ直してください）`, 'error')
}

/**
 * Versionの編集画面の貼り付けを配線する（Quill を作ったあとに呼ぶ＝Quill のコピーの後に印を足す）。
 * versionUid: いま直しているVersion（画像を写すときに使う）
 */
export function wireEditorPaste(quill: Quill, versionUid: () => string): void {
  const root = quill.root
  markInternalCopy(root)
  // Quill の貼り付け（中身を書式ごと取り込む）より先に受ける（capture）。ほかからの文字は、ここで文字だけにして入れる
  root.addEventListener(
    'paste',
    (e) => {
      if (!isExternalPaste(e)) return
      const parts = partsWithImages(e.clipboardData)
      if (parts !== null) {
        e.preventDefault()
        e.stopPropagation()
        void pasteImagesIntoEditor(quill, parts, versionUid())
        return
      }
      const text = plainPasteText(e.clipboardData)
      if (text === null) return
      e.preventDefault()
      e.stopPropagation()
      pastePlainText(quill as unknown as PlainPasteQuill, text)
    },
    true,
  )
}

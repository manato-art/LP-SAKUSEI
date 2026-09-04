/**
 * 画像・GIF・動画をエディタ（Quill）へ挿入する共通処理。
 * ①ツールバーの「画像」ボタン ②右レール「外部サーバー画像アップロード」 の2つのボタンと、
 * ③キャンバスへの**ドラッグ＆ドロップ**（カーソル位置へ挿入）から使う。
 *
 * - GIF は画像（image/gif）なので `<img>` 埋め込みでそのまま動く（アニメGIF可）。
 * - 動画（video/*）は、Quill 標準の video ブロット（URL埋め込み用の iframe）では
 *   ローカルファイルを再生できないので、`<video controls>` を描く**独自ブロット**を登録する。
 *
 * 本番サーバーへは一切上げない（§3-2）。選んだファイルはその場で dataURL 化してクローン内で完結する。
 */
import type Quill from 'quill'
import { toast } from '../ui.ts'
import { readFileAsDataUrl } from './webp-convert.ts'
import { uploadImage } from './upload.ts'

type MediaFormat = 'image' | 'sbvideo'

/** MIMEから埋め込み種別を決める（動画だけ独自ブロット、画像・GIFは標準の image） */
export function embedFormat(mime: string): MediaFormat {
  return mime.startsWith('video/') ? 'sbvideo' : 'image'
}

/** 画像（GIF含む）か動画のファイルだけ受け付ける */
export function isInsertableMedia(file: { type: string }): boolean {
  return file.type.startsWith('image/') || file.type.startsWith('video/')
}

/** 挿入完了トーストの文言（画像/動画の件数を出す・純粋関数） */
export function mediaInsertedMessage(images: number, videos: number): string {
  const parts: string[] = []
  if (images > 0) parts.push(`画像${images}件`)
  if (videos > 0) parts.push(`動画${videos}件`)
  const what = parts.length > 0 ? parts.join('・') : 'メディア'
  return `${what}を挿入しました（クローン内保存・外部サーバーへは送信しません）`
}

/**
 * ①②のボタン共通: ファイル選択（画像/GIF/動画）→ カーソル位置へ挿入。
 * 動画ブロットは `media-blots.ts` の `registerMediaBlots()` がエディタ起動時に登録済み。
 */
export function pickAndInsertMedia(quill: Quill): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*,video/*'
  input.multiple = true
  input.style.display = 'none'
  document.body.append(input)
  input.addEventListener('change', () => {
    const files = [...(input.files ?? [])].filter(isInsertableMedia)
    input.remove()
    if (files.length === 0) return
    const range = quill.getSelection(true)
    const index = range?.index ?? quill.getLength()
    void insertMediaFilesAt(quill, files, index)
  })
  input.click()
}

/** ③ キャンバスへのドラッグ＆ドロップを配線する（ドロップ位置のカーソルへ挿入） */
export function wireMediaDrop(quill: Quill): void {
  const root = quill.root
  if (root.dataset['sbMediaDrop'] === 'true') return
  root.dataset['sbMediaDrop'] = 'true'

  root.addEventListener('dragover', (event) => {
    if (!dragHasFiles(event)) return
    // 「ここに落とせる」を示すため既定を止める（これが無いと drop が発火しない）
    event.preventDefault()
    const dt = event.dataTransfer
    if (dt !== null) dt.dropEffect = 'copy'
  })
  root.addEventListener('drop', (event) => {
    const files = [...(event.dataTransfer?.files ?? [])].filter(isInsertableMedia)
    // 画像・動画以外のドロップ（テキスト等）は Quill 既定の挙動に任せる
    if (files.length === 0) return
    event.preventDefault()
    event.stopPropagation()
    const index = insertionIndexAt(quill, event.clientX, event.clientY)
    void insertMediaFilesAt(quill, files, index)
  })
}

/** 複数ファイルを指定位置から順に挿入し、最後にカーソルを送る */
export async function insertMediaFilesAt(
  quill: Quill,
  files: readonly File[],
  startIndex: number,
): Promise<void> {
  let index = startIndex
  let images = 0
  let videos = 0
  for (const file of files) {
    // サーバーにアップロードしてURLを取得（data URLだと本家に貼れない）
    const dataUrl = await readFileAsDataUrl(file)
    const url = await uploadImage(file.name, dataUrl)
    if (url === '') continue
    const format = embedFormat(file.type)
    quill.insertEmbed(index, format, url, 'user')
    index += 1
    if (format === 'sbvideo') videos += 1
    else images += 1
  }
  quill.setSelection(index, 0, 'user')
  if (images > 0 || videos > 0) toast(mediaInsertedMessage(images, videos))
}

function dragHasFiles(event: DragEvent): boolean {
  return [...(event.dataTransfer?.types ?? [])].includes('Files')
}

/** ドロップ座標 → Quill 上の挿入インデックス（ネイティブのキャレットを Quill に読ませる） */
function insertionIndexAt(quill: Quill, x: number, y: number): number {
  const fallback = quill.getSelection()?.index ?? Math.max(0, quill.getLength() - 1)
  const doc = quill.root.ownerDocument
  const caret = caretRangeFromPoint(doc, x, y)
  if (caret === null || !quill.root.contains(caret.startContainer)) return fallback
  quill.focus()
  const selection = doc.getSelection()
  if (selection === null) return fallback
  selection.removeAllRanges()
  selection.addRange(caret)
  quill.update('user')
  return quill.getSelection()?.index ?? fallback
}

interface CaretDoc {
  caretRangeFromPoint?: (x: number, y: number) => Range | null
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
}

/** Chrome/Safari=caretRangeFromPoint / Firefox=caretPositionFromPoint の差を吸収する */
function caretRangeFromPoint(doc: Document, x: number, y: number): Range | null {
  const d = doc as unknown as CaretDoc
  if (typeof d.caretRangeFromPoint === 'function') return d.caretRangeFromPoint(x, y)
  const pos = d.caretPositionFromPoint?.(x, y) ?? null
  if (pos === null) return null
  const range = doc.createRange()
  range.setStart(pos.offsetNode, pos.offset)
  range.collapse(true)
  return range
}

/**
 * 画像・GIF・動画をエディタ（Quill）へ挿入する共通処理。
 * ①ツールバーの「画像」ボタン ②右レール「外部サーバー画像アップロード」 の2つのボタンと、
 * ③キャンバスへの**ドラッグ＆ドロップ・貼り付け**（落とした・貼った位置へ挿入）から使う。
 *
 * ③は Quill の uploader 1か所で受ける（mediaUploaderOptions）。以前は自前のドロップの受け口も持っていて、
 * Quill の uploader（PNG・JPEG を自分で入れる）と両方が入れ、PNG・JPEG を落とすと2枚入っていた
 * （2026-10-18 本人「画像とか動画貼ると、2まい貼られてしまう」）。
 *
 * - GIF は画像（image/gif）なので `<img>` 埋め込みでそのまま動く（アニメGIF可）。
 * - 動画（video/*）は、Quill 標準の video ブロット（URL埋め込み用の iframe）では
 *   ローカルファイルを再生できないので、`<video controls>` を描く**独自ブロット**を登録する。
 *
 * 本番サーバーへは一切上げない（§3-2）。選んだファイルはその場で dataURL 化してクローン内で完結する。
 */
import type Quill from 'quill'
import { toast } from '../ui.ts'
import { convertImageToWebP } from './webp-convert.ts'

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
  return `${what}を挿入しました（このシステム内に保存・外部サーバーへは送信しません）`
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

/**
 * ③ 落とす・貼り付けるで受ける形式（Quill の uploader は形式の一覧で選ぶ。既定は PNG・JPEG だけ）。
 * 以前の自前の受け口と同じく、画像（GIF・WebP 含む）と動画を受ける
 */
export const MEDIA_MIMETYPES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
  'image/svg+xml',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/ogg',
  'video/x-m4v',
]

/** Quill の uploader の設定（Quill を作るときに modules.uploader へ渡す）。落とした・貼った位置へ自前の入れ方で入れる */
export function mediaUploaderOptions(): {
  mimetypes: string[]
  handler: (this: { quill: Quill }, range: { index: number; length: number }, files: File[]) => Promise<void>
} {
  return {
    mimetypes: [...MEDIA_MIMETYPES],
    handler(range, files) {
      // 文字を選んだまま貼ったときは、選んだ文字と入れ替える（Quill の既定と同じ）
      if (range.length > 0) this.quill.deleteText(range.index, range.length, 'user')
      return insertMediaFilesAt(this.quill, files, range.index)
    },
  }
}

/**
 * ③ キャンバスへのドラッグで「ここに落とせる」を出す。落としたファイルを入れるのは Quill の uploader
 * （mediaUploaderOptions）。ここで入れると Quill の分と合わせて2枚入る
 */
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
    // 指示㊿③: 画像は WebP に変換してからエディタへ挿入（動画/GIFはそのまま）
    const url = await convertImageToWebP(file)
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

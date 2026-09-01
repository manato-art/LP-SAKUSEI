/**
 * 画像をエディタ（Quill）のカーソル位置へ挿入する共通処理。
 * 右レール「外部サーバー画像アップロード」とツールバーの「画像」ボタンの両方から使う。
 *
 * 本番サーバーへは一切上げない（§3-2）。ブラウザ標準のファイル選択で選んだ画像を
 * その場で dataURL にして挿入＝クローン内で完結する。
 */
import type Quill from 'quill'
import { toast } from '../ui.ts'

export function pickAndInsertImage(quill: Quill): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.style.display = 'none'
  document.body.append(input)
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    input.remove()
    if (file === undefined) return
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      const dataUrl = String(reader.result ?? '')
      if (dataUrl === '') return
      const range = quill.getSelection(true)
      const index = range?.index ?? quill.getLength()
      quill.insertEmbed(index, 'image', dataUrl, 'user')
      quill.setSelection(index + 1, 0, 'user')
      toast('画像を挿入しました（クローン内保存・外部サーバーへは送信しません）')
    })
    reader.readAsDataURL(file)
  })
  input.click()
}

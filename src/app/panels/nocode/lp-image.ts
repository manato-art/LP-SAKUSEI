/**
 * 「型から作る」の画像の選び方（2026-09-22・ノーコードでWidgetを作る③）。
 *
 * 選んだ画像を、LPに入れてよい大きさにして data URL で返す（縮めるかどうかは lp-image-plan.ts）。
 * 縮めた方が重くなるときは元のまま。WebPで書き出せないブラウザでは、写真はJPEG・それ以外はPNG。
 * 向き（スマホ写真の回転情報）はブラウザが描くときに直す。
 */
import { planLpImage } from './lp-image-plan.ts'

function readAsDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/** 受け付ける画像の形（画像と動画を一緒に選ぶとき＝lp-media.ts も使う） */
export const LP_IMAGE_TYPES: readonly string[] = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']

/** 選んだ画像を、LPに入れてよい大きさの data URL に（読めなければ null） */
export async function prepareLpImage(file: File): Promise<string | null> {
  const original = await readAsDataUrl(file)
  if (original === null) return null
  const img = await loadImage(original)
  if (img === null) return null
  const plan = planLpImage({ type: file.type, bytes: file.size, width: img.naturalWidth, height: img.naturalHeight })
  if (plan.action === 'keep') return original
  const canvas = document.createElement('canvas')
  canvas.width = plan.width
  canvas.height = plan.height
  const context = canvas.getContext('2d')
  if (context === null) return original
  context.drawImage(img, 0, 0, plan.width, plan.height)
  const webp = canvas.toDataURL('image/webp', 0.85)
  const written = webp.startsWith('data:image/webp')
    ? webp
    : file.type === 'image/jpeg'
      ? canvas.toDataURL('image/jpeg', 0.85)
      : canvas.toDataURL('image/png')
  return written.length < original.length ? written : original
}

/** 画像を選んでもらう（やめたら null）。画像として読めないファイルも null */
export function pickLpImage(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = LP_IMAGE_TYPES.join(',')
    input.style.display = 'none'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      input.remove()
      if (file === undefined) {
        resolve(null)
        return
      }
      prepareLpImage(file).then(resolve, () => resolve(null))
    })
    // 選ぶ画面を閉じただけのとき（対応しているブラウザ）
    input.addEventListener('cancel', () => {
      input.remove()
      resolve(null)
    })
    document.body.append(input)
    input.click()
  })
}

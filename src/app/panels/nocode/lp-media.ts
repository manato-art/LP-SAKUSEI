/**
 * 画像でも動画でも選べる選び方（2026-10-27 本人「画像を入れられる場所は画像と動画の両方、動画を入れられる所も画像を。動画でも画像でも入ればいい」）。
 *
 * 画像は lp-image.ts と同じく LP に入れてよい大きさにし、動画は lp-video.ts と同じ決まり（mp4・webm・30MBまで）で受ける。
 * どちらを選んだかは、返した data URL の形（data:image/… か data:video/…）で見分ける（templates/kit.ts の isVideoMedia）。
 */
import { toast } from '../../ui.ts'
import { LP_IMAGE_TYPES, prepareLpImage } from './lp-image.ts'
import { LP_VIDEO_TYPES, readLpVideo } from './lp-video.ts'

/** 選んだファイルを data URL に（画像・動画でない・使えないときは null。使えない理由はその場で知らせる） */
export function readLpMedia(file: File): Promise<string | null> {
  if (file.type.startsWith('video/')) return readLpVideo(file)
  if (LP_IMAGE_TYPES.includes(file.type)) return prepareLpImage(file)
  toast('画像（png・jpg・webp・gif・avif）か動画（mp4・webm）を選んでください', 'error')
  return Promise.resolve(null)
}

/** 画像か動画を選んでもらう（やめた・使えないファイルなら null） */
export function pickLpMedia(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = [...LP_IMAGE_TYPES, ...LP_VIDEO_TYPES].join(',')
    input.style.display = 'none'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      input.remove()
      if (file === undefined) {
        resolve(null)
        return
      }
      readLpMedia(file).then(resolve, () => resolve(null))
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

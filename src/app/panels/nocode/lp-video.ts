/**
 * 「部品を積んで作る」の動画の選び方（2026-09-22・本人の依頼。ノーコードでWidgetを作る④）。
 *
 * mp4・webm だけ受け付ける。保存のときに別ファイル（/uploads）へ出せるのはこの2つだけで
 * （mock-server/lib/uploads.ts）、iPhone の .mov はSafari以外で再生できないことが多いため。
 * LPが重くなりすぎないよう 30MB まで。
 */
import { toast } from '../../ui.ts'

/** これより大きい動画は入れない（LPの表示が遅くなる） */
export const LP_VIDEO_MAX_BYTES = 30 * 1024 * 1024
const ACCEPTED = ['video/mp4', 'video/webm']

function readAsDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}

/** 動画を選んでもらう（やめた・使えない動画なら null。使えない理由はその場で知らせる） */
export function pickLpVideo(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = ACCEPTED.join(',')
    input.style.display = 'none'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      input.remove()
      if (file === undefined) {
        resolve(null)
        return
      }
      if (!ACCEPTED.includes(file.type)) {
        toast('mp4 か webm の動画を選んでください（iPhoneの動画は「互換性優先」で撮るか、mp4に書き出してください）', 'error')
        resolve(null)
        return
      }
      if (file.size > LP_VIDEO_MAX_BYTES) {
        toast('動画が大きすぎます（30MBまで）。短く切るか、画質を下げて書き出してください', 'error')
        resolve(null)
        return
      }
      readAsDataUrl(file).then(resolve, () => resolve(null))
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

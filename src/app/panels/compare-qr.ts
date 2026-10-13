/**
 * 比較モードの「QRコード」（2026-09-24 全体点検17: 「QRコードは準備中です」と出るだけだった）。
 * プレビューのURLをQRコードにして、スマホのカメラで読んで実機で確かめられるようにする。
 */
import QRCode from 'qrcode'
import { toast } from '../ui.ts'

let openPopover: HTMLElement | null = null

export function closeQrPopover(): void {
  openPopover?.remove()
  openPopover = null
}

/** ボタンの下にQRコードを出す（もう一度押すか、外を押すと閉じる） */
export function toggleQrPopover(anchor: HTMLElement, url: string): void {
  if (openPopover !== null) {
    closeQrPopover()
    return
  }
  const pop = document.createElement('div')
  pop.setAttribute('data-cmp-qr', 'true')
  pop.setAttribute('role', 'dialog')
  pop.setAttribute('aria-label', 'プレビューのQRコード')
  const rect = anchor.getBoundingClientRect()
  pop.style.cssText =
    `position:fixed;top:${Math.round(rect.bottom + 6)}px;left:${Math.round(Math.max(8, rect.right - 212))}px;z-index:10050;` +
    'width:212px;padding:12px;border-radius:10px;background:var(--sb-c-ffffff, #FFFFFF);' +
    'box-shadow:0 6px 24px rgba(0,0,0,.18);text-align:center;font-size:12px;line-height:1.6;color:var(--sb-c-333333, #333333)'
  const img = document.createElement('img')
  img.alt = 'プレビューのQRコード'
  img.width = 188
  img.height = 188
  img.style.cssText = 'display:block;margin:0 auto 6px;image-rendering:pixelated'
  const note = document.createElement('div')
  note.textContent = 'スマホのカメラで読むと、このプレビューを開けます（計測はされません）'
  pop.append(img, note)
  document.body.append(pop)
  openPopover = pop
  void QRCode.toDataURL(url, { margin: 1, width: 188, errorCorrectionLevel: 'M' }).then(
    (dataUrl) => {
      img.src = dataUrl
    },
    () => {
      closeQrPopover()
      toast('QRコードを作れませんでした', 'error')
    },
  )
  // 外を押したら閉じる（開いたクリックそのものでは閉じない）
  setTimeout(() => {
    const onOutside = (event: MouseEvent): void => {
      if (openPopover === null) {
        document.removeEventListener('click', onOutside, true)
        return
      }
      if (event.target instanceof Node && (openPopover.contains(event.target) || anchor.contains(event.target))) return
      closeQrPopover()
      document.removeEventListener('click', onOutside, true)
    }
    document.addEventListener('click', onOutside, true)
  }, 0)
}

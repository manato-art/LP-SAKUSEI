/**
 * 比較モードの「QRコード」（2026-09-24 全体点検17: 「QRコードは準備中です」と出るだけだった）。
 * プレビューのURLをQRコードにして、スマホのカメラで読んで実機で確かめられるようにする。
 *
 * プレビュー画面のURLカード（プレビューURL / 配信URL）のQRコードのボタンも同じ部品を使う
 * （2026-10-13。押しても何も起きなかった）。どのURLのQRコードかで、名前と下の説明を変える。
 */
import QRCode from 'qrcode'
import { toast } from '../ui.ts'

/** QRコードの名前（読み上げ用）と、下に添える説明 */
export interface QrTexts {
  label: string
  note: string
}

export const PREVIEW_QR_TEXTS: QrTexts = {
  label: 'プレビューのQRコード',
  note: 'スマホのカメラで読むと、このプレビューを開けます（計測はされません）',
}

/** 配信URLは本番のページ。開いた回数はレポートに数えられるので、そう伝える */
export const DELIVERY_QR_TEXTS: QrTexts = {
  label: '配信URLのQRコード',
  note: 'スマホのカメラで読むと、配信ページを開けます（開いた回数は計測されます）',
}

let openPopover: HTMLElement | null = null
/** いま開いているQRコードを出したボタン（別のボタンを押したら、そちらのQRコードに替える） */
let openAnchor: HTMLElement | null = null

export function closeQrPopover(): void {
  openPopover?.remove()
  openPopover = null
  openAnchor = null
}

/** ボタンの下にQRコードを出す（もう一度押すか、外を押すと閉じる） */
export function toggleQrPopover(anchor: HTMLElement, url: string, texts: QrTexts = PREVIEW_QR_TEXTS): void {
  if (openPopover !== null) {
    const isSameButton = openAnchor === anchor
    closeQrPopover()
    if (isSameButton) return
  }
  const pop = document.createElement('div')
  pop.setAttribute('data-cmp-qr', 'true')
  pop.setAttribute('role', 'dialog')
  pop.setAttribute('aria-label', texts.label)
  const rect = anchor.getBoundingClientRect()
  pop.style.cssText =
    `position:fixed;top:${Math.round(rect.bottom + 6)}px;left:${Math.round(Math.max(8, rect.right - 212))}px;z-index:10050;` +
    'width:212px;padding:12px;border-radius:10px;background:var(--sb-c-ffffff, #FFFFFF);' +
    'box-shadow:0 6px 24px rgba(0,0,0,.18);text-align:center;font-size:12px;line-height:1.6;color:var(--sb-c-333333, #333333)'
  const img = document.createElement('img')
  img.alt = texts.label
  img.width = 188
  img.height = 188
  img.style.cssText = 'display:block;margin:0 auto 6px;image-rendering:pixelated'
  const note = document.createElement('div')
  note.textContent = texts.note
  pop.append(img, note)
  document.body.append(pop)
  openPopover = pop
  openAnchor = anchor
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

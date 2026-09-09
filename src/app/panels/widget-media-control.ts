/**
 * Widget内の画像・動画をクリックしたときに出る小さな操作パネル（widget-editor.ts から分離）。
 *
 * 幅（%）のスライダーと、画像の差し替え。変更したら contentDiv に input を投げて
 * コードパネル側の textarea を追従させる（そうしないと「更新する」で変更が失われる）。
 */
import { FONT, COLOR } from './widget-editor-theme.ts'

/** PCから画像ファイルを選ばせ、data URL として返す（キャンセル時は null）。 */
export function pickImageDataUrl(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.style.display = 'none'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      input.remove()
      if (file === undefined) {
        resolve(null)
        return
      }
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    })
    document.body.append(input)
    input.click()
  })
}
/* 画像/動画クリック時の操作パネル（差し替え＋サイズ変更）。同時に1つだけ表示する。 */
let mediaControlEl: HTMLElement | null = null
let mediaControlOutside: ((e: MouseEvent) => void) | null = null
export function closeMediaControl(): void {
  if (mediaControlEl !== null) {
    mediaControlEl.remove()
    mediaControlEl = null
  }
  if (mediaControlOutside !== null) {
    document.removeEventListener('mousedown', mediaControlOutside, true)
    mediaControlOutside = null
  }
}
/** クリックされた画像/動画の近くに、差し替え・サイズ変更(幅%)のコントロールを表示する。 */
export function openMediaControl(media: HTMLElement, contentDiv: HTMLElement): void {
  closeMediaControl()
  const isImg = media.tagName === 'IMG'
  const sync = (): void => {
    contentDiv.dispatchEvent(new Event('input', { bubbles: true }))
  }

  const box = document.createElement('div')
  box.style.cssText =
    `position:fixed;z-index:9500;background:#fff;border:1px solid #ddd;border-radius:8px;` +
    `box-shadow:0 4px 18px rgba(0,0,0,.18);padding:10px 12px;display:flex;flex-direction:column;` +
    `gap:8px;font:12px/1.4 ${FONT};min-width:236px`
  box.addEventListener('click', (e) => e.stopPropagation())

  if (isImg) {
    const rep = document.createElement('button')
    rep.type = 'button'
    rep.textContent = 'PCから画像を差し替え'
    rep.style.cssText =
      `border:none;background:${COLOR.brand};color:#fff;border-radius:6px;padding:8px 10px;` +
      `cursor:pointer;font:12px/1 ${FONT}`
    rep.addEventListener('click', () => {
      void pickImageDataUrl().then((dataUrl) => {
        if (dataUrl === null) return
        media.setAttribute('src', dataUrl)
        media.removeAttribute('srcset')
        sync()
      })
    })
    box.append(rep)
  }

  // サイズ（幅%）。親要素に対する現在幅から初期値を出す。
  const parentW = media.parentElement?.getBoundingClientRect().width || media.getBoundingClientRect().width || 1
  const rectW = media.getBoundingClientRect().width
  const styleW = media.style.width
  // 計測できない（幅0＝レイアウト前など）ときは 100% を既定にする（10%に潰れるのを防ぐ）
  const measured = rectW > 4 && parentW > 8 ? Math.round((rectW / parentW) * 100) : 100
  const curPct = styleW.endsWith('%') && !Number.isNaN(parseFloat(styleW))
    ? Math.max(10, Math.min(100, Math.round(parseFloat(styleW))))
    : Math.max(10, Math.min(100, measured))

  // 指示154: 画像を LP と同じく中央寄せにする（display:block + margin:auto）。
  const centerMedia = (): void => {
    media.style.setProperty('display', 'block', 'important')
    media.style.setProperty('margin-left', 'auto', 'important')
    media.style.setProperty('margin-right', 'auto', 'important')
  }

  const row = document.createElement('div')
  row.style.cssText = 'display:flex;align-items:center;gap:8px'
  const lbl = document.createElement('span')
  lbl.textContent = 'サイズ' // 指示154: 「幅」ではなく「サイズ」
  lbl.style.color = '#555'
  const slider = document.createElement('input')
  slider.type = 'range'
  slider.min = '10'
  slider.max = '100'
  slider.step = '1'
  slider.value = String(curPct)
  slider.style.flex = '1'
  const num = document.createElement('span')
  num.textContent = `${curPct}%`
  num.style.cssText = 'min-width:40px;text-align:right;color:#333;font-variant-numeric:tabular-nums'
  slider.addEventListener('input', () => {
    const v = slider.value
    media.style.setProperty('width', `${v}%`, 'important')
    media.style.setProperty('height', 'auto', 'important')
    media.removeAttribute('width')
    media.removeAttribute('height')
    centerMedia() // 指示154: サイズ変更時に中央寄せ
    num.textContent = `${v}%`
    sync()
  })
  row.append(lbl, slider, num)
  box.append(row)

  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.textContent = '閉じる'
  closeBtn.style.cssText =
    `border:1px solid #ddd;background:#fff;color:#555;border-radius:6px;padding:6px 10px;` +
    `cursor:pointer;font:12px/1 ${FONT}`
  closeBtn.addEventListener('click', closeMediaControl)
  box.append(closeBtn)

  document.body.append(box)
  mediaControlEl = box

  // 位置決め（メディアの下→はみ出すなら上、画面内に収める）
  const r = media.getBoundingClientRect()
  const bw = box.offsetWidth
  const bh = box.offsetHeight
  let left = r.left
  let top = r.bottom + 6
  if (left + bw > window.innerWidth - 8) left = window.innerWidth - bw - 8
  if (top + bh > window.innerHeight - 8) top = Math.max(8, r.top - bh - 6)
  box.style.left = `${Math.max(8, left)}px`
  box.style.top = `${top}px`

  // 外側クリックで閉じる（キャプチャ段階。box内は contains で除外）
  mediaControlOutside = (e: MouseEvent): void => {
    if (mediaControlEl !== null && !mediaControlEl.contains(e.target as Node) && e.target !== media) {
      closeMediaControl()
    }
  }
  document.addEventListener('mousedown', mediaControlOutside, true)
}

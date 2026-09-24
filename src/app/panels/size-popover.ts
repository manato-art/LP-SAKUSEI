/**
 * 上のツールバーの「サイズ」から出す、選んだ部品の「幅と置く位置」の小窓（2026-09-24・本人「上のツールバーからもできるように」）。
 *
 * 幅はスライダー＋数字、置く位置は 左・中央・右 の絵のボタン。変えるとすぐ左に反映する（呼ぶ側が書く）。
 * 外を押すか Esc で閉じる。同時に1つだけ。
 */
import { PLACE_ICONS } from './nocode/templates/option-icons.ts'
import type { Place } from './nocode/templates/builder-blocks.ts'

const ATTR = 'data-size-popover'
const FONT = '"Hiragino Sans",sans-serif'
const ACCENT = 'var(--sb-accent, #0091FF)'

export interface SizePopoverOptions {
  readonly width: number
  readonly place: Place
  readonly onWidth: (value: number) => void
  readonly onPlace: (value: Place) => void
}

export function closeSizePopover(): void {
  document.querySelector(`[${ATTR}]`)?.remove()
}

export function openSizePopover(anchor: HTMLElement, options: SizePopoverOptions): void {
  closeSizePopover()
  const box = document.createElement('div')
  box.setAttribute(ATTR, 'true')
  box.setAttribute('role', 'dialog')
  box.setAttribute('aria-label', '幅と置く位置')
  box.style.cssText =
    `position:fixed;z-index:9600;background:var(--sb-c-ffffff, #FFFFFF);border:1px solid var(--sb-c-dddddd, #DDDDDD);border-radius:10px;box-shadow:0 6px 22px rgba(0,0,0,.16);` +
    `padding:12px 14px;display:flex;flex-direction:column;gap:10px;font:12px/1.4 ${FONT};color:var(--sb-c-333333, #333333);min-width:250px`
  box.addEventListener('mousedown', (e) => e.stopPropagation())

  // 幅
  const widthRow = document.createElement('div')
  widthRow.style.cssText = 'display:flex;align-items:center;gap:8px'
  const widthLabel = document.createElement('span')
  widthLabel.textContent = '幅'
  widthLabel.style.cssText = 'flex-shrink:0;color:var(--sb-c-555555, #555555);min-width:28px'
  const slider = document.createElement('input')
  slider.type = 'range'
  slider.min = '10'
  slider.max = '100'
  slider.step = '1'
  slider.value = String(options.width)
  slider.setAttribute('aria-label', '幅')
  slider.style.cssText = `flex:1;accent-color:${ACCENT};cursor:pointer`
  const value = document.createElement('span')
  value.textContent = `${options.width}%`
  value.style.cssText = 'min-width:40px;text-align:right;font-variant-numeric:tabular-nums'
  slider.addEventListener('input', () => {
    value.textContent = `${slider.value}%`
    options.onWidth(Number(slider.value))
  })
  widthRow.append(widthLabel, slider, value)

  // 置く位置
  const placeRow = document.createElement('div')
  placeRow.style.cssText = 'display:flex;align-items:center;gap:6px'
  const placeLabel = document.createElement('span')
  placeLabel.textContent = '位置'
  placeLabel.style.cssText = 'flex-shrink:0;color:var(--sb-c-555555, #555555);min-width:28px'
  placeRow.append(placeLabel)
  const buttons: HTMLButtonElement[] = []
  const paint = (current: Place): void => {
    for (const b of buttons) {
      const on = b.dataset['place'] === current
      b.setAttribute('aria-pressed', String(on))
      b.style.borderColor = on ? ACCENT : 'var(--sb-c-dddddd, #DDDDDD)'
      b.style.background = on ? 'var(--sb-accent-tint, #E6F4FF)' : 'var(--sb-c-ffffff, #FFFFFF)'
      b.style.color = on ? ACCENT : 'var(--sb-c-6b7480, #6B7480)'
    }
  }
  const PLACE_LABELS: Readonly<Record<Place, string>> = { left: '左に置く', center: '中央に置く', right: '右に置く' }
  for (const place of ['left', 'center', 'right'] as const) {
    const b = document.createElement('button')
    b.type = 'button'
    b.dataset['place'] = place
    b.innerHTML = PLACE_ICONS[place]
    b.title = PLACE_LABELS[place]
    b.setAttribute('aria-label', PLACE_LABELS[place])
    b.style.cssText =
      'flex:1;display:flex;align-items:center;justify-content:center;height:34px;border:1px solid var(--sb-c-dddddd, #DDDDDD);border-radius:6px;' +
      'background:var(--sb-c-ffffff, #FFFFFF);cursor:pointer;padding:0'
    b.addEventListener('click', () => {
      paint(place)
      options.onPlace(place)
    })
    buttons.push(b)
    placeRow.append(b)
  }
  paint(options.place)

  box.append(widthRow, placeRow)
  document.body.append(box)
  const r = anchor.getBoundingClientRect()
  box.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - box.offsetWidth - 8))}px`
  box.style.top = `${r.bottom + 6}px`
  slider.focus()

  const onOutside = (e: MouseEvent): void => {
    if (box.contains(e.target as Node) || e.target === anchor) return
    close()
  }
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close()
  }
  const close = (): void => {
    box.remove()
    document.removeEventListener('mousedown', onOutside, true)
    document.removeEventListener('keydown', onKey, true)
  }
  setTimeout(() => {
    document.addEventListener('mousedown', onOutside, true)
    document.addEventListener('keydown', onKey, true)
  }, 0)
}

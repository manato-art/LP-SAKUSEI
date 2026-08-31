/**
 * 文字色 / 背景色のカラーピッカー（企画書 §9-1）。
 *
 * マークアップは `toolbar-color-open/dom.html` の react-color（ChromePicker / GithubPicker）と
 * MUI Popover を verbatim で持ってきたもの。**手書きで似せていない。**
 */
import type { ToolbarState } from './dropdown.ts'
import { clamp } from './placement.ts'

/**
 * 文字色・背景色パレットの40色（toolbar-color-open/dom.html の `title` 属性を verbatim）。
 * `#fffff66` は本物のデータがそうなっている（16進として不正なので実物でも色が出ていない）。
 * 企画書 §3-5 に従い**直さない**。
 */
export const TOOLBAR_SWATCHES: readonly string[] = [
  '#000000', '#ffffff', '#bbbbbb', '#888888', '#444444',
  '#e60000', '#facccc', '#f06666', '#a10000', '#5c0000',
  '#ff9900', '#ffebcc', '#ffc266', '#b26b00', '#663d00',
  '#ffff00', '#ffffcc', '#fffff66', '#b2b200', '#666600',
  '#008a00', '#cce8cc', '#66B966', '#006100', '#003700',
  '#0066cc', '#cce0f5', '#66a3e0', '#0047b2', '#002966',
  '#9933ff', '#ebd6ff', '#c285ff', '#6b24b2', '#3d140a',
  '#0000ff', '#ff0000', '#ff00ff', '#fa57cc', '#fae1f0',
]

const CHROME_PICKER_HTML = `<div class="chrome-picker " style="width: 225px; background: rgb(255, 255, 255); border-radius: 2px; box-shadow: rgba(0, 0, 0, 0.3) 0px 0px 2px, rgba(0, 0, 0, 0.3) 0px 4px 8px; box-sizing: initial; font-family: Menlo;"><div style="width: 100%; padding-bottom: 55%; position: relative; border-radius: 2px 2px 0px 0px; overflow: hidden;"><div style="position: absolute; inset: 0px; background: rgb(255, 0, 0);"><style>
          .saturation-white {
            background: -webkit-linear-gradient(to right, #fff, rgba(255,255,255,0));
            background: linear-gradient(to right, #fff, rgba(255,255,255,0));
          }
          .saturation-black {
            background: -webkit-linear-gradient(to top, #000, rgba(0,0,0,0));
            background: linear-gradient(to top, #000, rgba(0,0,0,0));
          }
        </style><div class="saturation-white" style="position: absolute; inset: 0px;"><div class="saturation-black" style="position: absolute; inset: 0px;"></div><div style="position: absolute; top: 100%; left: 0%; cursor: default;"><div style="width: 12px; height: 12px; border-radius: 6px; box-shadow: rgb(255, 255, 255) 0px 0px 0px 1px inset; transform: translate(-6px, -6px);"></div></div></div></div></div><div style="padding: 16px 16px 12px;"><div class="flexbox-fix" style="display: flex;"><div style="width: 22px;"><div style="margin-top: 0px; width: 10px; height: 10px; border-radius: 8px; position: relative; overflow: hidden;"><div style="position: absolute; inset: 0px; border-radius: 8px; box-shadow: rgba(0, 0, 0, 0.1) 0px 0px 0px 1px inset; background: rgb(0, 0, 0); z-index: 2;"></div><div style="position: absolute; inset: 0px; background: url(&quot;data:image/png;base64,sample_token_b5921805/9hAAAAPUlEQVR4AeySywkAMAhDH52h+0/sample_token_cb7c5d12//sample_token_3c96bb24==&quot;) left center;"></div></div></div><div style="-webkit-box-flex: 1; flex: 1 1 0%;"><div style="height: 10px; position: relative; margin-bottom: 0px;"><div style="position: absolute; inset: 0px;"><div class="hue-horizontal" style="padding: 0px 2px; position: relative; height: 100%;"><style>
            .hue-horizontal {
              background: linear-gradient(to right, #f00 0%, #ff0 17%, #0f0
                33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);
              background: -webkit-linear-gradient(to right, #f00 0%, #ff0
                17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);
            }

            .hue-vertical {
              background: linear-gradient(to top, #f00 0%, #ff0 17%, #0f0 33%,
                #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);
              background: -webkit-linear-gradient(to top, #f00 0%, #ff0 17%,
                #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);
            }
          </style><div style="position: absolute; left: 0%;"><div style="width: 12px; height: 12px; border-radius: 6px; transform: translate(-6px, -1px); background-color: rgb(248, 248, 248); box-shadow: rgba(0, 0, 0, 0.37) 0px 1px 4px 0px;"></div></div></div></div></div><div style="height: 10px; position: relative; display: none;"><div style="position: absolute; inset: 0px;"><div style="position: absolute; inset: 0px; overflow: hidden;"><div style="position: absolute; inset: 0px; background: url(&quot;data:image/png;base64,sample_token_b5921805/9hAAAAPUlEQVR4AeySywkAMAhDH52h+0/sample_token_cb7c5d12//sample_token_3c96bb24==&quot;) left center;"></div></div><div style="position: absolute; inset: 0px; background: linear-gradient(to right, rgba(0, 0, 0, 0) 0%, rgb(0, 0, 0) 100%);"></div><div style="position: relative; height: 100%; margin: 0px 3px;"><div style="position: absolute; left: 100%;"><div style="width: 12px; height: 12px; border-radius: 6px; transform: translate(-6px, -1px); background-color: rgb(248, 248, 248); box-shadow: rgba(0, 0, 0, 0.37) 0px 1px 4px 0px;"></div></div></div></div></div></div></div><div class="flexbox-fix" style="padding-top: 16px; display: flex;"><div class="flexbox-fix" style="-webkit-box-flex: 1; flex: 1 1 0%; display: flex; margin-left: -6px;"><div style="padding-left: 6px; width: 100%;"><div style="position: relative;"><input id="rc-editable-input-1" spellcheck="false" value="#000000" style="font-size: 11px; color: rgb(51, 51, 51); width: 100%; border-radius: 2px; border-width: medium; border-style: none; border-color: currentcolor; border-image: none; box-shadow: rgb(218, 218, 218) 0px 0px 0px 1px inset; height: 21px; text-align: center;"><label for="rc-editable-input-1" style="text-transform: uppercase; font-size: 11px; line-height: 11px; color: rgb(150, 150, 150); text-align: center; display: block; margin-top: 12px;">hex</label></div></div></div><div style="width: 32px; text-align: right; position: relative;"><div style="margin-right: -4px; margin-top: 12px; cursor: pointer; position: relative;"><svg viewBox="0 0 24 24" style="fill: rgb(51, 51, 51); width: 24px; height: 24px; border: 1px solid transparent; border-radius: 5px;"><path d="M12,18.17L8.83,15L7.42,16.41L12,21L16.59,16.41L15.17,15M12,5.83L15.17,9L16.58,7.59L12,3L7.41,7.59L8.83,9L12,5.83Z"></path></svg></div></div></div></div></div>`


/** ポップオーバーの寸法（css-1xyx5ni が 235px 固定） */
const PICKER_WIDTH = 235

/** `#abc` / `abc` / `#aabbcc` を `#aabbcc` に寄せる。不正なら null */
export function normalizeHex(input: string): string | null {
  const raw = input.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    const [r, g, b] = [raw[0], raw[1], raw[2]]
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`
  return null
}

/** 採取したスウォッチの inline style を再現するための `rgb(r, g, b)`。不正な色は null */
export function hexToRgbCss(hex: string): string | null {
  const normalized = normalizeHex(hex)
  if (normalized === null) return null
  const r = Number.parseInt(normalized.slice(1, 3), 16)
  const g = Number.parseInt(normalized.slice(3, 5), 16)
  const b = Number.parseInt(normalized.slice(5, 7), 16)
  return `rgb(${r}, ${g}, ${b})`
}

export interface Hsv {
  readonly h: number
  readonly s: number
  readonly v: number
}

/** HSV → `#rrggbb`（h: 0-360, s/v: 0-1） */
export function hsvToHex(h: number, s: number, v: number): string {
  const hue = ((h % 360) + 360) % 360
  const sat = clamp(s, 0, 1)
  const val = clamp(v, 0, 1)
  const c = val * sat
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = val - c
  const sectors: readonly (readonly [number, number, number])[] = [
    [c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x],
  ]
  const rgb = sectors[Math.floor(hue / 60) % 6] ?? [c, x, 0]
  const hex = rgb.map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, '0')).join('')
  return `#${hex}`
}

/** `#rrggbb` → HSV。不正なら null */
export function hexToHsv(hex: string): Hsv | null {
  const normalized = normalizeHex(hex)
  if (normalized === null) return null
  const r = Number.parseInt(normalized.slice(1, 3), 16) / 255
  const g = Number.parseInt(normalized.slice(3, 5), 16) / 255
  const b = Number.parseInt(normalized.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  let h = 0
  if (delta !== 0) {
    if (max === r) h = 60 * (((g - b) / delta + 6) % 6)
    else if (max === g) h = 60 * ((b - r) / delta + 2)
    else h = 60 * ((r - g) / delta + 4)
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max }
}

/** 採取したスウォッチ1つ分のマークアップ（toolbar-color-open/dom.html と同じ形） */
export function swatchMarkup(hex: string): string {
  const rgb = hexToRgbCss(hex)
  const background = rgb === null ? '' : `background: ${rgb}; `
  return (
    '<span><div style="width: 25px; height: 25px; font-size: 0px;"><span>' +
    `<div title="${hex}" tabindex="0" style="${background}height: 100%; width: 100%; ` +
    'cursor: pointer; position: relative; outline: none;"></div></span></div></span>'
  )
}

/** ポップオーバーは document.body 直下（実物と同じく `#root` の外）に1つだけ出す */
export function openColorPicker(
  anchor: HTMLElement,
  title: string,
  apply: (hex: string) => void,
  ctx: ToolbarState,
  refresh: () => void,
): void {
  document.querySelector('.editor-toolbar-color-picker')?.remove()

  const rect = anchor.getBoundingClientRect()
  const left = clamp(rect.left + rect.width / 2 - PICKER_WIDTH / 2, 8, Math.max(8, window.innerWidth - PICKER_WIDTH - 8))
  const top = clamp(rect.bottom + 8, 8, Math.max(8, window.innerHeight - 320))

  const popover = document.createElement('div')
  popover.setAttribute('role', 'presentation')
  popover.className = 'MuiPopover-root editor-toolbar-color-picker MuiModal-root css-mwpql5'
  popover.setAttribute('aria-label', title)
  popover.innerHTML =
    '<div aria-hidden="true" class="MuiBackdrop-root MuiBackdrop-invisible MuiModal-backdrop css-esi9ax"></div>' +
    '<div tabindex="0" data-testid="sentinelStart"></div>' +
    '<div class="MuiPaper-root MuiPaper-elevation MuiPaper-rounded MuiPaper-elevation8 MuiPopover-paper css-1dmzujt" ' +
    `tabindex="-1" style="top: ${top}px; left: ${left}px;">` +
    '<div class="MuiBox-root css-1xyx5ni">' +
    CHROME_PICKER_HTML +
    githubPickerMarkup() +
    '<div class="MuiBox-root css-170de7g"><button class="MuiButtonBase-root MuiButton-root MuiButton-contained ' +
    'MuiButton-containedPrimary MuiButton-sizeMedium MuiButton-containedSizeMedium MuiButton-fullWidth css-1yaowxx" ' +
    'tabindex="0" type="button">適用する<span class="MuiTouchRipple-root css-w0pj6f"></span></button></div>' +
    '</div></div><div tabindex="0" data-testid="sentinelEnd"></div>'
  document.body.append(popover)

  ctx.keepOpen = true
  const close = (): void => {
    popover.remove()
    ctx.keepOpen = false
    refresh()
  }
  popover.querySelector('.MuiBackdrop-root')?.addEventListener('click', close)

  const picker = wireChromePicker(popover)
  for (const swatch of popover.querySelectorAll<HTMLElement>('.github-picker [title]')) {
    swatch.addEventListener('click', () => {
      const hex = swatch.getAttribute('title') ?? ''
      const normalized = normalizeHex(hex)
      if (normalized === null) return // `#fffff66` のような不正な色は実物でも何も起きない
      picker.set(normalized)
      apply(normalized)
    })
  }
  popover.querySelector('.css-1yaowxx')?.addEventListener('click', () => {
    const hex = normalizeHex(picker.get())
    if (hex !== null) apply(hex)
    close()
  })
}

function githubPickerMarkup(): string {
  return (
    '<div class="github-picker " style="width: 200px; background: rgb(255, 255, 255); ' +
    'border: 1px solid rgba(0, 0, 0, 0.2); box-shadow: rgba(0, 0, 0, 0.15) 0px 3px 12px; border-radius: 4px; ' +
    'position: relative; padding: 5px; display: flex; flex-wrap: wrap;">' +
    TOOLBAR_SWATCHES.map(swatchMarkup).join('') +
    '</div>'
  )
}

interface ChromePicker {
  readonly get: () => string
  readonly set: (hex: string) => void
}

/** 採取した ChromePicker のマークアップ（彩度面 / 色相バー / hex入力）を動かす */
function wireChromePicker(popover: HTMLElement): ChromePicker {
  const saturation = popover.querySelector<HTMLElement>('.saturation-white')
  const saturationBg = saturation?.parentElement ?? null
  const saturationMarker = saturation?.querySelector<HTMLElement>(':scope > div:nth-child(2)') ?? null
  const hue = popover.querySelector<HTMLElement>('.hue-horizontal')
  const hueMarker = hue?.querySelector<HTMLElement>(':scope > div:last-child') ?? null
  const hexInput = popover.querySelector<HTMLInputElement>('#rc-editable-input-1')
  const preview = popover.querySelector<HTMLElement>('.flexbox-fix div[style*="z-index: 2"]')

  let hsv: Hsv = { h: 0, s: 0, v: 0 }

  const render = (): void => {
    const hex = hsvToHex(hsv.h, hsv.s, hsv.v)
    if (hexInput !== null) hexInput.value = hex
    saturationBg?.style.setProperty('background', hsvToHex(hsv.h, 1, 1))
    saturationMarker?.style.setProperty('left', `${hsv.s * 100}%`)
    saturationMarker?.style.setProperty('top', `${(1 - hsv.v) * 100}%`)
    hueMarker?.style.setProperty('left', `${(hsv.h / 360) * 100}%`)
    preview?.style.setProperty('background', hex)
  }

  const dragOn = (surface: HTMLElement | null, onMove: (ratioX: number, ratioY: number) => void): void => {
    if (surface === null) return
    const update = (event: MouseEvent): void => {
      const box = surface.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) return
      onMove(clamp((event.clientX - box.left) / box.width, 0, 1), clamp((event.clientY - box.top) / box.height, 0, 1))
      render()
    }
    surface.addEventListener('mousedown', (event) => {
      event.preventDefault()
      update(event)
      const move = (moveEvent: MouseEvent): void => update(moveEvent)
      const up = (): void => {
        document.removeEventListener('mousemove', move)
        document.removeEventListener('mouseup', up)
      }
      document.addEventListener('mousemove', move)
      document.addEventListener('mouseup', up)
    })
  }

  dragOn(saturation, (x, y) => {
    hsv = { h: hsv.h, s: x, v: 1 - y }
  })
  dragOn(hue, (x) => {
    hsv = { h: x * 360, s: hsv.s, v: hsv.v }
  })
  hexInput?.addEventListener('change', () => {
    const parsed = hexToHsv(hexInput.value)
    if (parsed === null) {
      render()
      return
    }
    hsv = parsed
    render()
  })

  render()
  return {
    get: () => hexInput?.value ?? hsvToHex(hsv.h, hsv.s, hsv.v),
    set: (hex: string) => {
      const parsed = hexToHsv(hex)
      if (parsed === null) return
      hsv = parsed
      render()
    },
  }
}


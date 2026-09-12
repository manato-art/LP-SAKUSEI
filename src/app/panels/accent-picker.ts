/**
 * テーマカラーの選択部品（色の丸＋自由選択＋既定に戻す）。
 *
 * 設定画面とサイドバーの両方から同じものを出すので、ここ1か所に置く
 * （片方だけ色が増える・並びが違う、が起きないようにする）。
 * 選んだ色はその場で画面全体に反映し、アカウントに保存する（`theme-color.ts`）。
 */
import { api } from '../api.ts'
import { T, el, toast } from '../ui.ts'
import {
  ACCENT_PRESETS,
  DEFAULT_ACCENT,
  isHexColor,
  readableInk,
  setAccent,
  storedAccent,
} from '../theme-color.ts'

/** 選択中の丸に付ける印（SVG。共通指示「UIは絵文字をやめSVGアイコンに」） */
const CHECK =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4 10-10"/></svg>'

export interface AccentPickerOptions {
  /** 色の丸の大きさ（px） */
  dotSize?: number
}

export function buildAccentPicker(options: AccentPickerOptions = {}): HTMLElement {
  const dotSize = options.dotSize ?? 34
  const wrap = el('div')

  const swatches = el('div', {
    style: 'display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px',
  })

  /** 今どの色か（プリセット・自由入力の両方から更新する） */
  let current = storedAccent()

  const paint = (): void => {
    for (const dot of swatches.querySelectorAll<HTMLElement>('[data-accent]')) {
      const value = dot.dataset['accent'] ?? ''
      const isOn = value.toUpperCase() === current.toUpperCase()
      dot.style.boxShadow = isOn ? `0 0 0 3px ${value}55` : 'none'
      dot.style.color = readableInk(value)
      dot.innerHTML = isOn ? CHECK : ''
    }
    customInput.value = current
  }

  const choose = (hex: string): void => {
    if (!isHexColor(hex)) {
      toast('色は #RRGGBB の形式で指定してください', 'error')
      return
    }
    current = hex.toUpperCase()
    paint()
    void setAccent(current, (v) => api.saveThemeColor(v)).then(
      () => toast('テーマカラーを変更しました'),
      (error: Error) => toast(error.message, 'error'),
    )
  }

  for (const preset of ACCENT_PRESETS) {
    const dot = el('button', {
      style: [
        `width:${dotSize}px;height:${dotSize}px;border-radius:50%;border:1px solid rgba(0,0,0,.12)`,
        `background:${preset.value};cursor:pointer;padding:0`,
        'display:flex;align-items:center;justify-content:center',
      ].join(';'),
    })
    dot.type = 'button'
    dot.dataset['accent'] = preset.value
    dot.title = preset.label
    dot.setAttribute('aria-label', preset.label)
    dot.addEventListener('click', () => choose(preset.value))
    swatches.append(dot)
  }

  // 自由に色を選ぶ
  const customWrap = el('div', { style: 'display:flex;gap:8px;align-items:center' })
  const customInput = document.createElement('input')
  customInput.type = 'color'
  customInput.style.cssText = `width:${dotSize + 4}px;height:${dotSize}px;padding:0;border:1px solid #DDD;border-radius:6px;background:#fff;cursor:pointer`
  customInput.title = '自由に色を選ぶ'
  customInput.addEventListener('change', () => choose(customInput.value))

  const reset = el('button', {
    text: '既定に戻す',
    style: [
      `font-family:${T.font};font-size:12px;padding:7px 14px;border-radius:6px`,
      'border:1px solid #DDD;background:#fff;color:#555;cursor:pointer',
    ].join(';'),
  })
  reset.type = 'button'
  reset.addEventListener('click', () => choose(DEFAULT_ACCENT))
  customWrap.append(customInput, reset)

  wrap.append(swatches, customWrap)

  // サーバーに保存されている色に合わせる（別ブラウザで変えた場合に追従する）
  void api.themeColor().then(
    ({ accent }) => {
      if (isHexColor(accent)) {
        current = accent.toUpperCase()
        paint()
      }
    },
    () => {
      /* 取れなければ覚えている色のまま */
    },
  )

  paint()
  return wrap
}

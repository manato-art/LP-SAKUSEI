/**
 * 数字の欄を「左右にドラッグで増減」＋「スライダー」で動かす（2026-09-23・Widget編集 第2弾・Canva風）。
 *
 * 数字を打ち直さなくても、名前や単位の所をつかんで左右に動かせば値が変わる（Figma・Blender と同じ操作）。
 * 計算は drag-math.ts（純粋関数）。ここは DOM の配線だけ。
 */
import { scrubValue, type NumberRange } from './drag-math.ts'

export interface ScrubOptions {
  readonly read: () => number
  readonly step: number
  readonly range?: Pick<NumberRange, 'min' | 'max'>
  /** 動かしている間、値が変わるたびに */
  readonly apply: (value: number) => void
  /** 離したとき（動かしたときだけ） */
  readonly onEnd?: () => void
}

/** grip（名前や単位の要素）を左右にドラッグすると値が増減する */
export function attachScrub(grip: HTMLElement, options: ScrubOptions): void {
  const target = grip // eslint-safe alias（no-param-reassign 回避）
  target.style.cursor = 'ew-resize'
  target.style.userSelect = 'none'
  target.style.touchAction = 'none'
  if (target.title === '') target.title = '左右にドラッグで増減'
  target.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    const start = options.read()
    if (!Number.isFinite(start)) return
    event.preventDefault()
    const startX = event.clientX
    let moved = false
    try {
      target.setPointerCapture(event.pointerId)
    } catch {
      /* 掴めない環境（合成イベントなど）でも、要素の上で動かせば効く */
    }
    document.body.style.cursor = 'ew-resize'
    const onMove = (ev: PointerEvent): void => {
      moved = true
      options.apply(scrubValue(start, ev.clientX - startX, options.step, options.range))
    }
    const onUp = (): void => {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
      document.body.style.cursor = ''
      if (moved) options.onEnd?.()
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  })
}

/** 数字の欄の下に置くスライダー */
export function makeSlider(range: NumberRange, value: number, className: string, onInput: (value: number) => void): HTMLInputElement {
  const slider = document.createElement('input')
  slider.type = 'range'
  slider.className = className
  slider.min = String(range.min)
  slider.max = String(range.max)
  slider.step = String(range.step)
  slider.value = String(value)
  slider.setAttribute('aria-label', 'スライダーで増減')
  slider.addEventListener('input', () => {
    if (Number.isFinite(slider.valueAsNumber)) onInput(slider.valueAsNumber)
  })
  return slider
}

/**
 * 数字の欄で、キーボードの ↑↓ を押すとその場で1ずつ変える（2026-10-27 本人「現在の大きさの数字を押したら、十字キーの上下でサイズの調整をしたい」）。
 * ブラウザのままだと欄の数字だけ変わり、欄から出るまで文字の大きさに効かなかった。
 */
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import { nextStepValue, wireStepKeys } from '../src/app/panels/number-step-keys.ts'

type Win = ReturnType<typeof parseHTML>['window']

const key = (window: Win, name: string): Event => {
  const event = new window.Event('keydown', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'key', { value: name })
  return event
}

describe('数字の欄の ↑↓', () => {
  it('↑で+1・↓で-1。1より小さくはしない・数字でなければ何もしない', () => {
    expect(nextStepValue('17', 1, 1)).toBe(18)
    expect(nextStepValue('17', -1, 1)).toBe(16)
    expect(nextStepValue('1', -1, 1)).toBeNull()
    expect(nextStepValue('', 1, 1)).toBeNull()
  })

  it('↑↓を押すと、その場で数字を変えて知らせる（ほかのキーはそのまま）', () => {
    const { window } = parseHTML('<!doctype html><html><body><input type="number" value="17"></body></html>')
    const input = window.document.querySelector('input') as unknown as HTMLInputElement
    const applied: number[] = []
    wireStepKeys(input, 1, (value) => applied.push(value))
    const up = key(window, 'ArrowUp')
    input.dispatchEvent(up)
    expect(up.defaultPrevented).toBe(true)
    expect(input.value).toBe('18')
    input.dispatchEvent(key(window, 'ArrowDown'))
    expect(input.value).toBe('17')
    const other = key(window, 'a')
    input.dispatchEvent(other)
    expect(other.defaultPrevented).toBe(false)
    expect(applied).toEqual([18, 17])
  })

  it('効かせたあとも欄を選んだままにする（続けて ↑↓ を押せる。文字の大きさを変えると本文が選ばれていた）', () => {
    const { window } = parseHTML('<!doctype html><html><body><input type="number" value="17"></body></html>')
    const input = window.document.querySelector('input') as unknown as HTMLInputElement
    let focused = 0
    input.focus = () => {
      focused += 1
    }
    wireStepKeys(input, 1, () => undefined)
    input.dispatchEvent(key(window, 'ArrowUp'))
    input.dispatchEvent(key(window, 'ArrowUp'))
    expect(focused).toBe(2)
    expect(input.value).toBe('19')
  })
})

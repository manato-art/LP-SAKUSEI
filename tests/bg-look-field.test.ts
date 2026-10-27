/**
 * LP設定の背景の画像の「位置と大きさ」の欄（2026-10-27 指示⑱ 本人「背景画像なんだけど、ここでトリミングや大きさの調整をしたい」
 * → 選択「位置と大きさを動かす」）。合わせ方の3つのボタン・大きさ・小さな見本の上でつかんで動かす。
 */
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'

function setup(look = '') {
  const { window } = parseHTML('<!doctype html><html><body></body></html>')
  const g = globalThis as unknown as Record<string, unknown>
  for (const key of ['document', 'window', 'Event', 'HTMLElement', 'HTMLInputElement', 'Node']) g[key] = (window as unknown as Record<string, unknown>)[key]
  const changes: string[] = []
  return { window, changes, look }
}

type Win = ReturnType<typeof parseHTML>['window']

const pointer = (window: Win, type: string, x: number, y: number): Event => {
  const event = new window.Event(type, { bubbles: true })
  Object.defineProperty(event, 'clientX', { value: x })
  Object.defineProperty(event, 'clientY', { value: y })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  return event
}

async function mount(look = '') {
  const t = setup(look)
  const { bgLookField } = await import('../src/app/panels/bg-look-field.ts')
  // 横長の画像（3:2）
  const field = bgLookField({ src: '/uploads/x.webp', look, kind: 'inner', natural: { width: 600, height: 400 }, onChange: (v) => t.changes.push(v) })
  t.window.document.body.append(field)
  const button = (label: string) => [...field.querySelectorAll('button')].find((b) => b.textContent === label)
  const frame = field.querySelector<HTMLElement>('[data-bg-look-frame]')
  return { ...t, field, button, frame }
}

describe('背景の画像の位置と大きさ', () => {
  it('合わせ方は3つ。何も決めていなければ「全体を覆う」', async () => {
    const t = await mount()
    expect([...t.field.querySelectorAll('[data-bg-look-fit]')].map((b) => b.textContent)).toEqual(['全体を覆う', '全体を見せる', '自分で決める'])
    expect(t.button('全体を覆う')?.getAttribute('aria-pressed')).toBe('true')
  })

  it('「全体を見せる」を押すと、見本もそう見え、値が変わる', async () => {
    const t = await mount()
    t.button('全体を見せる')?.dispatchEvent(new t.window.Event('click'))
    expect(t.changes.at(-1)).toBe('contain 100 50 50')
    expect(t.button('全体を見せる')?.getAttribute('aria-pressed')).toBe('true')
    expect(t.frame?.getAttribute('style')).toContain('background-size:contain')
  })

  it('大きさを動かすと「自分で決める」になり、画像の横÷縦も持つ', async () => {
    const t = await mount()
    const range = t.field.querySelector<HTMLInputElement>('input[type="range"]')
    if (range === null) throw new Error('大きさが無い')
    range.value = '150'
    range.dispatchEvent(new t.window.Event('input'))
    expect(t.changes.at(-1)).toBe('free 150 50 50 1.5')
    expect(t.button('自分で決める')?.getAttribute('aria-pressed')).toBe('true')
  })

  it('見本の上でつかんで横へ動かすと、左右の位置が変わる（上下は縦に余りが無いので変わらない）', async () => {
    const t = await mount()
    t.frame?.dispatchEvent(pointer(t.window, 'pointerdown', 100, 100))
    t.frame?.dispatchEvent(pointer(t.window, 'pointermove', 60, 100))
    t.frame?.dispatchEvent(pointer(t.window, 'pointerup', 60, 100))
    const last = t.changes.at(-1) ?? ''
    expect(last.startsWith('cover 100 ')).toBe(true)
    const [, , x, y] = last.split(' ')
    expect(Number(x)).toBeGreaterThan(50)
    expect(y).toBe('50')
  })

  it('角を引っぱると、画像の真ん中を動かさずに大きく・小さくする（どの角でも同じ）', async () => {
    const { scaledLook } = await import('../src/app/panels/bg-look-field.ts')
    const box = { left: 0, top: 0, width: 150, height: 267 }
    const natural = { width: 600, height: 400 }
    // 全体を覆う・真ん中から半分に
    const half = scaledLook({ fit: 'cover', size: 100, x: 50, y: 50, ratio: null }, box, natural, 0.5)
    expect(half).toMatchObject({ fit: 'free', size: 50, x: 50, y: 50 })
    // 右へ寄せた（79%）画像を縮めても、画像の真ん中は同じ所に残る
    const moved = scaledLook({ fit: 'cover', size: 100, x: 79, y: 50, ratio: null }, box, natural, 0.8)
    const center = (look: { size: number; x: number }): number => {
      const width = 400.5 * (look.size / 100)
      return ((box.width - width) * look.x) / 100 + width / 2
    }
    // 位置は整数の%で持つので、1px 未満のずれは出る
    expect(Math.abs(center(moved) - center({ size: 100, x: 79 }))).toBeLessThan(1)
  })

  it('保存してある値から始める', async () => {
    const t = await mount('free 120 30 70 1.5')
    expect(t.button('自分で決める')?.getAttribute('aria-pressed')).toBe('true')
    expect(t.field.querySelector<HTMLInputElement>('input[type="range"]')?.value).toBe('120')
    expect(t.frame?.getAttribute('style')).toContain('background-position:30% 70%')
  })
})

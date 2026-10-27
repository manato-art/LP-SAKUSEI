/**
 * LP設定の背景の画像の「位置と大きさ」を、LP設定の画面で決めて保存する（2026-10-27 指示⑱）。
 * 画像のときだけ出す（動画は今までどおり全体を覆う）。別の画像に変えたら、位置と大きさは最初（全体を覆う・真ん中）に戻す。
 */
import { describe, expect, it, vi } from 'vitest'
import { parseHTML } from 'linkedom'

type Win = ReturnType<typeof parseHTML>['window']

const SHEET = {
  font_size: 17, font_family: '', color: '000000', text_align: '', line_height: null, letter_spacing: null,
  img_margin_top: null, img_margin_bottom: null, padding_top: null, padding_bottom: null, padding_right: null, padding_left: null,
  iframe_height: null, iframe_height_unit: '', delivery_version_width: null, delivery_version_width_unit: '',
  border_size: null, border_type: '', border_color: '', outer_background_color: '', outer_background_image: '',
  inner_background_color: '', inner_background_image: '',
}

async function open(sheet: Record<string, unknown>): Promise<{ window: Win; puts: Record<string, unknown>[] }> {
  const { window } = parseHTML('<!doctype html><html><head></head><body></body></html>')
  const g = globalThis as unknown as Record<string, unknown>
  for (const key of ['document', 'window', 'DOMParser', 'Event', 'HTMLElement', 'HTMLInputElement', 'HTMLVideoElement', 'Node']) {
    g[key] = (window as unknown as Record<string, unknown>)[key]
  }
  // 画像の縦横は測らない（読み込みが起きない）
  g['Image'] = class {
    addEventListener(): void {}
    set src(_value: string) {}
  }
  // linkedom の input には checked が無い（:checked で読めない）。属性で読み書きできるようにする
  const inputProto = (window as unknown as { HTMLInputElement: { prototype: object } }).HTMLInputElement.prototype
  Object.defineProperty(inputProto, 'checked', {
    configurable: true,
    get(this: Element) {
      return this.hasAttribute('checked')
    },
    set(this: Element, on: boolean) {
      if (on) this.setAttribute('checked', '')
      else this.removeAttribute('checked')
    },
  })
  const selectProto = (window as unknown as { HTMLSelectElement: { prototype: object } }).HTMLSelectElement.prototype
  Object.defineProperty(selectProto, 'value', {
    configurable: true,
    get(this: Element) {
      return this.getAttribute('data-value') ?? ''
    },
    set(this: Element, v: string) {
      this.setAttribute('data-value', v)
    },
  })
  const puts: Record<string, unknown>[] = []
  g['fetch'] = async (_url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') puts.push(JSON.parse(String(init.body)) as Record<string, unknown>)
    return new Response(JSON.stringify({ master_style_sheet: { ...SHEET, ...sheet } }), { status: 200 })
  }
  vi.resetModules()
  const { openVersionSettings } = await import('../src/app/panels/version-settings.ts')
  await openVersionSettings(`ARTICLE_${Math.random()}`)
  return { window, puts }
}

const fieldOf = (window: Win, kind: 'inner' | 'outer') => window.document.querySelector(`[data-bg-look-field="${kind}"]`)

describe('LP設定の背景の画像の位置と大きさ', () => {
  it('画像のときは「位置と大きさ」を出す。動画のときは出さない', async () => {
    const { window } = await open({ inner_background_image: '/uploads/a.webp', outer_background_image: '/uploads/b.mp4' })
    expect(fieldOf(window, 'inner')).not.toBeNull()
    expect(fieldOf(window, 'outer')).toBeNull()
  })

  it('決めた位置と大きさを保存する（保存してある値から始まる）', async () => {
    const { window, puts } = await open({ inner_background_image: '/uploads/a.webp', inner_background_look: 'cover 100 50 20' })
    const field = fieldOf(window, 'inner')
    expect(field?.querySelector('[data-bg-look-frame]')?.getAttribute('style')).toContain('background-position:50% 20%')
    field?.querySelector('[data-bg-look-fit="contain"]')?.dispatchEvent(new window.Event('click'))
    window.document.querySelector('[data-test="MasterStyleSheetModal-BtnUpdate"]')?.dispatchEvent(new window.Event('click'))
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(puts.at(-1)).toMatchObject({ inner_background_image: '/uploads/a.webp', inner_background_look: 'contain 100 50 20' })
  })

  it('背景を「設定しない」にしたら、位置と大きさも空で送る', async () => {
    const { window, puts } = await open({ inner_background_image: '/uploads/a.webp', inner_background_look: 'contain 100 50 20' })
    const none = window.document.querySelector<HTMLInputElement>('input[name="innerBackgroundRadio"][value="none"]')
    if (none === null) throw new Error('設定しないが無い')
    // 本物のラジオは1つ選ぶとほかが外れる（linkedom の代わりの checked は外れないので、ここで外す）
    for (const radio of window.document.querySelectorAll<HTMLInputElement>('input[name="innerBackgroundRadio"]')) radio.checked = false
    none.checked = true
    none.dispatchEvent(new window.Event('change'))
    window.document.querySelector('[data-test="MasterStyleSheetModal-BtnUpdate"]')?.dispatchEvent(new window.Event('click'))
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(puts.at(-1)).toMatchObject({ inner_background_image: '', inner_background_look: '' })
  })
})

/**
 * LP設定（記事設定）の背景の「画像」の枠（2026-10-27）。
 * - 今入っている画像・動画を小さく見せる（本人「はい」＝提案「今どの画像が入っているかが画面に出ない」）
 * - 枠を押すとファイルを選べる・枠にファイルを落とすと入る（採取した枠は見た目だけで、押しても落としても何も起きなかった）
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

async function open(sheet: Partial<typeof SHEET>): Promise<Win> {
  const { window } = parseHTML('<!doctype html><html><head></head><body></body></html>')
  const g = globalThis as unknown as Record<string, unknown>
  for (const key of ['document', 'window', 'DOMParser', 'Event', 'HTMLElement', 'HTMLInputElement', 'HTMLVideoElement', 'Node']) {
    g[key] = (window as unknown as Record<string, unknown>)[key]
  }
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
  g['fetch'] = async () => new Response(JSON.stringify({ master_style_sheet: { ...SHEET, ...sheet } }), { status: 200 })
  // 開いている画面を覚えている（モジュールの中）ので、試しごとに読み直す
  vi.resetModules()
  const { openVersionSettings } = await import('../src/app/panels/version-settings.ts')
  await openVersionSettings(`ARTICLE_${Math.random()}`)
  return window
}

const zoneOf = (window: Win, field: string): HTMLElement => {
  const file = window.document.querySelector(`input[type="file"][name="${field}"]`)
  if (file === null || file.parentElement === null) throw new Error(`${field} の枠がありません`)
  return file.parentElement as unknown as HTMLElement
}

describe('LP設定の背景の「画像」の枠', () => {
  it('今入っている画像を、枠の中に小さく見せる', async () => {
    const window = await open({ inner_background_image: '/uploads/abc.webp' })
    const preview = zoneOf(window, 'inner_background_image').querySelector('img[data-bg-preview]')
    expect(preview?.getAttribute('src')).toBe('/uploads/abc.webp')
    expect(zoneOf(window, 'inner_background_image').textContent).toContain('別の画像か動画')
  })

  it('動画なら動画で見せる（音なし・くり返し）', async () => {
    const window = await open({ outer_background_image: '/uploads/abc.mp4' })
    const preview = zoneOf(window, 'outer_background_image').querySelector('video[data-bg-preview]')
    expect(preview?.getAttribute('src')).toBe('/uploads/abc.mp4')
    expect(preview?.hasAttribute('muted')).toBe(true)
  })

  it('枠を押すと、ファイルを選ぶ画面を開く', async () => {
    const window = await open({ inner_background_image: '/uploads/abc.webp' })
    const zone = zoneOf(window, 'inner_background_image')
    const file = zone.querySelector('input[type="file"]') as HTMLInputElement
    let opened = 0
    file.click = () => {
      opened += 1
    }
    zone.dispatchEvent(new window.Event('click', { bubbles: true }))
    expect(opened).toBe(1)
  })
})

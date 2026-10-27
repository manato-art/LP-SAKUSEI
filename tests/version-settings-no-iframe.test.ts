/**
 * LP設定から「Iframe設定」を外す（2026-10-27 本人「Iframe設定って何？わかりずらいので修正」→「項目ごと消す」）。
 * 高さ・単位は保存していたが、編集画面・プレビュー・配信のどこにも効いていなかった。
 * 保存してある値は消さない（送らない＝サーバーは今の値のまま・あとで戻せる）。
 */
import { describe, expect, it, vi } from 'vitest'
import { parseHTML } from 'linkedom'

const SHEET = {
  font_size: 17, font_family: '', color: '000000', text_align: '', line_height: null, letter_spacing: null,
  img_margin_top: null, img_margin_bottom: null, padding_top: null, padding_bottom: null, padding_right: null, padding_left: null,
  iframe_height: 300, iframe_height_unit: 'px', delivery_version_width: null, delivery_version_width_unit: '',
  border_size: null, border_type: '', border_color: '', outer_background_color: '', outer_background_image: '',
  inner_background_color: '', inner_background_image: '',
}

describe('LP設定に「Iframe設定」を出さない', () => {
  it('見出し・高さ・単位を出さず、保存でも送らない（保存してある値はそのまま）', async () => {
    const { window } = parseHTML('<!doctype html><html><head></head><body></body></html>')
    const g = globalThis as unknown as Record<string, unknown>
    for (const key of ['document', 'window', 'DOMParser', 'Event', 'HTMLElement', 'HTMLInputElement', 'Node']) {
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
    const puts: Record<string, unknown>[] = []
    g['fetch'] = async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') puts.push(JSON.parse(String(init.body)) as Record<string, unknown>)
      return new Response(JSON.stringify({ master_style_sheet: SHEET }), { status: 200 })
    }
    vi.resetModules()
    const { openVersionSettings } = await import('../src/app/panels/version-settings.ts')
    await openVersionSettings('ARTICLE_X', { uid: 'VER_A', name: 'Ver.1' })

    const modal = window.document.querySelector('[data-test="MasterStyleSheetModal-ModalWrapper"]')
    expect(modal?.textContent).not.toContain('Iframe')
    expect(modal?.querySelector('[name="iframe_height"], [name="iframe_height_unit"]')).toBeNull()
    // 前後の見出しは残る
    expect(modal?.textContent).toContain('配信Version幅')
    expect(modal?.querySelector('[name="padding_left"]')).not.toBeNull()

    window.document.querySelector('[data-test="MasterStyleSheetModal-BtnUpdate"]')?.dispatchEvent(new window.Event('click'))
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(puts).toHaveLength(1)
    expect(puts[0]).not.toHaveProperty('iframe_height')
    expect(puts[0]).not.toHaveProperty('iframe_height_unit')
  })
})

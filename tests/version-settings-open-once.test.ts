/**
 * LP設定（記事設定）の画面は、続けて2回開こうとしても1枚だけ開く（2026-10-27）。
 * 右の「LP設定」のアイコンには、開く処理が2つ付いている（採取した歯車の目印と、右のアイコンの並び）。
 * 設定を読み込む間に2回目が通ると、同じ画面が2枚重なり、保存しても後ろの1枚（古い値のまま）が残っていた
 * ＝そこで保存すると、背景の画像などが古い値へ戻る。
 */
import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'

describe('LP設定の画面', () => {
  it('続けて2回開こうとしても1枚だけ開く', async () => {
    const { window } = parseHTML('<!doctype html><html><head></head><body></body></html>')
    const g = globalThis as unknown as Record<string, unknown>
    for (const key of ['document', 'window', 'DOMParser', 'Event', 'HTMLElement', 'HTMLInputElement', 'Node']) g[key] = (window as unknown as Record<string, unknown>)[key]
    // linkedom の select は value を入れられない（読むだけ）。入れられるようにする
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
    const sheet = {
      font_size: 17, font_family: '', color: '000000', text_align: '', line_height: null, letter_spacing: null,
      img_margin_top: null, img_margin_bottom: null, padding_top: null, padding_bottom: null, padding_right: null, padding_left: null,
      iframe_height: null, iframe_height_unit: '', delivery_version_width: null, delivery_version_width_unit: '',
      border_size: null, border_type: '', border_color: '', outer_background_color: '', outer_background_image: '',
      inner_background_color: '', inner_background_image: '',
    }
    g['fetch'] = async () => new Response(JSON.stringify({ master_style_sheet: sheet }), { status: 200 })
    const { openVersionSettings } = await import('../src/app/panels/version-settings.ts')
    await Promise.all([openVersionSettings('ARTICLE_X'), openVersionSettings('ARTICLE_X')])
    expect(window.document.querySelectorAll('[data-test="MasterStyleSheetModal-ModalWrapper"]').length).toBe(1)
  })
})

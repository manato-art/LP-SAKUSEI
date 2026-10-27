/**
 * LP設定の背景の見出し（2026-10-27 本人「Version背景設定→LP内背景・全体背景設定→外枠背景」「順番も逆にしてね」）。
 * 上に LP内背景（本文の白い部分）、下に 外枠背景（本文の外側）。見出しのすぐ下は、その見出しの背景の選択肢。
 */
import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'

describe('LP設定の背景の見出し', () => {
  it('上が「LP内背景」、下が「外枠背景」で、それぞれの下にその背景の選択肢が並ぶ', async () => {
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
      border_size: null, border_type: '', border_color: '', outer_background_color: '00FF6E', outer_background_image: '',
      inner_background_color: 'FF0000', inner_background_image: '',
    }
    g['fetch'] = async () => new Response(JSON.stringify({ master_style_sheet: sheet }), { status: 200 })
    const { openVersionSettings } = await import('../src/app/panels/version-settings.ts')
    await openVersionSettings('ARTICLE_X')

    const titles = [...window.document.querySelectorAll('[class*="_title_qyxur_126"]')]
    const backgroundTitles = titles.filter((title) => (title.textContent ?? '').includes('背景'))
    expect(backgroundTitles.map((title) => title.textContent)).toEqual(['LP内背景', '外枠背景'])
    const radioNameUnder = (title: Element): string | null | undefined =>
      title.nextElementSibling?.querySelector('input[type="radio"]')?.getAttribute('name')
    expect(backgroundTitles.map(radioNameUnder)).toEqual(['innerBackgroundRadio', 'outerBackgroundRadio'])
    expect(window.document.body.textContent).not.toContain('Version背景設定')
    expect(window.document.body.textContent).not.toContain('全体背景設定')
  })
})

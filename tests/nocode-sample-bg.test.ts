/**
 * 見本の部品の中の箱（カード・枠・ボタンなど）に背景の画像を敷く（2026-10-24 本人の選択「見本の中の箱も」）。
 *
 * 見本の中の要素には印（data-nc-bg="b1"）を付け、背景の画像の設定は見本の部品の bgs に持つ（要素は増やさない）。
 * 書き出しは「その部品の中の、その印の要素」にだけ効くCSS。
 */
import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import { BUILDER_TEMPLATE } from '../src/app/panels/nocode/templates/builder.ts'
import { nextSampleBgId, sampleBgCss, withSampleBg } from '../src/app/panels/nocode/templates/bg-image.ts'
import type { ItemData, TemplateData } from '../src/app/panels/nocode/templates/types.ts'

const IMG = `data:image/png;base64,${'A'.repeat(40)}`
const UID = 'nc-smplbg01'
const SAMPLE =
  '<style>.nc-aaaa1111 .card{background:#fff;border-radius:12px}</style>' +
  '<div class="nc nc-sample nc-aaaa1111" data-nocode="sample"><div class="card" data-nc-bg="b1">カード</div><div class="card">2枚目</div></div>'

describe('印の名前', () => {
  it('b1・b2…の空いている番号（見本の中にもう付いている印とも重ならない）', () => {
    expect(nextSampleBgId([], '')).toBe('b1')
    expect(nextSampleBgId([{ id: 'b1' }], '')).toBe('b2')
    expect(nextSampleBgId([], '<div data-nc-bg="b1"></div><div data-nc-bg="b3"></div>')).toBe('b2')
  })
})

describe('設定の書き換え', () => {
  it('印の設定を足す・直す（ほかの印はそのまま）', () => {
    const first = withSampleBg([], 'b1', { bgImage: IMG })
    expect(first).toEqual([{ id: 'b1', bgImage: IMG }])
    const second = withSampleBg([...first, { id: 'b2', bgImage: IMG }], 'b1', { bgFit: 'free', bgSize: 40 })
    expect(second).toEqual([{ id: 'b1', bgImage: IMG, bgFit: 'free', bgSize: 40 }, { id: 'b2', bgImage: IMG }])
  })

  it('画像を外したら、その印の設定ごと外す', () => {
    expect(withSampleBg([{ id: 'b1', bgImage: IMG }], 'b1', { bgImage: '' })).toEqual([])
  })
})

describe('書き出し', () => {
  it('その部品の中の、その印の要素にだけ効く', () => {
    expect(sampleBgCss('.w', 'nc-b-3', { bgs: [{ id: 'b1', bgImage: IMG }] })).toBe(
      `.w .nc-b-3 [data-nc-bg="b1"]{background-image:url("${IMG}")!important;background-repeat:no-repeat!important;` +
        'background-origin:border-box!important;background-size:cover!important;background-position:50% 50%!important}',
    )
  })

  it('印の名前が決まった形でないものは書かない（CSSを壊さない）', () => {
    expect(sampleBgCss('.w', 'nc-b-3', { bgs: [{ id: 'b1"]{x', bgImage: IMG }] })).toBe('')
  })

  it('組み立てたWidgetの書き出しに入る（見本のCSSのあと）', () => {
    const data: TemplateData = {
      ...BUILDER_TEMPLATE.defaults(new Date(0)),
      screens: [{ id: 's1', name: '画面①', blocks: [{ type: 'sample', title: 'カード', html: SAMPLE, bgs: [{ id: 'b1', bgImage: IMG }] } as ItemData] }],
    }
    const html = BUILDER_TEMPLATE.render(data, UID)
    expect(html).toContain(`.${UID} .nc-b-1 [data-nc-bg="b1"]{background-image:url("${IMG}")!important`)
    // 印の付いた要素はそのまま（要素を増やさない）
    const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`)
    expect(document.querySelectorAll('.card')).toHaveLength(2)
    expect(document.querySelector('[data-nc-bg="b1"]')?.textContent).toBe('カード')
  })
})

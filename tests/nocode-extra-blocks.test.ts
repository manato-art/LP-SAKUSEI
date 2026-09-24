/**
 * 部品をもっと増やした（2026-09-24・本人「部品をもっと増やして」）。
 * 帯見出し・マーカー文章・特徴（アイコン＋文字）・口コミ（1件）・プロフィール・画像に文字・ビフォーアフター・
 * 電話ボタン・クーポン券・数字を並べる・ランキング・飾りの区切り
 */
import { describe, expect, it } from 'vitest'
import { ALL_BLOCK_TYPES, BUILDER_TEMPLATE } from '../src/app/panels/nocode/templates/builder.ts'
import type { ItemData, TemplateData } from '../src/app/panels/nocode/templates/types.ts'

const NOW = new Date(Date.UTC(2026, 8, 24, 3, 0))
const UID = 'nc-test0004'
const PNG = 'data:image/png;base64,iVBORw0KGgo='
const XSS = '<img src=x onerror=alert(1)>'

const EXTRA = ['band', 'marker', 'iconText', 'quote', 'profile', 'cover', 'beforeAfter', 'tel', 'coupon', 'numbers', 'ranking', 'ornament'] as const

const data = (blocks: readonly ItemData[]): TemplateData =>
  ({ ...BUILDER_TEMPLATE.defaults(NOW), screens: [{ id: 's1', name: '画面①', blocks }] }) as TemplateData
const render = (blocks: readonly ItemData[]): string => BUILDER_TEMPLATE.render(data(blocks), UID)
const validate = (blocks: readonly ItemData[]): string | null => BUILDER_TEMPLATE.validate(data(blocks), NOW)
const newItem = (type: string): ItemData => ALL_BLOCK_TYPES.find((t) => t.type === type)?.newItem() ?? {}

describe('もっと増やした部品', () => {
  it('どれも名前・絵・足したときの中身があり、足したばかりでも書き出せる', () => {
    for (const type of EXTRA) {
      const block = ALL_BLOCK_TYPES.find((t) => t.type === type)
      expect(block, type).toBeDefined()
      expect(block?.icon, type).toMatch(/^<svg /)
      expect(newItem(type)['type'], type).toBe(type)
      expect(render([newItem(type)]), type).toContain(`nc-b-${type}`)
    }
  })

  it('いちばん上に「幅」と「置く位置」がある（ほかの部品と同じ）', () => {
    for (const type of EXTRA) {
      const keys = ALL_BLOCK_TYPES.find((t) => t.type === type)?.fields.slice(0, 2).map((f) => f.key)
      expect(keys, type).toEqual(['boxWidth', 'place'])
    }
  })

  it('部品（型を除く）は36種になった（あとからロード中も足した）', () => {
    expect(ALL_BLOCK_TYPES.filter((t) => t.type !== 'sample' && !t.type.startsWith('tpl-')).length).toBe(36)
  })

  it('入力の文字は、どの部品でも文字として出す（タグにならない）', () => {
    const blocks: ItemData[] = [
      { type: 'band', text: XSS, look: 'fill', color: '#E5573F', size: 18 },
      { type: 'marker', text: XSS, color: '#FFE45C', size: 17, bold: true, align: 'center' },
      { type: 'iconText', icon: 'zz"><script>', title: XSS, text: XSS, color: '#1F7AE0' },
      { type: 'quote', stars: 4, text: XSS, name: XSS, photo: '' },
      { type: 'profile', photo: '', role: XSS, name: XSS, text: XSS, color: '#1F7AE0' },
      { type: 'cover', image: '', heading: XSS, text: XSS, align: 'center', shade: 35, height: 240 },
      { type: 'beforeAfter', before: PNG, after: PNG, beforeLabel: XSS, afterLabel: XSS, color: '#E5573F' },
      { type: 'tel', number: XSS, label: XSS, hours: XSS, color: '#0B7A3E', track: true },
      { type: 'coupon', title: XSS, amount: XSS, code: XSS, note: XSS, color: '#E5573F' },
      { type: 'numbers', text: `${XSS}|1|${XSS}`, color: '#E5573F' },
      { type: 'ranking', text: `${XSS}|${XSS}` },
      { type: 'ornament', look: 'zz"><script>', color: '#E5573F', height: 12 },
    ]
    const html = render(blocks)
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('zz"')
  })
})

describe('部品ごとの決まり', () => {
  it('電話ボタン: 番号の数字だけを tel: にする（押した数を数える印も）', () => {
    const html = render([{ type: 'tel', number: '0120-123-456', label: 'お電話', hours: '', color: '#0B7A3E', track: true }])
    expect(html).toContain('href="tel:0120123456"')
    expect(html).toContain('0120-123-456')
    expect(validate([{ type: 'tel', number: 'なし', label: '', hours: '', color: '#0B7A3E' }])).toContain('電話番号')
  })

  it('数字を並べる: 1行に1つ（上の文字|数字|単位）。行の数だけ横に並ぶ（4つまで）', () => {
    const html = render([{ type: 'numbers', text: '累計|10|万個\n満足度|98|%', color: '#E5573F' }])
    expect(html).toContain('nc-b-numbers--2')
    expect(html).toContain('<span class="nc-b-numbers__num">98</span><span class="nc-b-numbers__unit">%</span>')
    const five = render([{ type: 'numbers', text: 'a|1\nb|2\nc|3\nd|4\ne|5', color: '#E5573F' }])
    expect(five).toContain('nc-b-numbers--4')
  })

  it('ランキング: 1位〜3位は金・銀・銅の印', () => {
    const html = render([{ type: 'ranking', text: 'A|説明\nB\nC\nD' }])
    expect(html).toMatch(/nc-b-ranking__item--1"><span class="nc-b-ranking__rank">1<small>位<\/small>/)
    expect(html).toContain('nc-b-ranking__item--3')
    expect(html).toContain('nc-b-ranking__item--other')
  })

  it('口コミ: 星の数だけ塗る（読み上げは「5点中◯点」）', () => {
    const html = render([{ type: 'quote', stars: 4, text: 'よかった', name: '30代', photo: '' }])
    expect(html).toContain('aria-label="5点中4点"')
    expect(html).toContain('<span class="nc-b-quote__on">★★★★</span><span class="nc-b-quote__off">★</span>')
  })

  it('画像に文字: 画像を暗くする濃さと高さは、その部品だけのCSS', () => {
    const html = render([{ type: 'cover', image: PNG, heading: '見出し', text: '', align: 'left', shade: 50, height: 300 }])
    expect(html).toMatch(/\.nc-b-1\{min-height:300px\}/)
    expect(html).toContain('rgba(0,0,0,0.5)')
  })

  it('空の中身は保存の前に知らせる', () => {
    expect(validate([{ type: 'band', text: '' }])).toContain('帯見出し')
    expect(validate([{ type: 'marker', text: '' }])).toContain('マーカー')
    expect(validate([{ type: 'beforeAfter', before: PNG, after: '' }])).toContain('画像')
    expect(validate([{ type: 'coupon', amount: '' }])).toContain('クーポン')
    expect(validate([{ type: 'numbers', text: '' }])).toContain('数字')
    expect(validate([{ type: 'ranking', text: '' }])).toContain('ランキング')
    expect(validate([{ type: 'profile', name: '' }])).toContain('名前')
    expect(validate([{ type: 'quote', text: '' }])).toContain('口コミ')
  })
})

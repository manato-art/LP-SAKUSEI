/**
 * 部品を増やした（2026-09-24・本人「部品を足すの部品の数を増やして。必ず『移行先』を作る」）。
 *
 * - 移行先: ボタンや見本Widgetに被せる透明な押せる範囲。押したら画面②③…かURLへ（本人の選択「範囲を自由に置く」「移る先の画面/URL」）
 * - 吹き出し・価格・囲み枠・注意書き・表・星の評価・バッジ・画像を並べる・ポイント・数字で見せる・開いて読む・下向きの矢印
 */
import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import { ALL_BLOCK_TYPES, BUILDER_TEMPLATE } from '../src/app/panels/nocode/templates/builder.ts'
import { outermostBlock, readBlockFromCanvas } from '../src/app/panels/nocode/canvas-sync.ts'
import type { ItemData, TemplateData } from '../src/app/panels/nocode/templates/types.ts'

const NOW = new Date(Date.UTC(2026, 8, 24, 3, 0))
const UID = 'nc-test0003'
const PNG = 'data:image/png;base64,iVBORw0KGgo='
const XSS = '<img src=x onerror=alert(1)>'

const NEW_TYPES = [
  'hotspot',
  'speech',
  'price',
  'box',
  'note',
  'table',
  'rating',
  'badge',
  'gallery',
  'point',
  'stat',
  'accordion',
  'cue',
] as const

function data(screens: readonly ItemData[]): TemplateData {
  return { ...BUILDER_TEMPLATE.defaults(NOW), screens } as TemplateData
}
const render = (screens: readonly ItemData[]): string => BUILDER_TEMPLATE.render(data(screens), UID)
const validate = (screens: readonly ItemData[]): string | null => BUILDER_TEMPLATE.validate(data(screens), NOW)
const screen = (id: string, name: string, blocks: readonly ItemData[]): ItemData => ({ id, name, blocks })
const newItem = (type: string): ItemData => ALL_BLOCK_TYPES.find((t) => t.type === type)?.newItem() ?? {}

const BUTTON: ItemData = { type: 'button', label: '申し込む', look: 'cta', color: '#E5573F', action: 'none', target: '', url: '', track: true }

describe('増やした部品が「部品を足す」に並ぶ', () => {
  it('どれも名前・絵・足したときの中身がある', () => {
    for (const type of NEW_TYPES) {
      const block = ALL_BLOCK_TYPES.find((t) => t.type === type)
      expect(block, type).toBeDefined()
      expect(block?.label.length, type).toBeGreaterThan(0)
      expect(block?.icon, type).toMatch(/^<svg /)
      expect(block?.newItem()['type'], type).toBe(type)
    }
  })

  it('移行先の名前は「移行先」', () => {
    expect(ALL_BLOCK_TYPES.find((t) => t.type === 'hotspot')?.label).toBe('移行先')
  })

  it('足したばかりの中身でも、書き出せる（空の部品でも壊れたHTMLにしない）', () => {
    for (const type of NEW_TYPES) {
      const html = render([screen('s1', '画面①', [BUTTON, newItem(type)])])
      expect(html, type).toContain(`nc-b-${type}`)
    }
  })
})

describe('移行先（被せる押せる範囲）', () => {
  const two = (hotspot: ItemData): readonly ItemData[] => [
    screen('s1', '画面①', [BUTTON, hotspot]),
    screen('s2', '画面②', [{ type: 'heading', text: 'ありがとう', size: 21, align: 'center', color: '#1F2A37' }]),
  ]

  it('すぐ上の部品の中に入り、押したら選んだ画面へ移る（読み上げには移る先の名前）', () => {
    const html = render(two({ type: 'hotspot', x: 10, y: 20, w: 50, h: 60, action: 'screen', target: 's2', url: '', track: true }))
    // ボタンの部品（nc-b-1）の中、閉じる前に入る
    expect(html).toMatch(/<div class="nc-b nc-b-button nc-b-button--cta nc-b-1">.*<span class="nc-b nc-b-hotspot nc-b-2"[^>]*><\/span><\/div>/)
    expect(html).toContain('data-nc-go="s2"')
    expect(html).toContain('aria-label="画面②へ"')
    // 位置と大きさは被せた部品に対する %。被せた部品は位置の基準になる
    expect(html).toMatch(/\.nc-b-2\{left:10%;top:20%;width:50%;height:60%\}/)
    expect(html).toMatch(/\.nc-b-1\{position:relative;isolation:isolate\}/)
  })

  it('リンクを開くなら <a>（クリック数を数える印も）', () => {
    const html = render(two({ type: 'hotspot', action: 'link', url: 'https://example.com/apply', target: '', track: true }))
    expect(html).toMatch(/<a class="nc-b nc-b-hotspot nc-b-2"[^>]*href="https:\/\/example\.com\/apply/)
    expect(html).toContain('aria-label="リンクを開く"')
  })

  it('見本の部品にも被せられる', () => {
    const sample: ItemData = { type: 'sample', title: '見本', html: '<div class="x">中身</div>' }
    const html = render([
      screen('s1', '画面①', [sample, { type: 'hotspot', x: 0, y: 50, w: 100, h: 50, action: 'screen', target: 's2' }]),
      screen('s2', '画面②', [BUTTON]),
    ])
    expect(html).toMatch(/<div class="nc-b nc-b-sample nc-b-1"><div class="x">中身<\/div><span class="nc-b nc-b-hotspot nc-b-2"/)
  })

  it('移る先が選ばれていない・被せる部品が無いときは、保存の前に知らせる', () => {
    expect(validate(two({ type: 'hotspot', action: 'none', target: '', url: '' }))).toContain('移行先')
    expect(
      validate([screen('s1', '画面①', [{ type: 'hotspot', action: 'link', url: 'https://example.com', target: '' }, BUTTON])]),
    ).toContain('被せる部品')
    expect(validate(two({ type: 'hotspot', action: 'link', url: ' ', target: '' }))).toContain('開くページ')
    expect(validate(two({ type: 'hotspot', action: 'screen', target: 's2' }))).toBeNull()
  })

  it('区切り線（中に何も入らない部品）には被せない', () => {
    const problem = validate([
      screen('s1', '画面①', [{ type: 'divider', style: 'solid' }, { type: 'hotspot', action: 'link', url: 'https://example.com' }]),
    ])
    expect(problem).toContain('区切り線')
  })

  it('見たまま画面では、移行先を押すと移行先を選ぶ（被せた部品ではなく）', () => {
    const html = render(two({ type: 'hotspot', action: 'screen', target: 's2' }))
    const { document, window } = parseHTML(`<!doctype html><html><body><div id="root">${html}</div></body></html>`)
    const g = globalThis as unknown as Record<string, unknown>
    g['Node'] = window.Node
    g['HTMLElement'] = window.HTMLElement
    const root = document.getElementById('root') as unknown as HTMLElement
    const hot = root.querySelector('.nc-b-hotspot') as unknown as HTMLElement
    const label = root.querySelector('.nc-b-button__label') as unknown as HTMLElement
    expect(outermostBlock(hot, root)).toBe(hot)
    expect(outermostBlock(label, root)?.classList.contains('nc-b-button')).toBe(true)
    // 被せた部品の文字を読み戻すときに、移行先を中身へ混ぜない
    const heading = parseHTML(
      '<h2 class="nc-b nc-b-heading nc-b-1">見出し<span class="nc-b nc-b-hotspot nc-b-2" data-nc-go="s2"></span></h2>',
    ).document.querySelector('h2') as unknown as HTMLElement
    expect(readBlockFromCanvas(heading, { type: 'heading', text: 'x' })).toEqual({ type: 'heading', text: '見出し' })
    const sampleEl = parseHTML(
      '<div class="nc-b nc-b-sample nc-b-1"><p>中身</p><span class="nc-b nc-b-hotspot nc-b-2"></span></div>',
    ).document.querySelector('div') as unknown as HTMLElement
    expect(readBlockFromCanvas(sampleEl, { type: 'sample', html: '<p>x</p>' })?.['html']).toBe('<p>中身</p>')
  })
})

describe('ほかの増やした部品', () => {
  it('価格: 通常価格に取り消し線・特別価格・割引率は数字から出す', () => {
    const html = render([
      screen('s1', '画面①', [{ type: 'price', regularLabel: '通常価格', regular: '9,800円', label: '初回限定', price: '1,960', unit: '円（税込）', off: true, color: '#E5573F' }]),
    ])
    expect(html).toContain('<s class="nc-b-price__was">9,800円</s>')
    expect(html).toContain('1,960')
    expect(html).toContain('80<small>%OFF</small>')
  })

  it('表: 1行に1つ・「|」で区切る。1行目を見出しにできる。入力の文字はそのまま文字として出す', () => {
    const html = render([
      screen('s1', '画面①', [{ type: 'table', text: `項目|内容\n送料|無料\n${XSS}|x`, head: true, color: '#1F7AE0' }]),
    ])
    expect(html).toContain('<thead><tr><th scope="col">項目</th><th scope="col">内容</th></tr></thead>')
    expect(html).toContain('<tr><th scope="row">送料</th><td>無料</td></tr>')
    expect(html).not.toContain('<img src=x')
  })

  it('星の評価: 点数の分だけ星を塗る（5点まで）', () => {
    const html = render([screen('s1', '画面①', [{ type: 'rating', score: 4.5, label: '満足度', note: '', color: '#F2A516' }])])
    expect(html).toContain('aria-label="5点中4.5点"')
    expect(html).toMatch(/\.nc-b-1 \.nc-b-rating__fill\{width:90%\}/)
    expect(render([screen('s1', '画面①', [{ type: 'rating', score: 9, label: '', note: '', color: '#F2A516' }])])).toContain('5点中5点')
  })

  it('画像を並べる: 選んだ画像の数だけ横に並べる', () => {
    const html = render([screen('s1', '画面①', [{ type: 'gallery', image1: PNG, image2: PNG, image3: '', gap: 8, round: true }])])
    expect(html).toContain('nc-b-gallery--2')
    expect(html.match(/<img /g)?.length).toBe(2)
  })

  it('開いて読む: 押すと開く（最初から開いておくこともできる）', () => {
    const closed = render([screen('s1', '画面①', [{ type: 'accordion', title: '条件', text: '本文', open: false, color: '#1F2A37' }])])
    expect(closed).toMatch(/<details class="nc-b nc-b-accordion nc-b-1"><summary/)
    const opened = render([screen('s1', '画面①', [{ type: 'accordion', title: '条件', text: '本文', open: true, color: '#1F2A37' }])])
    expect(opened).toContain('nc-b-1" open>')
  })

  it('下向きの矢印: 動かすときは、動きを減らす設定の人には止める', () => {
    const html = render([screen('s1', '画面①', [{ type: 'cue', text: '詳しくはこちら', color: '#E5573F', move: true }])])
    expect(html).toContain('@keyframes nc-b-cue-bob')
    expect(html).toContain('prefers-reduced-motion:reduce')
  })

  it('入力の文字は、どの部品でも文字として出す（タグにならない）', () => {
    const blocks: ItemData[] = [
      { type: 'speech', name: XSS, text: XSS, side: 'left', color: '#F1F3F5', avatar: '' },
      { type: 'price', regularLabel: XSS, regular: XSS, label: XSS, price: XSS, unit: XSS, off: true, color: '#E5573F' },
      { type: 'box', title: XSS, text: XSS, look: 'soft', color: '#1F7AE0' },
      { type: 'note', text: XSS, mark: true },
      { type: 'rating', score: 4, label: XSS, note: XSS, color: '#F2A516' },
      { type: 'badge', text: XSS, look: 'pill', color: '#E5573F' },
      { type: 'point', kicker: XSS, heading: XSS, text: XSS, color: '#E5573F' },
      { type: 'stat', label: XSS, value: XSS, unit: XSS, note: XSS, color: '#E5573F' },
      { type: 'accordion', title: XSS, text: XSS, open: false, color: '#1F2A37' },
      { type: 'cue', text: XSS, color: '#E5573F', move: false },
    ]
    const html = render([screen('s1', '画面①', blocks)])
    expect(html).not.toContain('<img src=x')
  })

  it('空の中身は保存の前に知らせる', () => {
    expect(validate([screen('s1', '画面①', [{ type: 'speech', text: '', name: '', side: 'left' }])])).toContain('吹き出し')
    expect(validate([screen('s1', '画面①', [{ type: 'price', price: '' }])])).toContain('価格')
    expect(validate([screen('s1', '画面①', [{ type: 'table', text: ' ' }])])).toContain('表')
    expect(validate([screen('s1', '画面①', [{ type: 'gallery', image1: PNG, image2: '' }])])).toContain('画像')
    expect(validate([screen('s1', '画面①', [{ type: 'accordion', title: '条件', text: '' }])])).toContain('開いて読む')
  })
})

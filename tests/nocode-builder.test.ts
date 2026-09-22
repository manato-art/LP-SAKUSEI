/**
 * 「部品を積んで作る」（2026-09-22・本人の依頼。ノーコードでWidgetを作る④）。
 *
 * 見出し・文章・画像・ボタン・余白・区切り線・箇条書き・画像と文章 を上から順に積んで、自由にWidgetを作る。
 * Widget全体の背景の色と上下の余白も選べる。書き出しの安全さは「型から作る」と同じ（kit.ts）。
 */
import { describe, expect, it } from 'vitest'
import { BUILDER_TEMPLATE } from '../src/app/panels/nocode/templates/builder.ts'
import type { ItemData, TemplateData } from '../src/app/panels/nocode/templates/types.ts'

const NOW = new Date(Date.UTC(2026, 8, 22, 3, 0))
const UID = 'nc-test0002'
const PNG = 'data:image/png;base64,iVBORw0KGgo='
const XSS = '<img src=x onerror=alert(1)>'

function render(blocks: readonly ItemData[], extra: Record<string, unknown> = {}): string {
  const data = { ...BUILDER_TEMPLATE.defaults(NOW), blocks, ...extra } as TemplateData
  return BUILDER_TEMPLATE.render(data, UID)
}

describe('部品を積む', () => {
  it('見本の中身（見出し・文章・箇条書き・ボタン）のままでも入れられる', () => {
    const data = BUILDER_TEMPLATE.defaults(NOW)
    expect(BUILDER_TEMPLATE.validate(data, NOW)).toBeNull()
    expect(BUILDER_TEMPLATE.render(data, UID)).toContain(`class="nc nc-builder ${UID}"`)
  })

  it('積んだ順に出す', () => {
    const html = render([
      { type: 'heading', text: 'はじめての方へ', size: 'l', align: 'center', color: '#1F2A37' },
      { type: 'text', text: '1行目\n2行目', align: 'left' },
      { type: 'divider', style: 'solid' },
      { type: 'spacer', size: 'm' },
    ])
    const order = ['nc-b-heading', 'nc-b-text', 'nc-b-divider', 'nc-b-spacer'].map((c) => html.indexOf(`nc-b ${c}`))
    expect(order.every((at) => at > 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(html).toContain('1行目<br>2行目')
  })

  it('見出しの大きさ・寄せ・色は部品ごと（ほかの見出しに移らない）', () => {
    const html = render([
      { type: 'heading', text: 'A', size: 'l', align: 'center', color: '#E5573F' },
      { type: 'heading', text: 'B', size: 's', align: 'left', color: '#1F7AE0' },
    ])
    expect(html).toMatch(/\.nc-b-1\{[^}]*color:#E5573F/)
    expect(html).toMatch(/\.nc-b-2\{[^}]*color:#1F7AE0/)
    expect(html).toContain('<h2 class="nc-b nc-b-heading nc-b-heading--l nc-b--center nc-b-1">A</h2>')
  })

  it('ボタンは「ボタン」の型と同じ見た目で、計測の目印も付けられる', () => {
    const html = render([{ type: 'button', label: '申し込む', url: 'https://shop.example.test/', track: true, color: '#06C755' }])
    expect(html).toContain('href="https://shop.example.test/?sb_tracking=true"')
    expect(html).toMatch(/background:#06C755/)
  })

  it('箇条書きは1行が1つ。空の行は数えない', () => {
    const html = render([{ type: 'list', text: '送料無料\n\n30日間返品OK\n', marker: 'check' }])
    expect(html.match(/<li class="nc-b-list__item"/g)?.length).toBe(2)
  })

  it('画像と文章は、画像を左か右に置ける（狭い画面では縦に並ぶ）', () => {
    const html = render([{ type: 'imageText', image: PNG, heading: '使い方', text: '説明', side: 'right' }])
    expect(html).toContain('nc-b-imageText--right')
    expect(html).toContain(`src="${PNG}"`)
    expect(html).toMatch(/@media \(max-width:480px\)/)
  })

  it('背景の色と上下の余白は Widget 全体に効く', () => {
    const html = render([{ type: 'text', text: 'x', align: 'left' }], { background: '#FFF8E7', padding: 'l' })
    expect(html).toMatch(new RegExp(`\\.${UID}\\{[^}]*background:#FFF8E7`))
    expect(html).toMatch(new RegExp(`\\.${UID}\\{[^}]*padding:56px 16px`))
  })

  it('部品の文字に <script> や onerror を書かれても文字として出るだけ', () => {
    const html = render([
      { type: 'heading', text: XSS, size: 'm', align: 'left', color: '#1F2A37' },
      { type: 'text', text: XSS, align: 'left' },
      { type: 'list', text: XSS, marker: 'dot' },
      { type: 'button', label: XSS, url: 'javascript:alert(1)', track: false, color: '#E5573F' },
      { type: 'image', image: PNG, alt: XSS, url: 'javascript:alert(2)', width: '100' },
      { type: 'imageText', image: PNG, heading: XSS, text: XSS, side: 'left' },
    ])
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('<script')
  })
})

describe('入れる前の確かめ', () => {
  it('部品が1つも無い・文字の無いボタン・画像を選んでいない画像は入れられない', () => {
    const base = BUILDER_TEMPLATE.defaults(NOW)
    expect(BUILDER_TEMPLATE.validate({ ...base, blocks: [] }, NOW)).toContain('部品')
    expect(
      BUILDER_TEMPLATE.validate({ ...base, blocks: [{ type: 'button', label: ' ', url: '', track: true, color: '#E5573F' }] }, NOW),
    ).toContain('ボタンの文字')
    expect(BUILDER_TEMPLATE.validate({ ...base, blocks: [{ type: 'image', image: '', alt: '', url: '', width: '100' }] }, NOW)).toContain(
      '画像',
    )
  })
})

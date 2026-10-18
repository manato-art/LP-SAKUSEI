/**
 * 見本の部品（ライブラリの見本・手で書いたHTML）の CSS を、その部品の中だけに効かせる（2026-10-18 本人の指摘）。
 *
 * 本人「両方青くなった、青が最後に入れた」: 赤い矢印と青い矢印を別々の「組み立てたWidget」に入れたら、
 * LPでは両方とも青になった。矢印は手で書いたHTMLの見本で、CSS が `.downArrow{--arrow-color:…}` と
 * 範囲を持たないため、ページ全体に効き、あとに入れた Widget の色が前の Widget にも効いていた。
 */
import { describe, expect, it } from 'vitest'
import { BUILDER_TEMPLATE } from '../src/app/panels/nocode/templates/builder.ts'
import { scopeCss, scopeSampleStyles } from '../src/app/panels/nocode/sample-css-scope.ts'
import type { ItemData, TemplateData } from '../src/app/panels/nocode/templates/types.ts'

const arrowSample = (color: string): string =>
  `<style>.downArrow {\n  --arrow-color: ${color};\n  display: flex;\n}\n.downArrow span {\n  background: var(--arrow-color);\n}\n` +
  `@keyframes arrowDown {\n  0%, 100% { transform: translateY(0); }\n  50% { transform: translateY(12px); }\n}\n` +
  `@media (prefers-reduced-motion: reduce) {\n  .movebtn span { animation: none; }\n}</style>` +
  `<div class="downArrow movebtn">\n<span></span><span></span><span></span>\n</div>`

function renderWidget(uid: string, blocks: readonly ItemData[]): string {
  const data: TemplateData = {
    ...BUILDER_TEMPLATE.defaults(new Date()),
    screens: [{ id: 's1', name: '画面①', blocks }],
  }
  return BUILDER_TEMPLATE.render(data, uid)
}

/** CSS の中の規則の頭（セレクタ）だけを並べる */
const selectorsOf = (html: string): string[] =>
  [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)]
    .flatMap((m) => [...(m[1] ?? '').matchAll(/(?:^|\})\s*([^{}@]+?)\s*\{/g)].map((r) => (r[1] ?? '').trim()))

describe('別々の Widget に同じ見本を入れて色を変える', () => {
  const red = renderWidget('nc-aaaa1111', [{ type: 'sample', title: '矢印', html: arrowSample('#ff0000') }])
  const blue = renderWidget('nc-bbbb2222', [{ type: 'sample', title: '矢印', html: arrowSample('#4000ff') }])

  it('見本の CSS は、その Widget のその部品の中だけを指す（あとに入れた Widget の色が前の Widget に効かない）', () => {
    expect(red).toMatch(/\.nc-aaaa1111 \.nc-b-1 \.downArrow\s*\{\s*--arrow-color: #ff0000/)
    expect(blue).toMatch(/\.nc-bbbb2222 \.nc-b-1 \.downArrow\s*\{\s*--arrow-color: #4000ff/)
    for (const sel of [...selectorsOf(red), ...selectorsOf(blue)]) {
      if (/^(?:from|to|\d+%)/.test(sel)) continue // @keyframes の中
      expect(sel).toMatch(/^\.nc-(?:aaaa1111|bbbb2222)\b/)
    }
  })

  it('@media の中も同じように範囲をつける・@keyframes はそのまま', () => {
    expect(red).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.nc-aaaa1111 \.nc-b-1 \.movebtn span\s*\{/)
    expect(red).toMatch(/@keyframes arrowDown\s*\{\s*0%, 100% \{ transform: translateY\(0\); \}/)
  })

  it('見本の中身（HTML）は変えない', () => {
    expect(red).toContain('<div class="downArrow movebtn">\n<span></span><span></span><span></span>\n</div>')
  })
})

describe('1つの Widget に同じ見本を2つ入れて色を変える', () => {
  it('部品ごとに別の範囲になる', () => {
    const html = renderWidget('nc-cccc3333', [
      { type: 'sample', title: '矢印', html: arrowSample('#ff0000') },
      { type: 'sample', title: '矢印', html: arrowSample('#4000ff') },
    ])
    expect(html).toMatch(/\.nc-cccc3333 \.nc-b-1 \.downArrow\s*\{\s*--arrow-color: #ff0000/)
    expect(html).toMatch(/\.nc-cccc3333 \.nc-b-2 \.downArrow\s*\{\s*--arrow-color: #4000ff/)
  })
})

describe('CSS に範囲をつける', () => {
  const S = '.nc-w .nc-b-1'

  it('ふつうの規則・セレクタの並び', () => {
    expect(scopeCss('.a{color:red}.b,.c > d{margin:0}', S)).toBe(`${S} .a{color:red}${S} .b,${S} .c > d{margin:0}`)
  })

  it('括弧の中のカンマでは分けない', () => {
    expect(scopeCss(':is(.a, .b) p{color:red}', S)).toBe(`${S} :is(.a, .b) p{color:red}`)
  })

  it('body / html から始まるものは、ページ側を外して範囲の中にする', () => {
    expect(scopeCss('body .x{color:red}', S)).toBe(`${S} .x{color:red}`)
  })

  it(':root / html / body そのものは、CSS変数だけを範囲へ移す（背景などページ全体の指定は持ち込まない）', () => {
    expect(scopeCss(':root{--c:#f00;background:#000}', S)).toBe(`${S}{--c:#f00}`)
    expect(scopeCss('body{margin:0}', S)).toBe('')
  })

  it('@supports / @container の中にも範囲をつける', () => {
    expect(scopeCss('@supports (display:grid){.g{display:grid}}', S)).toBe(`@supports (display:grid){${S} .g{display:grid}}`)
    expect(scopeCss('@container (min-width:400px){.g{gap:8px}}', S)).toBe(`@container (min-width:400px){${S} .g{gap:8px}}`)
  })

  it('@font-face・@import はそのまま', () => {
    expect(scopeCss('@import url("x.css");@font-face{font-family:A;src:url(a.woff)}', S)).toBe(
      '@import url("x.css");@font-face{font-family:A;src:url(a.woff)}',
    )
  })

  it('文字の中の { } ; やコメントで崩れない', () => {
    expect(scopeCss('/* 説明 { */.q::before{content:"};{"}', S)).toBe(`${S} .q::before{content:"};{"}`)
  })

  it('<style> だけを書き換え、<script> と本文は触らない', () => {
    const html = '<style>.q{color:red}</style><div class="q">問い</div><script>var s=".q{"</script>'
    expect(scopeSampleStyles(html, S)).toBe(`<style>${S} .q{color:red}</style><div class="q">問い</div><script>var s=".q{"</script>`)
  })
})

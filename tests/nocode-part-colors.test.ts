/**
 * 部品ごとに色を分けて決める（2026-10-25 本人「ボタンの色と文字の色は別で決めたい。文字はストロークや不透明度も決めたい」
 * →「ボタンと文字の部品全部」「部品ごとに分解」）。
 *
 * - ボタン（目立つ・選択肢）・電話ボタン: 地の色（今の「ボタンの色」）とは別に、枠の色・影の色（決めなければ自動）
 * - 文字を出す部品: 「文字の見た目」の段に 文字の色（決めなければ自動）・縁取りの色・縁取りの太さ
 * - どの色も不透明度を決められる（#RRGGBBAA）
 */
import { describe, expect, it } from 'vitest'
import { ALL_BLOCK_TYPES, BUILDER_TEMPLATE } from '../src/app/panels/nocode/templates/builder.ts'
import type { ItemData } from '../src/app/panels/nocode/templates/types.ts'

const UID = 'nc-partcol1'
const S = `.${UID}`
const render = (block: ItemData): string =>
  BUILDER_TEMPLATE.render({ ...BUILDER_TEMPLATE.defaults(new Date(0)), screens: [{ id: 's1', name: '画面①', blocks: [block] }] }, UID)
const keys = (type: string, section?: string): string[] =>
  (ALL_BLOCK_TYPES.find((t) => t.type === type)?.fields ?? []).filter((f) => section === undefined || f.section === section).map((f) => f.key)
const button = (extra: ItemData = {}): ItemData => ({ type: 'button', label: '申し込む', look: 'cta', color: '#E5573F', action: 'none', target: '', url: '', ...extra })

describe('右の欄', () => {
  it('ボタン・電話ボタン: 地の色のほかに 枠の色・影の色（自動あり）', () => {
    for (const type of ['button', 'tel']) {
      expect(keys(type), type).toEqual(expect.arrayContaining(['borderColor', 'shadowColor']))
      const field = ALL_BLOCK_TYPES.find((t) => t.type === type)?.fields.find((f) => f.key === 'borderColor')
      expect(field?.kind === 'color' ? field.auto : undefined).toBe('自動')
    }
  })

  it('文字を出す部品: 「文字の見た目」の段に 文字の色・縁取りの色・縁取りの太さ', () => {
    for (const type of ['button', 'tel', 'text', 'band', 'badge', 'point', 'list', 'box']) {
      expect(keys(type, 'text'), type).toEqual(['textColor', 'strokeColor', 'strokeWidth'])
    }
  })

  it('見出しは今の「文字の色」があるので、縁取りだけ足す', () => {
    expect(keys('heading', 'text')).toEqual(['strokeColor', 'strokeWidth'])
  })

  it('画像・動画・余白・線・飾り・見本には出さない', () => {
    for (const type of ['image', 'video', 'spacer', 'divider', 'ornament', 'cue', 'sample', 'hotspot', 'gallery']) {
      expect(keys(type, 'text'), type).toEqual([])
    }
  })
})

describe('書き出し: ボタン', () => {
  const face = `${S} .nc-b-1 .nc-b-button__a`

  it('文字の色・枠の色・影の色を、それぞれ別に（不透明度つきの色も）', () => {
    const html = render(button({ textColor: '#1F2A37', borderColor: '#FFFFFF80', shadowColor: '#00000040' }))
    expect(html).toContain(`${face}{border:2px solid #FFFFFF80}`)
    expect(html).toContain(`${face}{box-shadow:0 6px 0 #00000040,0 12px 22px rgba(0,0,0,.14)}`)
    expect(html).toContain(`${face}:active{box-shadow:0 1px 0 #00000040,0 4px 10px rgba(0,0,0,.12)}`)
    expect(html).toContain(`${face}{color:#1F2A37;text-shadow:none}`)
  })

  it('選択肢: 枠と影は選択肢の形で。選んだとき（塗る）の文字は今までどおり読みやすい色', () => {
    const html = render(button({ look: 'choice', textColor: '#1F7AE0', borderColor: '#1F2A37', shadowColor: '#1F2A37' }))
    expect(html).toContain(`${face}{border-color:#1F2A37}`)
    expect(html).toContain(`${face}{box-shadow:0 3px 0 #1F2A37}${face}:active{box-shadow:0 1px 0 #1F2A37}`)
    expect(html).toContain(`${face}{color:#1F7AE0;text-shadow:none}`)
    expect(html).toMatch(new RegExp(`${face.replace(/\./g, '\\.')}\\[aria-pressed="true"\\]\\{background:#E5573F;color:#FFFFFF`))
  })

  it('文字の縁取り（太さは見た目の太さ＝線は文字の外側だけに出す）', () => {
    expect(render(button({ strokeWidth: 1.5, strokeColor: '#FFFFFF' }))).toContain(`${face}{-webkit-text-stroke:3px #FFFFFF;paint-order:stroke fill}`)
  })

  it('決めていなければ今までどおり（上書きを書かない）', () => {
    const html = render(button())
    expect(html).not.toContain('text-shadow:none')
    expect(html).not.toContain('-webkit-text-stroke')
    expect(html).not.toContain('border:2px solid')
  })
})

describe('書き出し: 文字の部品', () => {
  it('部品の文字（中の飾りの印・アイコンは除く）。数字の色など部品の色の欄で決めた所はそのまま', () => {
    const html = render({ type: 'point', kicker: 'POINT 01', heading: '見出し', text: '本文', color: '#E5573F', textColor: '#1F7AE0' })
    expect(html).toContain(
      `${S} .nc-b-1,${S} .nc-b-1 :where(:not([class*="__mark"],[class*="__icon"],[class*="__mark"] *,[class*="__icon"] *)){color:#1F7AE0}`,
    )
  })

  it('色の付いた面に文字が載る部品（バッジ・帯見出し・電話ボタンなど）は、その面の文字', () => {
    expect(render({ type: 'badge', text: '今だけ', shape: 'pill', color: '#E5573F', textColor: '#1F2A37' })).toContain(
      `${S} .nc-b-1 .nc-b-badge__in{color:#1F2A37;text-shadow:none}`,
    )
  })

  it('見出し: 縁取り', () => {
    expect(render({ type: 'heading', text: '見出し', size: 21, align: 'center', color: '#1F2A37', strokeWidth: 2, strokeColor: '#FFFFFFCC' })).toContain(
      `${S} .nc-b-1{-webkit-text-stroke:4px #FFFFFFCC;paint-order:stroke fill}`,
    )
  })

  it('決まった形でない色は書かない（CSSを壊さない）', () => {
    expect(render(button({ textColor: 'red;}body{x:1' }))).not.toContain('body{x:1')
  })
})

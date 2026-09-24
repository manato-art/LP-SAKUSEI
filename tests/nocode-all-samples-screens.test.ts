/**
 * 全部の見本Widgetを照合（2026-09-24・本人「ボタンを押して移行するものは画面①②③に分けて。全ウィジェットを1回照合して」）。
 *
 * - ボタンで設問①②③…と移る見本（中に画面の入れ物がある）は、Widget編集で開くと画面①②③に分かれる
 * - 分けたあと、どのボタンの移る先（「前の質問にもどる」も）も、実在する画面を指している
 * - 画面の入れ物を持たない見本に、隠れた段（hidden）やスクリプトで切り替える作りは無い（＝1つの部品のままでよい）
 */
import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import { NEW_SAMPLES } from '../src/app/panels/nocode/samples/index.ts'
import { wrapHtmlAsBuilder } from '../src/app/panels/nocode/builder-data.ts'
import { BUILDER_TEMPLATE } from '../src/app/panels/nocode/templates/builder.ts'

const NOW = new Date(Date.UTC(2026, 8, 24, 3, 0))
const parse = (html: string): Element => {
  const { document } = parseHTML(`<!doctype html><html><body><div id="r">${html}</div></body></html>`)
  return document.getElementById('r') as unknown as Element
}

type Screen = { id: string; name: string; blocks: { type: string; html: string }[] }

const withScreens = NEW_SAMPLES.filter((s) => s.html.includes('data-nc-screens'))
const plain = NEW_SAMPLES.filter((s) => !s.html.includes('data-nc-screens'))

describe('全部の見本Widgetの照合', () => {
  it('見本は106本・そのうちボタンで画面を移るものは8本', () => {
    expect(NEW_SAMPLES.length).toBe(106)
    expect(withScreens.map((s) => s.id).sort()).toEqual(
      ['diagnosis-type', 'survey-choices', 'survey-gate', 'survey-multi', 'survey-nps', 'survey-one', 'survey-scale', 'survey-yesno'].sort(),
    )
  })

  it.each(withScreens.map((s) => [s.id, s] as const))('%s: 画面①②③…に分かれ、どのボタンも実在する画面へ移る', (_id, sample) => {
    const data = wrapHtmlAsBuilder(sample.html, sample.name, BUILDER_TEMPLATE.defaults(NOW), parse)
    const screens = data['screens'] as Screen[]
    const inner = (sample.html.match(/data-nc-screen="/g) ?? []).length
    expect(screens.length).toBe(inner)
    expect(screens.length).toBeGreaterThanOrEqual(2)
    const ids = new Set(screens.map((s) => s.id))
    for (const screen of screens) {
      expect(screen.blocks).toHaveLength(1)
      const html = screen.blocks[0]?.html ?? ''
      expect(html).not.toContain('data-nc-screens')
      for (const m of html.matchAll(/data-nc-go="([^"]*)"/g)) expect(ids.has(m[1] ?? '')).toBe(true)
    }
    expect(BUILDER_TEMPLATE.validate(data, NOW)).toBeNull()
  })

  // 2026-09-24 本人「バグってるよ」: 分けると見本の外枠（名前 nc-xxxxxxxx の付いた箱）まで外していて、
  // 見本のCSS（.nc-xxxxxxxx .y-done など）が何も効かず、お礼の画面の矢印が画面いっぱいに出ていた
  it.each(withScreens.map((s) => [s.id, s] as const))('%s: 分けたどの画面も、見本の外枠の中に中身があり、見本のCSSが効く', (_id, sample) => {
    const uid = /class="nc nc-sample (nc-[a-z0-9]{8})"/.exec(sample.html)?.[1] ?? ''
    expect(uid).not.toBe('')
    const data = wrapHtmlAsBuilder(sample.html, sample.name, BUILDER_TEMPLATE.defaults(NOW), parse)
    for (const screen of data['screens'] as Screen[]) {
      const box = parse(screen.blocks[0]?.html ?? '')
      const frame = box.querySelector(`.${uid}`)
      expect(frame, `${screen.name} に外枠がない`).not.toBeNull()
      // 画面の中身（見出し・ボタンなど）は外枠の中にある
      expect((frame?.textContent ?? '').trim().length).toBeGreaterThan(0)
      const outside = Array.from(box.children).filter((c) => !['STYLE', 'SCRIPT'].includes(c.tagName.toUpperCase()))
      expect(outside).toEqual([frame])
      // 画面の切り替えの目印は残さない（切り替えは画面①②③が受け持つ）
      expect(frame?.hasAttribute('data-nc-screens')).toBe(false)
      expect(box.querySelector('[data-nc-screen]')).toBeNull()
    }
  })

  it('画面の入れ物を持たない98本は、スクリプトも隠れた段も持たない（1つの部品のままでよい）', () => {
    expect(plain.length).toBe(98)
    for (const sample of plain) {
      expect(sample.html, sample.id).not.toMatch(/<script\b/i)
      expect(sample.html, sample.id).not.toMatch(/\shidden(=|\s|>)/)
      expect(wrapHtmlAsBuilder(sample.html, sample.name, BUILDER_TEMPLATE.defaults(NOW), parse)['screens']).toHaveLength(1)
    }
  })
})

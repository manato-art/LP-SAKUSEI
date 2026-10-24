/**
 * Widgetライブラリの「アンケート・診断」に、Widget編集の「アンケート」の型を出す
 * （2026-10-24 本人「あなたが今作ったアンケート結構いいから、ここにも反映してほしい」）。
 *
 * - 「回答をはじめる」ボタンから／すぐ Q1 から の2本を、アンケート・診断の先頭に並べる
 * - 中身は Widget編集の型と同じ（部品で作ったWidget＝設定データつき）。LPに入れてから開いても、
 *   「画面を作って使う」から開いても、部品のまま直せる（進み具合も自動で並び直す）
 * - Widget編集の「ライブラリの見本から選ぶ」で選んだときは、部品の1つにせず Widget の中身ごとアンケートにする
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import { LIBRARY_SAMPLES, SURVEY_SAMPLES } from '../src/app/panels/nocode/library-surveys.ts'
import { NEW_SAMPLES } from '../src/app/panels/nocode/samples/index.ts'
import { extractBuilderData } from '../src/app/panels/nocode/builder-data.ts'
import { BUILDER_TEMPLATE } from '../src/app/panels/nocode/templates/builder.ts'
import { rekeyUid } from '../src/app/panels/nocode/templates/kit.ts'
import { items, str } from '../src/app/panels/nocode/templates/types.ts'

const NOW = new Date('2026-10-24T12:00:00+09:00')
const screenNames = (html: string): string[] =>
  items(extractBuilderData(html)?.data ?? {}, 'screens').map((screen) => str(screen, 'name'))

describe('ライブラリに並ぶアンケート', () => {
  it('2本（回答をはじめるボタンから／すぐQ1から）が「アンケート・診断」の先頭に並ぶ。ほかの見本はそのまま', () => {
    const survey = LIBRARY_SAMPLES.filter((s) => s.category === 'アンケート・診断')
    expect(survey.slice(0, 2).map((s) => s.id)).toEqual(['survey-stack-start', 'survey-stack'])
    expect(LIBRARY_SAMPLES.filter((s) => s.isWholeWidget !== true)).toEqual(NEW_SAMPLES)
    expect(LIBRARY_SAMPLES).toHaveLength(NEW_SAMPLES.length + 2)
  })

  it('中身は Widget編集のアンケートの型と同じ（部品のまま開ける・下に積み重ねる）', () => {
    const [start, direct] = SURVEY_SAMPLES
    expect(screenNames(start?.html ?? '')).toEqual(['はじめ', 'Q1', 'Q2', 'Q3', '結果A', '結果B'])
    expect(screenNames(direct?.html ?? '')).toEqual(['Q1', 'Q2', 'Q3', '結果A', '結果B'])
    for (const sample of SURVEY_SAMPLES) {
      expect(sample.isWholeWidget).toBe(true)
      const found = extractBuilderData(sample.html)
      expect(found?.data['transition']).toBe('stack')
      expect(BUILDER_TEMPLATE.validate(found?.data ?? {}, NOW)).toBeNull()
      // 書き出しは設定データから作り直したものと同じ（Widget編集で保存したときと同じ形）
      expect(sample.html).toContain(BUILDER_TEMPLATE.render(found?.data ?? {}, found?.uid ?? '').slice(0, 200))
    }
  })

  it('LPに入れるたびに名前（uid）を付け直せる（CSSも設定データもそのまま使える）', () => {
    for (const sample of SURVEY_SAMPLES) {
      const uid = extractBuilderData(sample.html)?.uid ?? ''
      const next = rekeyUid(sample.html, 'nc-zzzzzzzz')
      expect(next.includes(uid)).toBe(false)
      expect(extractBuilderData(next)?.uid).toBe('nc-zzzzzzzz')
      expect(next.split('.nc-zzzzzzzz').length).toBeGreaterThan(5)
    }
  })

  it('外から読み込むものが無く、危ないものも入っていない。最初の画面だけ見えている', () => {
    for (const sample of SURVEY_SAMPLES) {
      expect(sample.html.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '')).not.toMatch(/https?:\/\//)
      expect(sample.html).not.toMatch(/\son[a-z]+=/i)
      expect(sample.html).not.toMatch(/javascript:/i)
      expect(sample.html).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
      const { document } = parseHTML(`<!doctype html><html><body>${sample.html}</body></html>`)
      const screens = [...document.querySelectorAll('[data-nc-screen]')]
      expect(screens.filter((s) => !s.hasAttribute('hidden'))).toHaveLength(1)
      expect(sample.html).toMatch(/<script>[\s\S]*data-nc-screen[\s\S]*<\/script>/)
    }
  })
})

describe('ライブラリの動き', () => {
  const library = readFileSync('src/app/panels/widget-library.ts', 'utf8')

  it('一覧はアンケートを足した並び（LIBRARY_SAMPLES）で出し、部品で作った見本のカードには印を付ける', () => {
    expect(library).toMatch(/LIBRARY_SAMPLES\.filter\(/)
    expect(library).toMatch(/sample\.isWholeWidget === true[\s\S]{0,80}ncWholeWidget/)
  })

  it('「画面を作って使う」は、部品で作った見本なら、その部品のまま開く', () => {
    expect(library).toMatch(/extractBuilderData\(bodyHtml\)/)
  })

  it('Widget編集から選ぶときは、アンケートの見本だと分かる印を渡す（お気に入りから選んでも同じ）', () => {
    expect(library).toMatch(/handOverToBuilder\(title, bodyHtml, card\.dataset\['ncWholeWidget'\] === 'true'\)/)
    expect(library).toMatch(/handOverToBuilder\(w\.name, rekeyUid\(w\.html, newUid\(\)\), WHOLE_SAMPLE_NAMES\.has\(w\.key\)\)/)
    const builder = readFileSync('src/app/panels/widget-studio-builder.ts', 'utf8')
    expect(builder).toMatch(/isWholeWidget !== true\) return sample[\s\S]{0,40}askWholeSample\(sample, hasParts\(\)\)/)
  })
})

/**
 * Widget編集の「まとまった型」に「アンケート」（2026-10-24 本人の選択「Widget編集に『アンケート』の型」）。
 * 押すと「回答をはじめる」ボタンのあり・なしを選び（本人の選択「選ぶ」）、Widget をアンケートの画面にする。
 * もう部品があるときは、置き換える前に確かめる（「戻す」で戻せる）。
 */
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const dialog = { choose: vi.fn(), confirm: vi.fn() }
vi.mock('../src/app/dialog.ts', () => ({
  chooseCard: (options: unknown) => dialog.choose(options),
  confirmCard: (options: unknown) => dialog.confirm(options),
}))

const { askSurveyData, askWholeSample } = await import('../src/app/panels/widget-studio-survey.ts')
const { SURVEY_SAMPLES } = await import('../src/app/panels/nocode/library-surveys.ts')
const names = (data: Record<string, unknown> | null): string[] =>
  ((data?.['screens'] ?? []) as { name: string }[]).map((s) => s.name)

beforeEach(() => {
  dialog.choose.mockReset()
  dialog.confirm.mockReset()
})

describe('「アンケート」を押したとき', () => {
  it('「回答をはじめる」ボタンのあり・なしを選ぶ（ありなら はじめ から）', async () => {
    dialog.choose.mockResolvedValue('button')
    const data = await askSurveyData(false)
    const asked = dialog.choose.mock.calls[0]?.[0] as { options: { value: string; label: string }[] }
    expect(asked.options.map((o) => o.label)).toEqual(['「回答をはじめる」ボタンから始める', 'すぐ Q1 から始める'])
    expect(names(data)).toEqual(['はじめ', 'Q1', 'Q2', 'Q3', '結果A', '結果B'])
    expect(dialog.confirm).not.toHaveBeenCalled()
  })

  it('なしなら Q1 から', async () => {
    dialog.choose.mockResolvedValue('direct')
    expect(names(await askSurveyData(false))).toEqual(['Q1', 'Q2', 'Q3', '結果A', '結果B'])
  })

  it('やめたら何もしない', async () => {
    dialog.choose.mockResolvedValue(null)
    expect(await askSurveyData(false)).toBeNull()
  })

  it('もう部品があるときは、置き換える前に確かめる（やめたら何もしない）', async () => {
    dialog.choose.mockResolvedValue('button')
    dialog.confirm.mockResolvedValue(false)
    expect(await askSurveyData(true)).toBeNull()
    const confirmed = dialog.confirm.mock.calls[0]?.[0] as { detail: string }
    expect(confirmed.detail).toContain('戻す')
    dialog.confirm.mockResolvedValue(true)
    expect(names(await askSurveyData(true))).toHaveLength(6)
  })
})

describe('ライブラリのアンケートを Widget編集で選んだとき（2026-10-24 本人「ここにも反映してほしい」）', () => {
  const sample = { title: SURVEY_SAMPLES[0]?.name ?? '', html: SURVEY_SAMPLES[0]?.html ?? '' }

  it('部品が無ければ、そのままアンケートの中身にする（部品のまま直せる中身）', async () => {
    expect(names(await askWholeSample(sample, false))).toEqual(['はじめ', 'Q1', 'Q2', 'Q3', '結果A', '結果B'])
    expect(dialog.confirm).not.toHaveBeenCalled()
  })

  it('もう部品があるときは、置き換える前に確かめる（やめたら何もしない）', async () => {
    dialog.confirm.mockResolvedValue(false)
    expect(await askWholeSample(sample, true)).toBeNull()
    const confirmed = dialog.confirm.mock.calls[0]?.[0] as { title: string; detail: string }
    expect(confirmed.title).toContain(sample.title)
    expect(confirmed.detail).toContain('戻す')
    dialog.confirm.mockResolvedValue(true)
    expect(names(await askWholeSample(sample, true))).toHaveLength(6)
  })

  it('中身が読めない見本は、黙って何もしないのではなく、失敗として返す（呼ぶ側が知らせる）', async () => {
    await expect(askWholeSample({ title: '壊れた見本', html: '<div>中身</div>' }, false)).rejects.toThrow('壊れた見本')
  })
})

describe('画面への組み込み', () => {
  it('部品を足す所の「まとまった型」の段に「アンケート」', () => {
    const palette = readFileSync('src/app/panels/nocode/palette.ts', 'utf8')
    expect(palette).toMatch(/host\.survey/)
    expect(palette).toContain("'アンケート'")
    const adder = readFileSync('src/app/panels/nocode/block-adder.ts', 'utf8')
    expect(adder).toContain('survey: options.onSurvey')
  })

  it('押すとアンケートの中身に入れ替える（「戻す」の履歴にも入る）', () => {
    const builder = readFileSync('src/app/panels/widget-studio-builder.ts', 'utf8')
    expect(builder).toMatch(/onSurvey: \(\) =>[\s\S]{0,200}askSurveyData\(/)
    // 入れ替えは loadWhole（form.load＝「戻す」の履歴にも入る）。ライブラリのアンケートを選んだときも同じ道
    expect(builder).toMatch(/askSurveyData\([\s\S]{0,200}loadWhole\(next,/)
    expect(builder).toMatch(/const loadWhole = [\s\S]{0,120}form\.load\(next, 0, null\)/)
  })
})

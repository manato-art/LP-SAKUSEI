/**
 * Widget編集の「アンケート」（2026-10-24 本人「このURLの下にあるボタンを押したときにアンケートが始まる…みたいなアセットを
 * 簡単に作れるようにしてほしい」）。手本は発酵本家のLP（回答をはじめる → Q1〜Q3 → 結果）。
 *
 * 本人の選択:
 * - 出方 … 「下に積み重ねる」（答えると次の質問が下に出て、前の質問は残る）と「同じ場所で入れ替わる」の両方を選べる
 * - 質問の中身 … 画像も文字も選べる（今の部品＝見出し・画像・動画をそのまま使う）
 * - 分かれ道 … 選んだ答えで、次の質問や最後の結果を変えられる（選択肢ごとの「移る先の画面」）
 * - 記録 … しない（見せるだけ）
 * - 作る場所 … Widget編集の「まとまった型」に「アンケート」
 * - 進み具合（Q1 › Q2 › Q3）… 出す（消せる）。質問の数に合わせて自動で並ぶ
 * - 「回答をはじめる」ボタン … あり・なしを選べる
 */
import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import { ALL_BLOCK_TYPES, BUILDER_TEMPLATE, SCREENS_SCRIPT } from '../src/app/panels/nocode/templates/builder.ts'
import { surveyData } from '../src/app/panels/nocode/templates/survey.ts'
import { items, str, type ItemData, type TemplateData } from '../src/app/panels/nocode/templates/types.ts'

const NOW = new Date('2026-10-24T12:00:00+09:00')
const UID = 'nc-survey01'

const screensOf = (data: TemplateData): readonly ItemData[] => items(data, 'screens')
const blocksOf = (screen: ItemData | undefined): readonly ItemData[] => items(screen ?? {}, 'blocks')
const goesTo = (screen: ItemData | undefined): string[] =>
  blocksOf(screen).filter((b) => str(b, 'action') === 'screen').map((b) => str(b, 'target'))

describe('「アンケート」の型が作る中身', () => {
  it('「回答をはじめる」→ Q1 → Q2 → Q3 → 結果A／結果B。下に積み重ねる出方', () => {
    const data = surveyData(NOW, { startButton: true })
    expect(screensOf(data).map((s) => str(s, 'name'))).toEqual(['はじめ', 'Q1', 'Q2', 'Q3', '結果A', '結果B'])
    expect(str(data, 'transition')).toBe('stack')
    const [start, q1, q2, q3, resultA, resultB] = screensOf(data)
    const id = (screen: ItemData | undefined): string => str(screen ?? {}, 'id')
    expect(blocksOf(start).find((b) => str(b, 'type') === 'button')?.['label']).toBe('回答をはじめる')
    expect(goesTo(start)).toEqual([id(q1)])
    expect(new Set(goesTo(q1))).toEqual(new Set([id(q2)]))
    expect(new Set(goesTo(q2))).toEqual(new Set([id(q3)]))
    // 分かれ道の例: Q3 の答えで結果が変わる
    expect(new Set(goesTo(q3))).toEqual(new Set([id(resultA), id(resultB)]))
    expect(goesTo(resultA)).toEqual([])
    expect(goesTo(resultB)).toEqual([])
  })

  it('質問の画面には進み具合と、選ぶボタン（選択肢の形）が入っている', () => {
    const [, q1, , q3] = screensOf(surveyData(NOW, { startButton: true }))
    expect(blocksOf(q1)[0]?.['type']).toBe('progress')
    expect(blocksOf(q1).filter((b) => b['look'] === 'choice').map((b) => b['label'])).toEqual(['はい', 'いいえ'])
    expect(blocksOf(q3).filter((b) => b['look'] === 'choice')).toHaveLength(4)
  })

  it('「回答をはじめる」ボタンなしなら、Q1 から始まる', () => {
    const data = surveyData(NOW, { startButton: false })
    expect(screensOf(data).map((s) => str(s, 'name'))).toEqual(['Q1', 'Q2', 'Q3', '結果A', '結果B'])
  })

  it('そのまま LP に入れられる（入れる前の確かめに引っかからない）', () => {
    expect(BUILDER_TEMPLATE.validate(surveyData(NOW, { startButton: true }), NOW)).toBeNull()
    expect(BUILDER_TEMPLATE.validate(surveyData(NOW, { startButton: false }), NOW)).toBeNull()
  })
})

describe('進み具合（Q1 › Q2 › Q3）', () => {
  it('部品として選べる（「押す・移る」の段）', () => {
    const type = ALL_BLOCK_TYPES.find((t) => t.type === 'progress')
    expect(type?.label).toBe('進み具合')
  })

  it('進み具合のある画面の数で並び、その画面の番号が色付きになる', () => {
    const html = BUILDER_TEMPLATE.render(surveyData(NOW, { startButton: true }), UID)
    const doc = parseHTML(`<!doctype html><html><body>${html}</body></html>`).document
    const q2 = doc.querySelector('[data-nc-name="Q2"] .nc-b-progress')
    expect(q2?.getAttribute('aria-label')).toBe('質問 2 / 3')
    expect([...(q2?.querySelectorAll('.nc-b-progress__step') ?? [])].map((s) => s.textContent)).toEqual(['Q1', 'Q2', 'Q3'])
    expect([...(q2?.querySelectorAll('.nc-b-progress__step') ?? [])].map((s) => s.classList.contains('is-current'))).toEqual([
      false,
      true,
      false,
    ])
    // 結果の画面には進み具合を出さない
    expect(doc.querySelector('[data-nc-name="結果A"] .nc-b-progress')).toBeNull()
  })

  it('ほかの部品と同じく、幅と置く位置を変えられる', () => {
    const data = surveyData(NOW, { startButton: false })
    const changed: TemplateData = {
      ...data,
      screens: screensOf(data).map((s, i) =>
        i === 0 ? { ...s, blocks: [{ ...(blocksOf(s)[0] ?? {}), boxWidth: 60, place: 'left' }, ...blocksOf(s).slice(1)] } : s,
      ),
    }
    const html = BUILDER_TEMPLATE.render(changed, UID)
    expect(html).toMatch(new RegExp(`\\.${UID} \\.nc-b-1\\{width:60%;`))
  })

  it('頭の文字と色を変えられる', () => {
    const data = surveyData(NOW, { startButton: false })
    const q1 = screensOf(data)[0]
    const progress = blocksOf(q1)[0] ?? {}
    const changed: TemplateData = {
      ...data,
      screens: screensOf(data).map((s, i) =>
        i === 0 ? { ...s, blocks: [{ ...progress, prefix: '問', color: '#1F7AE0' }, ...blocksOf(s).slice(1)] } : s,
      ),
    }
    const html = BUILDER_TEMPLATE.render(changed, UID)
    expect(html).toContain('<li class="nc-b-progress__step is-current" aria-current="step">問1</li>')
    expect(html).toMatch(/\.nc-b-1 \.nc-b-progress__step\.is-current\{background:#1F7AE0/)
  })
})

describe('出方「下に積み重ねる」', () => {
  it('画面の切り替わり方に「下に積み重ねる」がある', () => {
    const field = BUILDER_TEMPLATE.fields.find((f) => f.kind === 'select' && f.key === 'transition')
    const options = field !== undefined && 'options' in field ? (field.options as { value: string; label: string }[]) : []
    expect(options.map((o) => o.value)).toContain('stack')
    expect(BUILDER_TEMPLATE.render(surveyData(NOW, { startButton: true }), UID)).toContain('data-nc-transition="stack"')
  })

  /** 書き出したWidgetを linkedom に置いて、画面の切り替えのスクリプトを動かす（view＝Widget編集の見たまま画面の出し方） */
  function mount(
    data: TemplateData,
    view?: { readonly screen?: string; readonly path?: readonly string[] },
  ): { doc: Document; visible: () => string[]; press: (screen: string, label: string) => void } {
    const html = BUILDER_TEMPLATE.render(data, UID, view)
    const { window } = parseHTML(`<!doctype html><html><body>${html.replace(/<script>[\s\S]*?<\/script>/g, '')}</body></html>`)
    const doc = window.document as unknown as Document
    const proto = (window as unknown as { HTMLElement: { prototype: Record<string, unknown> } }).HTMLElement.prototype
    proto['scrollIntoView'] = () => undefined
    const run = new Function('window', 'document', 'setTimeout', 'clearTimeout', SCREENS_SCRIPT)
    run({ matchMedia: () => ({ matches: false }) }, doc, setTimeout, clearTimeout)
    const root = doc.querySelector('[data-nc-screens]') as HTMLElement
    const screens = (): HTMLElement[] => [...root.children].filter((c) => c.hasAttribute('data-nc-screen')) as HTMLElement[]
    return {
      doc,
      visible: () => screens().filter((s) => !s.hidden).map((s) => s.getAttribute('data-nc-name') ?? ''),
      press: (screen, label) => {
        const target = [...doc.querySelectorAll(`[data-nc-name="${screen}"] [data-nc-go]`)].find((el) => el.textContent?.includes(label))
        if (target === undefined) throw new Error(`${screen} に「${label}」がありません`)
        target.dispatchEvent(new window.Event('click', { bubbles: true, cancelable: true }))
      },
    }
  }

  it('答えると次の画面が下に出て、前の画面は残る。答えで結果が変わる', () => {
    const page = mount(surveyData(NOW, { startButton: true }))
    expect(page.visible()).toEqual(['はじめ'])
    page.press('はじめ', '回答をはじめる')
    expect(page.visible()).toEqual(['はじめ', 'Q1'])
    page.press('Q1', 'はい')
    page.press('Q2', 'いいえ')
    expect(page.visible()).toEqual(['はじめ', 'Q1', 'Q2', 'Q3'])
    const q3 = [...page.doc.querySelectorAll('[data-nc-name="Q3"] [data-nc-go]')]
    q3[3]?.dispatchEvent(new (page.doc.defaultView as unknown as { Event: typeof Event }).Event('click', { bubbles: true }))
    expect(page.visible()).toEqual(['はじめ', 'Q1', 'Q2', 'Q3', '結果B'])
  })

  it('前の質問の答えを選び直すと、その下を出し直す', () => {
    const page = mount(surveyData(NOW, { startButton: false }))
    page.press('Q1', 'はい')
    page.press('Q2', 'はい')
    expect(page.visible()).toEqual(['Q1', 'Q2', 'Q3'])
    page.press('Q1', 'いいえ')
    expect(page.visible()).toEqual(['Q1', 'Q2'])
  })

  it('選んだ答えに印が付く（同じ質問のほかの答えからは外れる）', () => {
    const page = mount(surveyData(NOW, { startButton: false }))
    page.press('Q1', 'はい')
    page.press('Q1', 'いいえ')
    const pressed = [...page.doc.querySelectorAll('[data-nc-name="Q1"] [data-nc-go]')].map((el) => el.getAttribute('aria-pressed'))
    expect(pressed).toEqual([null, 'true'])
  })

  // 2026-10-25 本人「コントロールキーでポツンと反応させた時、移行先の文言や色をそのまま直したい。Q1・Q2のところを押さないとできない」:
  // Widget編集で試して積み重ねた画面は、部品を選んで描き直しても積み重ねたまま出す（data-nc-path・見たまま画面だけ）
  it('Widget編集の見たまま画面: 積み重ねていた画面を、描き直しても同じ並びで出す', () => {
    const data = surveyData(NOW, { startButton: true })
    expect(BUILDER_TEMPLATE.render(data, UID, { screen: 's3', path: ['s1', 's2', 's3'] })).toContain('data-nc-path="s1 s2 s3"')
    const page = mount(data, { screen: 's3', path: ['s1', 's2', 's3'] })
    expect(page.visible()).toEqual(['はじめ', 'Q1', 'Q2'])
    // その先も今までどおり積み重なる
    page.press('Q2', 'はい')
    expect(page.visible()).toEqual(['はじめ', 'Q1', 'Q2', 'Q3'])
  })

  it('並びは配信には出さない（見たまま画面だけ）。無い画面・積み重ねでない出方では使わない', () => {
    const data = surveyData(NOW, { startButton: true })
    // 切り替えのスクリプトの文にも名前が入るので、属性の形（data-nc-path="）で見る
    expect(BUILDER_TEMPLATE.render(data, UID)).not.toContain('data-nc-path="')
    expect(BUILDER_TEMPLATE.render(data, UID, { screen: 's2', path: ['s1', 's9', 's2'] })).toContain('data-nc-path="s1 s2"')
    expect(BUILDER_TEMPLATE.render({ ...data, transition: 'fade' }, UID, { screen: 's2', path: ['s1', 's2'] })).not.toContain('data-nc-path="')
    expect(BUILDER_TEMPLATE.render(data, UID, { screen: 's1', path: ['s1'] })).not.toContain('data-nc-path="')
  })

  it('Widget編集は、いま出ている画面の並びを描き直しに渡す（開いている画面がその中にあるときだけ）', async () => {
    const { readFileSync } = await import('node:fs')
    const builder = readFileSync('src/app/panels/widget-studio-builder.ts', 'utf8')
    expect(builder).toMatch(/const shown = visibleScreenPath\(contentDiv\)[\s\S]{0,200}shown\.includes\(screen\)/)
    expect(builder).toContain('{ screen, ...(path === null ? {} : { path }) }')
  })

  it('「同じ場所で入れ替わる」（瞬時）は今までどおり1画面だけ', () => {
    const page = mount({ ...surveyData(NOW, { startButton: false }), transition: 'none' })
    page.press('Q1', 'はい')
    expect(page.visible()).toEqual(['Q2'])
  })

  it('積み重ねた画面どうしの間をあける（前の画面のボタンと次の質問がくっつかない）。ほかの出方には付けない', () => {
    const stacked = BUILDER_TEMPLATE.render(surveyData(NOW, { startButton: false }), UID)
    expect(stacked).toContain(`.${UID} .nc-screen:not([hidden])~.nc-screen:not([hidden]){margin-top:40px}`)
    expect(stacked).toContain(`.${UID} .nc-screen{scroll-margin-top:16px}`)
    const swapped = BUILDER_TEMPLATE.render({ ...surveyData(NOW, { startButton: false }), transition: 'fade' }, UID)
    expect(swapped).not.toContain('.nc-screen:not([hidden])~')
  })

  it('選んだ答えの見え方（塗る）がある', () => {
    expect(BUILDER_TEMPLATE.render(surveyData(NOW, { startButton: false }), UID)).toMatch(/\.nc-b-button__a\[aria-pressed="true"\]\{background:/)
  })
})

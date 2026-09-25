/**
 * ヒートマップ左の「Version一覧」を分かりやすくする（2026-09-25・本人「全体的に視覚的にわかりやすく」
 * 「utm_source=fb … がわかりずらい」）。
 *
 * 以前: 「離脱 CLICK CV」の見出しが上に離れていて、行には文字の無いチェックだけ。名前は途中で切れる。
 *       広告は `utm_source=fb` の生の文字のチェックが並び、何人来たかも、選ぶと何が起きるかも分からない。
 *       「元に戻す」はいつも出ている。
 * 今:   指標は文字の入ったボタン（押すと色が付き、印が出る）。広告は種類ごと（流入元・キャンペーン…）に
 *       まとめ、値と人数を並べる。「外す」は選んでいるときだけ。
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { installDom } from './helpers/dom.ts'
import { describeAdParam, formatAdParam, groupAdParams } from '../src/app/pages/heatmap-params.ts'
import type { ReportVersionRow } from '../src/app/api.ts'

describe('広告パラメータを人が読める形にする', () => {
  it('よく使う utm_* は日本語の名前にする', () => {
    expect(describeAdParam('utm_source=fb')).toEqual({ key: 'utm_source', label: '流入元', value: 'fb' })
    expect(describeAdParam('utm_campaign=cpA').label).toBe('キャンペーン')
    expect(describeAdParam('utm_medium=paid').label).toBe('媒体')
    expect(describeAdParam('utm_content=bnr01').label).toBe('広告')
    expect(describeAdParam('utm_term=毛穴').label).toBe('キーワード')
  })

  it('知らない utm_* は utm_ を外した名前のまま・値に = があっても最初の = で分ける', () => {
    expect(describeAdParam('utm_creative=a=b')).toEqual({ key: 'utm_creative', label: 'creative', value: 'a=b' })
  })

  it('1行で書くときは「流入元: fb」', () => {
    expect(formatAdParam('utm_source=fb')).toBe('流入元: fb')
  })

  it('種類ごとにまとめる（並びは 流入元→媒体→キャンペーン→広告→キーワード→その他、中は人数の多い順のまま）', () => {
    const groups = groupAdParams([
      { version_uid: 'V1', param: 'utm_campaign=cpB', pv: 24 },
      { version_uid: 'V1', param: 'utm_source=fb', pv: 35 },
      { version_uid: 'V1', param: 'utm_creative=x', pv: 3 },
      { version_uid: 'V1', param: 'utm_source=google', pv: 16 },
      { version_uid: 'V1', param: 'utm_campaign=cpA', pv: 11 },
    ])
    expect(groups.map((g) => `${g.label}:${g.items.map((i) => `${i.value}/${i.pv}`).join(',')}`)).toEqual([
      '流入元:fb/35,google/16',
      'キャンペーン:cpB/24,cpA/11',
      'creative:x/3',
    ])
  })
})

function row(uid: string, name: string, pv: number): ReportVersionRow {
  return { entity_uid: uid, name, pv } as unknown as ReportVersionRow
}

describe('Version一覧の見た目と配線', () => {
  beforeAll(() => {
    installDom()
  })

  async function render(selected: string[] = [], paramSelected: string[] = []) {
    const { renderVersionItems } = await import('../src/app/pages/heatmap-version-list.ts')
    const onToggle = vi.fn()
    const onParamToggle = vi.fn()
    const metricBoxes = new Map<string, HTMLInputElement>()
    const paramBoxes = new Map<string, HTMLInputElement>()
    const ul = document.createElement('ul')
    document.body.append(ul)
    renderVersionItems(ul, [row('V1', 'B（上にボタン）とても長い名前のVersion', 79), row('V2', 'A', 0)], {
      selection: new Set(selected),
      onToggle,
      registerMetric: (key, box) => metricBoxes.set(key, box),
      params: {
        parameters: [
          { version_uid: 'V1', param: 'utm_source=fb', pv: 35 },
          { version_uid: 'V1', param: 'utm_campaign=cpA', pv: 11 },
        ],
        selected: new Set(paramSelected),
        onToggle: onParamToggle,
        register: (key, box) => paramBoxes.set(key, box),
      },
    })
    return { ul, onToggle, onParamToggle, metricBoxes, paramBoxes }
  }

  it('名前は切らずに全部入れ、PVは「79 PV」', async () => {
    const { ul } = await render()
    const first = ul.querySelector('.hm-vl-item')
    expect(first?.querySelector('.hm-vl-name')?.textContent).toBe('B（上にボタン）とても長い名前のVersion')
    expect(first?.querySelector('.hm-vl-pv')?.textContent).toBe('79 PV')
  })

  it('指標は文字の入ったボタン（離脱・クリック・CV）で、押すと列を足す', async () => {
    const { ul, onToggle, metricBoxes } = await render()
    const labels = [...ul.querySelectorAll('.hm-vl-item')][0]!.querySelectorAll('.hm-vl-toggle')
    expect([...labels].map((l) => l.textContent?.trim())).toEqual(['離脱', 'クリック', 'CV'])
    const box = metricBoxes.get('V1|click')!
    box.checked = true
    box.dispatchEvent(new Event('change'))
    expect(onToggle).toHaveBeenCalledWith('V1', 'click', true)
  })

  it('選んでいた指標は、描き直してもチェックが入ったまま', async () => {
    const { metricBoxes } = await render(['V2|exit'])
    expect(metricBoxes.get('V2|exit')?.checked).toBe(true)
    expect(metricBoxes.get('V1|exit')?.checked).toBe(false)
  })

  it('広告は種類ごとの見出しの下に、値と人数で並ぶ', async () => {
    const { ul } = await render()
    const ads = ul.querySelector('.hm-vl-item .hm-vl-ads')!
    expect([...ads.querySelectorAll('.hm-vl-group-name')].map((n) => n.textContent)).toEqual(['流入元', 'キャンペーン'])
    const chip = ads.querySelector('.hm-vl-chip')!
    expect(chip.querySelector('.hm-vl-chip-value')?.textContent).toBe('fb')
    expect(chip.querySelector('.hm-vl-chip-pv')?.textContent).toBe('35')
    // 生の名前は title に残す（どの utm か確かめたいとき用）
    expect(chip.getAttribute('title')).toContain('utm_source=fb')
  })

  it('「外す」は広告を選んでいるときだけ出て、押すと全部外れる', async () => {
    const { ul, paramBoxes, onParamToggle } = await render()
    const clear = ul.querySelector('.hm-vl-item .hm-vl-clear') as HTMLButtonElement
    expect(clear.hidden).toBe(true)
    const fb = paramBoxes.get('V1|utm_source=fb')!
    fb.checked = true
    fb.dispatchEvent(new Event('change'))
    expect(onParamToggle).toHaveBeenLastCalledWith('V1', 'utm_source=fb', true)
    expect(clear.hidden).toBe(false)
    clear.dispatchEvent(new Event('click'))
    expect(fb.checked).toBe(false)
    expect(onParamToggle).toHaveBeenLastCalledWith('V1', 'utm_source=fb', false)
    expect(clear.hidden).toBe(true)
  })

  it('広告が1件も来ていないVersionは、そうと書く', async () => {
    const { ul } = await render()
    const second = [...ul.querySelectorAll('.hm-vl-item')][1]!
    expect(second.querySelector('.hm-vl-none')?.textContent).toContain('まだありません')
    expect(second.querySelector('.hm-vl-chip')).toBeNull()
  })
})

describe('右の列の見出しも、広告を人が読める名前で出す', () => {
  beforeAll(() => {
    installDom()
  })

  it('広告で絞った列は「流入元: fb」と名乗る（生の utm_source=fb ではなく）', async () => {
    const { renderHeatmapColumns } = await import('../src/app/pages/heatmap-columns.ts')
    const host = document.createElement('div')
    document.body.append(host)
    renderHeatmapColumns(
      host,
      [{ versionUid: 'V1', versionName: 'A', metric: 'exit', param: 'utm_source=fb', html: '', css: '', pv: 3, ctr: null, cv: 0 }],
      {
        stats: [],
        totals: { pv: 0, ctr: null, cv: 0 },
        externalHtml: null,
        styleCss: '',
        range: { startDate: '2026-09-25', endDate: '2026-09-25' },
        fullPage: false,
      },
    )
    const note = host.querySelector('.hm-col-note')
    expect(note?.textContent).toBe('流入元: fb')
    expect(note?.getAttribute('title')).toBe('utm_source=fb')
  })
})

describe('説明文は1回だけ', () => {
  beforeAll(() => {
    installDom()
  })

  it('広告が来ているいちばん上の行にだけ出す（上の行に広告が無くても、下の行で出す）', async () => {
    const { renderVersionItems } = await import('../src/app/pages/heatmap-version-list.ts')
    const ul = document.createElement('ul')
    renderVersionItems(ul, [row('V0', '広告なし', 3), row('V1', 'B', 79), row('V2', 'A', 55)], {
      selection: new Set(),
      onToggle: () => undefined,
      registerMetric: () => undefined,
      params: {
        parameters: [
          { version_uid: 'V1', param: 'utm_source=fb', pv: 35 },
          { version_uid: 'V2', param: 'utm_source=fb', pv: 19 },
        ],
        selected: new Set(),
        onToggle: () => undefined,
        register: () => undefined,
      },
    })
    const hints = [...ul.querySelectorAll<HTMLElement>('.hm-vl-hint')]
    expect(hints.map((h) => h.hidden)).toEqual([false, true])
    expect(hints[0]?.closest('.hm-vl-item')?.getAttribute('data-version-uid')).toBe('V1')
  })
})

describe('ダークモード', () => {
  beforeAll(() => {
    installDom()
  })

  it('一覧の CSS はダークの自動変換から外し（選んだときの青が消えないように）、選んだ行のダークの面を自分で持つ', async () => {
    const { renderVersionItems } = await import('../src/app/pages/heatmap-version-list.ts')
    renderVersionItems(document.createElement('ul'), [], {
      selection: new Set(),
      onToggle: () => undefined,
      registerMetric: () => undefined,
      params: { parameters: [], selected: new Set(), onToggle: () => undefined, register: () => undefined },
    })
    const style = document.getElementById('sb-heatmap-version-list-css')
    expect(style?.getAttribute('data-dark-runtime')).toBe('skip')
    expect(style?.textContent).toContain('html[data-theme="dark"] .hm-vl-item:has(.hm-vl-metrics input:checked)')
    // 色は変数で書く（ダークで切り替わる）。白い文字だけは青の上なので固定
    expect(style?.textContent).not.toMatch(/background:#(?!FFFFFF)[0-9A-F]{6}/i)
  })
})

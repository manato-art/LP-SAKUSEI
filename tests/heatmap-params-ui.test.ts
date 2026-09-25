/**
 * 左のVersion一覧に出す広告パラメータの組み立て（2026-09-15）。
 * 採取物: capture/clean/ab_tests__UID__reports__lp/heatmap-params-expanded/
 *   `_paramsOption_` のチェックボックス群と、末尾の `_viewMore_`「元に戻す」。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { expandColumnKeys, paramsForVersion } from '../src/app/pages/heatmap-params.ts'
import { columnHeaderStats } from '../src/app/pages/heatmap-columns.ts'

const parameters = [
  { version_uid: 'V1', param: 'utm_source=fb', pv: 9 },
  { version_uid: 'V1', param: 'utm_medium=paid', pv: 3 },
  { version_uid: 'V2', param: 'utm_source=ig', pv: 1 },
]

describe('Versionごとの広告パラメータ', () => {
  it('そのVersionに来たものだけを返す', () => {
    expect(paramsForVersion(parameters, 'V1').map((p) => p.param)).toEqual([
      'utm_source=fb',
      'utm_medium=paid',
    ])
  })

  it('1件も無ければ空（「パラメーターなし」の状態）', () => {
    expect(paramsForVersion(parameters, 'V3')).toEqual([])
  })
})

describe('チェックから列を組み立てる', () => {
  it('パラメータを選んでいなければ「全パラメータ合算」の列が1本', () => {
    expect(expandColumnKeys(new Set(['V1|exit']), new Set())).toEqual([
      { versionUid: 'V1', metric: 'exit', param: '' },
    ])
  })

  it('パラメータを選ぶと、その広告ごとの列になる（合算は出さない）', () => {
    const keys = expandColumnKeys(new Set(['V1|exit']), new Set(['V1|utm_source=fb', 'V1|utm_medium=paid']))
    expect(keys).toEqual([
      { versionUid: 'V1', metric: 'exit', param: 'utm_source=fb' },
      { versionUid: 'V1', metric: 'exit', param: 'utm_medium=paid' },
    ])
  })

  it('別のVersionのパラメータは混ざらない', () => {
    const keys = expandColumnKeys(new Set(['V1|exit', 'V2|cv']), new Set(['V1|utm_source=fb']))
    expect(keys).toEqual([
      { versionUid: 'V1', metric: 'exit', param: 'utm_source=fb' },
      { versionUid: 'V2', metric: 'cv', param: '' },
    ])
  })

  it('指標を2つ選ぶと、指標ごとにパラメータの列が並ぶ', () => {
    const keys = expandColumnKeys(new Set(['V1|exit', 'V1|click']), new Set(['V1|utm_source=fb']))
    expect(keys.map((k) => `${k.metric}/${k.param}`)).toEqual([
      'exit/utm_source=fb',
      'click/utm_source=fb',
    ])
  })
})

/**
 * カードの「このヒートマップを複製します」（採取物の `_dupContainer_`）。
 * 同じ設定のカードをもう1枚増やして、ラインの種類を変えて見比べるためのもの。
 */
describe('カードの複製', () => {
  it('複製した回数だけ同じ列が増える', () => {
    const keys = expandColumnKeys(new Set(['V1|exit']), new Set(), new Map([['V1|exit|', 2]]))
    expect(keys).toEqual([
      { versionUid: 'V1', metric: 'exit', param: '' },
      { versionUid: 'V1', metric: 'exit', param: '' },
      { versionUid: 'V1', metric: 'exit', param: '' },
    ])
  })

  it('複製は広告パラメータごとに数える', () => {
    const keys = expandColumnKeys(
      new Set(['V1|exit']),
      new Set(['V1|utm_source=fb', 'V1|utm_source=ig']),
      new Map([['V1|exit|utm_source=fb', 1]]),
    )
    expect(keys.map((k) => k.param)).toEqual(['utm_source=fb', 'utm_source=fb', 'utm_source=ig'])
  })
})

/**
 * 配線の取り違え防止（jsdomを使わないので、実装の形で固定する）。
 * 行の下に広告パラメータのチェックが並ぶので、指標のチェックを数える所を
 * 行全体から拾うと「広告を選んだだけ」で行が選択中の見た目になる。
 */
describe('指標のチェックと広告パラメータのチェックを取り違えない', () => {
  const list = readFileSync('src/app/pages/heatmap-version-list.ts', 'utf8')
  const page = readFileSync('src/app/pages/heatmap.ts', 'utf8')

  it('行が選択中（白い面）かの判定は指標のボタンだけを見る', () => {
    expect(list).toContain('.hm-vl-item:has(.hm-vl-metrics input:checked)')
    // 行全体のチェックで判定しない（広告を選んだだけで行が選択中に見えてしまう）
    expect(list).not.toContain('.hm-vl-item:has(input:checked)')
  })

  it('既定で開く行も指標（離脱）のボタンを押す', () => {
    expect(page).toContain(".querySelector<HTMLInputElement>('.hm-vl-metrics input[data-metric=\"exit\"]')")
  })
})

/**
 * カード見出しの数字（PV / CTR / CV）。
 * 広告で絞った列に、そのVersion全体のPVを出すと「19PVの中のfb」なのか
 * 「fbが19PV」なのか読めない。絞った列はその広告の数字を出す。
 * 2026-09-25 から広告ごとの CV も数えているので、レポートの広告の行（Branch Operation）と同じ PV・CTR・CV を出す。
 * その行が無い（レポート設定で隠した等）ときは、計測したPVだけを出し CTR・CV は「-」。
 */
describe('カード見出しの数字', () => {
  const spec = { versionUid: 'V1', pv: 19, ctr: 0.5, cv: 3 }

  it('絞っていない列はレポートの数字をそのまま出す', () => {
    expect(columnHeaderStats({ ...spec, param: '' }, { isShared: false, totals: { pv: 99, ctr: 0.1, cv: 1 }, stat: null }))
      .toEqual({ pv: 19, ctr: 0.5, cv: 3 })
  })

  it('外部LPの列はLP全体の数字を出す', () => {
    expect(columnHeaderStats({ ...spec, param: '' }, { isShared: true, totals: { pv: 99, ctr: 0.1, cv: 1 }, stat: null }))
      .toEqual({ pv: 99, ctr: 0.1, cv: 1 })
  })

  it('広告で絞った列で、レポートにその広告の行が無ければ、計測したPVだけを出し、CTR・CVは出さない', () => {
    expect(
      columnHeaderStats({ ...spec, param: 'utm_source=fb' }, {
        isShared: false,
        totals: { pv: 99, ctr: 0.1, cv: 1 },
        stat: { pv: 12 },
      }),
    ).toEqual({ pv: 12, ctr: null, cv: null })
  })

  it('レポートにその広告の行があれば、その PV・CTR・CV を出す（広告ごとの CV も数えるようになった・2026-09-25）', () => {
    expect(
      columnHeaderStats({ ...spec, param: 'utm_source=fb', adRow: { pv: 35, ctr: 0.3143, cv: 8 } }, {
        isShared: false,
        totals: { pv: 99, ctr: 0.1, cv: 1 },
        stat: { pv: 35 },
      }),
    ).toEqual({ pv: 35, ctr: 0.3143, cv: 8 })
  })

  it('絞った広告の計測がまだ無ければ0PV（他の数字を借りない）', () => {
    expect(
      columnHeaderStats({ ...spec, param: 'utm_source=fb' }, {
        isShared: false,
        totals: { pv: 99, ctr: 0.1, cv: 1 },
        stat: null,
      }),
    ).toEqual({ pv: 0, ctr: null, cv: null })
  })
})

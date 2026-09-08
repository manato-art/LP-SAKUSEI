import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { previousRange } from '../src/app/pages/report-v2.ts'

/**
 * 指示178 のレポート再設計。
 * 増減の比較対象は「同じ日数だけ手前にずらした期間」で、ここを間違えると
 * 全KPIの増減が一斉に狂うので機械で押さえる。
 */
describe('増減の比較対象になる前期間', () => {
  it('1日だけの期間は、その前日1日と比べる', () => {
    expect(previousRange({ startDate: '2026-09-08', endDate: '2026-09-08' })).toEqual({
      startDate: '2026-09-07',
      endDate: '2026-09-07',
    })
  })

  it('15日間の期間は、直前の15日間と比べる', () => {
    expect(previousRange({ startDate: '2025-06-16', endDate: '2025-06-30' })).toEqual({
      startDate: '2025-06-01',
      endDate: '2025-06-15',
    })
  })

  it('月をまたぐ期間でも日数が合う', () => {
    const prev = previousRange({ startDate: '2026-03-01', endDate: '2026-03-07' })
    expect(prev).toEqual({ startDate: '2026-02-22', endDate: '2026-02-28' })
  })

  it('前期間は現期間と重ならない（終了日が開始日の前日）', () => {
    const range = { startDate: '2026-01-10', endDate: '2026-01-20' }
    expect(previousRange(range).endDate < range.startDate).toBe(true)
  })
})

describe('レポート本体は指定デザインの構成になっている', () => {
  const src = readFileSync('src/app/pages/report-v2.ts', 'utf8')

  it('フィルター→KPI→クリエイティブ→一覧→Branch の順で積む', () => {
    const order = ['buildFilters', 'buildKpiCards', 'buildCreativeReport', 'buildReportList', 'buildBranchOperation']
    let at = -1
    for (const name of order) {
      const i = src.indexOf(`${name}(`, at + 1)
      expect(i, `${name} が見つからない`).toBeGreaterThan(at)
      at = i
    }
  })

  it('選択肢を発明しない（採取物に無い絞り込みは「全て」だけ）', () => {
    expect(src).toContain("fixedSelect(['全て'])")
  })

  it('CSVはBOM付きで出す（Excelで文字化けさせない）', () => {
    expect(src).toContain('\\ufeff')
  })
})

describe('KPIカード', () => {
  const src = readFileSync('src/app/pages/report-v2-kpi.ts', 'utf8')

  it('指定画像の7指標をこの順で出す', () => {
    const labels = ['配信金額', 'PV', 'CLICK', 'CTR', 'CV', 'CVR', 'CPA']
    let at = -1
    for (const label of labels) {
      const i = src.indexOf(`label: '${label}'`, at + 1)
      expect(i, `${label} が無い`).toBeGreaterThan(at)
      at = i
    }
  })

  it('CPAだけは「増えると悪い」（増加を赤で出す）', () => {
    const cpa = src.slice(src.indexOf("key: 'cpa'"))
    expect(cpa).toContain('higherIsBetter: false')
  })

  it('前期間が0や無しのときは増減を出さない（0からの増加は率にならない）', () => {
    expect(src).toContain('previous === 0')
    expect(src).toContain('前期間なし')
  })

  it('UIに絵文字を使わずSVGアイコンで描く', () => {
    // 絵文字の面（U+1F300〜）を検出する
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u
    expect(emoji.test(src)).toBe(false)
    expect(src).toContain('<svg')
  })
})

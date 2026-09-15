/**
 * スマホでレポートの表を1行＝1カードにしたときの「主要指標だけ／すべての指標」（2026-09-15）。
 *
 * 15列を縦に並べると1枚のカードが14行になり、9件並べば画面3枚ぶん流れる。
 * 過去に決めた方針（縦スクロール削減が最優先・カードはPV/CV/CVRだけ）に合わせて、
 * 既定では主要な指標だけを出し、切替で残りも出せるようにする。
 */
import { describe, expect, it } from 'vitest'
import { PRIMARY_METRICS, isPrimaryMetric } from '../src/app/pages/report-v2-mobile-table.ts'

describe('スマホのカードに既定で出す指標', () => {
  it('配信金額・PV・CLICK・CTR・CV・CVR は出す', () => {
    for (const label of ['配信金額', 'PV', 'CLICK', 'CTR', 'CV', 'CVR']) {
      expect(isPrimaryMetric(label)).toBe(true)
    }
  })

  it('CTVR・CPA・MCPA・離脱率系・配信割合は切替で出す', () => {
    for (const label of ['CTVR', 'CPA', 'MCPA', 'FVER', 'SVER', 'FSVER', 'OAR', '配信割合']) {
      expect(isPrimaryMetric(label)).toBe(false)
    }
  })

  it('単位つきの列名でも同じに扱う（デイリーは「配信金額 円」「CTR %」）', () => {
    expect(isPrimaryMetric('配信金額 円')).toBe(true)
    expect(isPrimaryMetric('CTR %')).toBe(true)
    expect(isPrimaryMetric('MCPA 円')).toBe(false)
  })

  it('指標ではない先頭列（名前・日付など）は常に出す', () => {
    for (const label of ['名前', '日付', 'バージョン', '配信期間', 'アーカイブ', 'デバイス']) {
      expect(isPrimaryMetric(label)).toBe(true)
    }
  })

  it('一覧は重複なし', () => {
    expect(new Set(PRIMARY_METRICS).size).toBe(PRIMARY_METRICS.length)
  })
})

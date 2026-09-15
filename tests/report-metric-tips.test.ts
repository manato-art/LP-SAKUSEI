/**
 * 指標の見出しに説明を出す（2026-09-15・本人指示「わかりずらいので、カーソルが当たれば説明を出してほしい」）。
 *
 * FVER / SVER / FSVER / OAR / CTVR / MCPA は略語だけでは何の数字か分からない。
 * 説明の文言は採取物の aria-label（report-columns.ts の title）をそのまま使う。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { REPORT_COLUMNS } from '../src/app/pages/report-columns.ts'
import { metricTip } from '../src/app/pages/report-metric-tips.ts'

describe('指標の説明', () => {
  it('採取した13指標すべてに説明がある', () => {
    for (const column of REPORT_COLUMNS) {
      expect(metricTip(column.label), column.label).not.toBe('')
    }
  })

  it('説明は採取物の文言をそのまま使う', () => {
    expect(metricTip('CVR')).toBe('コンバージョン率 = CV / CLICK')
    expect(metricTip('OAR')).toBe('オファー到達率 ※最初の広告リンクに到達した率')
  })

  it('単位つきの見出しでも引ける（デイリーは「CTR %」「配信金額 円」）', () => {
    expect(metricTip('CTR %')).toBe(metricTip('CTR'))
    expect(metricTip('配信金額 円')).toBe(metricTip('配信金額'))
  })

  it('指標ではない列にも要る説明は持つ', () => {
    expect(metricTip('配信割合')).not.toBe('')
    expect(metricTip('名前')).not.toBe('')
  })

  it('知らない見出しは空（空の吹き出しを出さない）', () => {
    expect(metricTip('しらない列')).toBe('')
  })
})

/**
 * 出し入れの配線（jsdomを使わないので実装の形で固定する）。
 * `:hover` だけに任せるとスマホで出せない。標準の `title` は出るまで1秒ほどかかる。
 */
describe('説明の出し方', () => {
  const src = readFileSync('src/app/pages/report-metric-tips.ts', 'utf8')
  const style = readFileSync('src/app/pages/report-v2-style.ts', 'utf8')

  it('カーソルが当たったら出し、離れたら閉じる', () => {
    expect(src).toContain("th.addEventListener('mouseenter'")
    expect(src).toContain("th.addEventListener('mouseleave'")
  })

  it('指で押しても出る（スマホにホバーが無い）', () => {
    expect(src).toContain("th.addEventListener('click'")
  })

  it('キーボードでも読める', () => {
    expect(src).toContain('th.tabIndex = 0')
    expect(src).toContain("th.addEventListener('focus'")
  })

  it('同時に出るのは1つだけ', () => {
    expect(src).toContain('for (const other of document.querySelectorAll(`.${TIP_OPEN_CLASS}`))')
  })

  it('読み上げ・長押し用に title も残す', () => {
    expect(src).toContain('th.title = tip')
  })

  it('CSSはクラスとホバーの両方で出す', () => {
    expect(style).toContain('.rv2-table thead th[data-tip].rv2-tip-open::after')
    expect(style).toContain('.rv2-table thead th[data-tip]:hover::after')
  })
})

/**
 * CV速報の画面（2026-09-15）。
 * 採取した実物にある 期間 / 検索 / 最終更新 / 見出し「コンバージョン」/ 通知設定 /
 * CSVダウンロード を揃える。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { conversionsCsv, cvTime, lastUpdatedLabel } from '../src/app/pages/sidebar-data.ts'

describe('最終更新の表記', () => {
  it('実物と同じ「最終更新 ◯年◯月◯日 HH:MM」', () => {
    // 2026-09-08 12:50 JST = 2026-09-08T03:50:00Z
    const at = Date.UTC(2026, 8, 8, 3, 50) / 1000
    expect(lastUpdatedLabel(at)).toBe('最終更新 2026年9月8日 12:50')
  })

  it('1件も無ければ時刻を作らない', () => {
    expect(lastUpdatedLabel(null)).toBe('最終更新 -')
    expect(lastUpdatedLabel(undefined)).toBe('最終更新 -')
  })
})

describe('CV日時の表記', () => {
  it('UNIX秒をJSTで出す', () => {
    const at = Date.UTC(2026, 8, 8, 3, 50, 7) / 1000
    expect(cvTime(at)).toBe('2026/09/08 12:50:07')
  })

  it('数字でなければ「-」', () => {
    expect(cvTime(null)).toBe('-')
  })
})

describe('CSVダウンロード', () => {
  const row = {
    uid: 'CV_0001',
    occurred_at: Date.UTC(2026, 8, 8, 3, 50, 7) / 1000,
    folder_name: 'フォルダA',
    ab_test_title: 'ページA',
    version_memo: 'Ver.1',
    media: { name: 'Instagram' },
    access_at: null,
    cv_source: '計測タグ',
  }

  it('画面と同じ8列を出す', () => {
    const csv = conversionsCsv([row])
    const head = csv.split('\r\n')[0] ?? ''
    expect(head).toContain('"フォルダ"')
    expect(head).toContain('"成果識別ID"')
    expect(head.split(',').length).toBe(8)
  })

  it('Excelで文字化けさせないようBOMを付ける', () => {
    expect(conversionsCsv([row]).startsWith('﻿')).toBe(true)
  })

  it('持っていない項目は「-」で埋める（空欄にして誤解させない）', () => {
    expect(conversionsCsv([row])).toContain('"-"')
  })

  it('引用符を含む値を壊さない', () => {
    const csv = conversionsCsv([{ ...row, ab_test_title: 'A"B' }])
    expect(csv).toContain('"A""B"')
  })
})

describe('画面の配線', () => {
  // CV速報は2026-09-24に cv-flash-page.ts へ分けた（ページ送り・CSV全件・自動更新を足したため）
  const src = readFileSync('src/app/pages/cv-flash-page.ts', 'utf8')

  it('実物にある見出しと操作を揃える', () => {
    for (const label of ['コンバージョン', '通知設定', 'CSVダウンロード', '速報を検索']) {
      expect(src, label).toContain(label)
    }
  })

  it('期間は両端そろったときだけ掛ける（片方だけでは意味が決まらない）', () => {
    expect(src).toContain("if (range.start !== '' && range.end !== '')")
  })

  it('「通知設定」は実物と同じ通知の画面へ飛ばす', () => {
    expect(src).toContain('/settings/internal_notifications/member')
    const main = readFileSync('src/app/main.ts', 'utf8')
    expect(main).toContain("path === '/settings/internal_notifications/member'")
  })
})

/**
 * 表のセルの折り返し。
 * `word-break:break-all` は**必ず文字単位で折る**ので、日時が
 * 「2026/09/15 1 / 9:21:24」のように数字の途中で割れていた（実機で確認）。
 * `overflow-wrap:anywhere` なら、まず空白で折り、収まらないときだけ文字単位で折る。
 */
describe('データ表のセル', () => {
  const src = readFileSync('src/app/pages/data-ui.ts', 'utf8')

  it('日時が数字の途中で割れないようにする', () => {
    // セルに当てる指定そのものを見る（コメント中の語には反応させない）
    expect(src).toContain("const cellStyle = `text-align:${col.align ?? 'left'};overflow-wrap:anywhere`")
  })
})

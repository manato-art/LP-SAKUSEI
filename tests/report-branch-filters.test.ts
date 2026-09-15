/**
 * Branch Operation の絞り込み（2026-09-15・実物の採取に合わせて実装）。
 *
 * 採取物（capture/clean/ab_tests__UID__reports/report-settings-modal）の
 * 「フィルター」ボタンを開くと、広告ステータス（値 all）／アーカイブ（except_archived）／
 * 端末（0）／version/sb_article_uid検索／parameter検索 が並ぶ。
 */
import { describe, expect, it } from 'vitest'
import { filterBranchRows, type BranchFilter } from '../src/app/pages/report-branch-filters.ts'
import type { ReportVersionRow } from '../src/app/api.ts'

function row(name: string, patch: Partial<ReportVersionRow> = {}): ReportVersionRow {
  return {
    scope: 'version', entity_uid: `UID_${name}`, name, status: '公開中', distribution_ratio: 0,
    pv: 0, click: 0, cv: 0, ad_cost: 0, imp: 0, media_click: 0, media_cv: 0,
    sales: 0, gross_profit: 0, roas: null, roi: null, cvr: null, cpa: null,
    ctr: null, ctvr: null, media_ctr: null, mcpa: null,
    fver: null, sver: null, fsver: null, oar: null,
    ...patch,
  }
}

const ALL: BranchFilter = {
  status: 'all', archive: 'except_archived', device: '0', versionQuery: '', paramQuery: '',
}

const rows: ReportVersionRow[] = [
  row('Ver.1', { status: '公開中', children: [row('utm_source=fb'), row('utm_medium=paid')] }),
  row('Ver.2', { status: '停止', archived: true }),
  row('Ver.3', { status: '準備中', device_targets: { sp: true, tablet: false, pc: false } }),
]

describe('Branch Operation の絞り込み', () => {
  it('既定はアーカイブ済みを除くだけ', () => {
    expect(filterBranchRows(rows, ALL).map((r) => r.name)).toEqual(['Ver.1', 'Ver.3'])
  })

  it('アーカイブ有りにすると全部出す', () => {
    expect(filterBranchRows(rows, { ...ALL, archive: 'all' }).map((r) => r.name)).toEqual([
      'Ver.1', 'Ver.2', 'Ver.3',
    ])
  })

  it('広告ステータスで絞る', () => {
    expect(filterBranchRows(rows, { ...ALL, status: '準備中' }).map((r) => r.name)).toEqual(['Ver.3'])
  })

  it('端末で絞る（そのVersionが配信する端末）', () => {
    // 端末の設定が無い行（Ver.1）は「全端末に出す」扱い＝どの端末で絞っても残る。
    // 持っていないことを「出さない」と読むと、設定していないだけの行が消える。
    expect(filterBranchRows(rows, { ...ALL, device: 'sp' }).map((r) => r.name)).toEqual(['Ver.1', 'Ver.3'])
    // Ver.3 は sp だけ配信する設定なので pc では消える
    expect(filterBranchRows(rows, { ...ALL, device: 'pc' }).map((r) => r.name)).toEqual(['Ver.1'])
  })

  it('version/sb_article_uid検索は名前とuidの両方に当てる', () => {
    expect(filterBranchRows(rows, { ...ALL, versionQuery: 'Ver.3' }).map((r) => r.name)).toEqual(['Ver.3'])
    expect(filterBranchRows(rows, { ...ALL, versionQuery: 'UID_Ver.1' }).map((r) => r.name)).toEqual(['Ver.1'])
  })

  it('parameter検索は広告の行に当て、当たった広告だけを残す', () => {
    const out = filterBranchRows(rows, { ...ALL, paramQuery: 'fb' })
    expect(out.map((r) => r.name)).toEqual(['Ver.1'])
    expect(out[0]?.children?.map((c) => c.name)).toEqual(['utm_source=fb'])
  })

  it('大文字小文字は区別しない', () => {
    expect(filterBranchRows(rows, { ...ALL, versionQuery: 'ver.1' }).map((r) => r.name)).toEqual(['Ver.1'])
  })
})

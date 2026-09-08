import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { isIpLike, matchesExclusion, shouldExclude } from '../mock-server/store/exclusions.ts'
import type { ReportExclusion, RequestLogEntry } from '../mock-server/store/types.ts'
import { getJson, postJson, resetStore, startTestServer, type TestServer } from './helpers/server.ts'

/**
 * レポート除外（実物の同名画面）。
 *
 * 実物の説明どおり「条件に合ったアクセスはレポート集計から外すが、
 * ページ自体は普通に表示する」ことを機械で押さえる。
 */
const rule = (over: Partial<ReportExclusion> = {}): ReportExclusion => ({
  id: 1,
  uid: 'rx1',
  team_id: 1,
  kind: 'ip',
  match_type: 'exact',
  value: '203.0.113.5',
  join: 'or',
  is_whitelist: false,
  reason: '',
  ...over,
})

const log = (over: Partial<RequestLogEntry> = {}): RequestLogEntry => ({
  team_id: 1,
  date: '2026-09-08',
  ip: '203.0.113.5',
  referer: 'https://example.test/',
  params: ['utm_source=x'],
  excluded: false,
  ...over,
})

describe('IPアドレスの形の確認', () => {
  it('IPv4を受ける', () => {
    expect(isIpLike('192.0.2.1')).toBe(true)
    expect(isIpLike('255.255.255.255')).toBe(true)
  })
  it('範囲外や欠けたIPv4は断る', () => {
    expect(isIpLike('256.0.0.1')).toBe(false)
    expect(isIpLike('192.0.2')).toBe(false)
    expect(isIpLike('192.0.2.01')).toBe(false)
  })
  it('IPv6を受ける', () => {
    expect(isIpLike('2001:db8::1')).toBe(true)
  })
  it('空やIPでない文字列は断る', () => {
    expect(isIpLike('')).toBe(false)
    expect(isIpLike('  ')).toBe(false)
    expect(isIpLike('example.test')).toBe(false)
  })
})

describe('除外条件の当たり判定', () => {
  it('IPが完全一致したら当たる', () => {
    expect(matchesExclusion(log(), rule())).toBe(true)
  })
  it('部分的に似ているだけでは当たらない（完全一致だけ）', () => {
    expect(matchesExclusion(log({ ip: '203.0.113.50' }), rule())).toBe(false)
  })
  it('チームはチームIDで突き合わせる', () => {
    expect(matchesExclusion(log(), rule({ kind: 'team', value: '1' }))).toBe(true)
    expect(matchesExclusion(log(), rule({ kind: 'team', value: '2' }))).toBe(false)
  })
  it('結合条件はORなので、1つでも当たれば除外', () => {
    const rules = [rule({ value: '198.51.100.1' }), rule({ uid: 'rx2' })]
    expect(shouldExclude(log(), rules)).toBe(true)
  })
  it('どれにも当たらなければ除外しない', () => {
    expect(shouldExclude(log({ ip: '198.51.100.9' }), [rule()])).toBe(false)
  })
  it('ホワイトリストの条件もレポートには反映しない（実物の説明どおり）', () => {
    expect(shouldExclude(log(), [rule({ is_whitelist: true })])).toBe(true)
  })
  it('条件が無ければ何も除外しない', () => {
    expect(shouldExclude(log(), [])).toBe(false)
  })
})

describe('レポート除外API', () => {
  let server: TestServer
  beforeAll(async () => {
    server = await startTestServer()
  })
  afterAll(async () => {
    await server.close()
  })
  beforeEach(() => {
    resetStore()
  })

  it('IPの形が正しくないものは断る（黙って登録すると原因が分からなくなる）', async () => {
    const res = await postJson(`${server.api}/report-exclusions`, {
      kind: 'ip',
      value: 'これはIPではない',
    })
    expect(res.status).toBe(422)
  })

  it('登録すると一覧に出て、選択肢は採取物どおりの値になる', async () => {
    const created = await postJson<{ report_exclusion: { uid: string } }>(
      `${server.api}/report-exclusions`,
      { kind: 'ip', value: '203.0.113.5' },
    )
    expect(created.status).toBe(201)
    const list = await getJson<{
      report_exclusions: { kind: string; match_type: string; join: string; excluded_count: number | null }[]
    }>(`${server.api}/report-exclusions`)
    const row = list.report_exclusions[0]
    expect(row?.kind).toBe('ip')
    expect(row?.match_type).toBe('exact')
    expect(row?.join).toBe('or')
    // 記録がまだ無いので「―」相当
    expect(row?.excluded_count).toBeNull()
  })

  it('チームは値の形を問わない（IPの検査を巻き込まない）', async () => {
    const res = await postJson(`${server.api}/report-exclusions`, { kind: 'team', value: '1012' })
    expect(res.status).toBe(201)
  })

  it('リクエスト集計は記録が無くても形を返す', async () => {
    const stats = await getJson<{ total: number; referers: unknown[] }>(
      `${server.api}/report-exclusions/requests?start_date=2026-01-01&end_date=2026-12-31`,
    )
    expect(stats.total).toBe(0)
    expect(stats.referers).toEqual([])
  })
})

describe('画面は実物の構成に合わせる', () => {
  const src = readFileSync('src/app/pages/report-exclusions.ts', 'utf8')

  it('実物の2タブを出す', () => {
    expect(src).toContain('アクセス拒否')
    expect(src).toContain('配信除外オーディエンス設定')
  })

  it('実物の文言をそのまま出す', () => {
    expect(src).toContain('サイト閲覧は可能ですが、数値には反映されません')
    expect(src).toContain('ホワイトリストの対象にする')
  })

  it('実物の項目を揃える', () => {
    for (const label of ['除外条件', 'マッチタイプ', '結合条件', '設定済み除外条件', 'リクエスト数']) {
      expect(src, label).toContain(label)
    }
  })

  it('リクエスト数は リファラ / ソースIP / パラメータ の3つ', () => {
    expect(src).toContain("rankBox('リファラ'")
    expect(src).toContain("rankBox('ソースIP'")
    expect(src).toContain("rankBox('パラメータ'")
  })

  it('期間ボタンは実物と同じ6つ', () => {
    for (const label of ['今日', '今週', '今月', '3ヶ月', '半年', '1年']) {
      expect(src, label).toContain(label)
    }
  })

  it('未採取のタブは作らずに、その旨を出す（推測で埋めない）', () => {
    expect(src).toContain('採取に中身が含まれていない')
  })
})

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  isIpLike,
  matchesExclusion,
  matchesText,
  shouldExclude,
} from '../mock-server/store/exclusions.ts'
import type {
  ExclusionCondition,
  ReportExclusion,
  RequestLogEntry,
} from '../mock-server/store/types.ts'
import { getJson, postJson, resetStore, startTestServer, type TestServer } from './helpers/server.ts'

/**
 * レポート除外（実物の同名画面）。
 *
 * 実物の説明どおり「条件に合ったアクセスはレポート集計から外すが、
 * ページ自体は普通に表示する」ことを機械で押さえる。
 */
const cond = (over: Partial<ExclusionCondition> = {}): ExclusionCondition => ({
  kind: 'ip',
  match_type: 'exact',
  value: '203.0.113.5',
  join: 'or',
  ...over,
})

const rule = (over: Partial<ReportExclusion> = {}): ReportExclusion => ({
  id: 1,
  uid: 'rx1',
  team_id: 1,
  conditions: [cond()],
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
  exclude_token: '',
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
    expect(matchesExclusion(log(), rule({ conditions: [cond({ kind: 'team', value: '1' })] }))).toBe(true)
    expect(matchesExclusion(log(), rule({ conditions: [cond({ kind: 'team', value: '2' })] }))).toBe(false)
  })
  it('リファラとパラメータも対象にできる', () => {
    expect(
      matchesExclusion(log(), rule({ conditions: [cond({ kind: 'referer', value: 'https://example.test/' })] })),
    ).toBe(true)
    expect(
      matchesExclusion(log(), rule({ conditions: [cond({ kind: 'param', value: 'utm_source=x' })] })),
    ).toBe(true)
  })
  it('ORは1つでも当たれば、ANDは全部当たれば除外', () => {
    const or = rule({
      conditions: [cond({ value: '198.51.100.1', join: 'or' }), cond()],
    })
    expect(matchesExclusion(log(), or)).toBe(true)
    const and = rule({
      conditions: [cond({ value: '198.51.100.1', join: 'and' }), cond()],
    })
    expect(matchesExclusion(log(), and)).toBe(false)
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

describe('マッチタイプ（実物のプルダウンどおり4種類）', () => {
  it('完全一致', () => {
    expect(matchesText('abc', 'abc', 'exact')).toBe(true)
    expect(matchesText('abcd', 'abc', 'exact')).toBe(false)
  })
  it('部分一致', () => {
    expect(matchesText('xxabcxx', 'abc', 'partial')).toBe(true)
    expect(matchesText('xx', 'abc', 'partial')).toBe(false)
  })
  it('前方一致', () => {
    expect(matchesText('abcdef', 'abc', 'prefix')).toBe(true)
    expect(matchesText('zabc', 'abc', 'prefix')).toBe(false)
  })
  it('後方一致', () => {
    expect(matchesText('zzabc', 'abc', 'suffix')).toBe(true)
    expect(matchesText('abcz', 'abc', 'suffix')).toBe(false)
  })
  it('空の値は当たらない（全件除外という事故を防ぐ）', () => {
    for (const how of ['partial', 'prefix', 'suffix'] as const) {
      expect(matchesText('abc', '', how), how).toBe(false)
    }
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

  it('IPの完全一致で形が正しくないものは断る（黙って登録すると原因が分からなくなる）', async () => {
    const res = await postJson(`${server.api}/report-exclusions`, {
      conditions: [{ kind: 'ip', match_type: 'exact', value: 'これはIPではない', join: 'or' }],
    })
    expect(res.status).toBe(422)
  })

  it('IPの部分一致は形を問わない（一部だけ書くのが普通なので）', async () => {
    const res = await postJson(`${server.api}/report-exclusions`, {
      conditions: [{ kind: 'ip', match_type: 'partial', value: '203.0.', join: 'or' }],
    })
    expect(res.status).toBe(201)
  })

  it('値が空の条件は断る（全件除外という事故を防ぐ）', async () => {
    const res = await postJson(`${server.api}/report-exclusions`, {
      conditions: [{ kind: 'referer', match_type: 'partial', value: '  ', join: 'or' }],
    })
    expect(res.status).toBe(422)
  })

  it('条件が無いものは断る', async () => {
    const res = await postJson(`${server.api}/report-exclusions`, { conditions: [] })
    expect(res.status).toBe(422)
  })

  it('複数条件をまとめて1件として登録できる', async () => {
    const created = await postJson(`${server.api}/report-exclusions`, {
      conditions: [
        { kind: 'ip', match_type: 'exact', value: '203.0.113.5', join: 'and' },
        { kind: 'referer', match_type: 'partial', value: 'example', join: 'or' },
      ],
    })
    expect(created.status).toBe(201)
    const list = await getJson<{
      report_exclusions: { conditions: unknown[]; excluded_count: number | null }[]
    }>(`${server.api}/report-exclusions`)
    expect(list.report_exclusions[0]?.conditions).toHaveLength(2)
    // 記録がまだ無いので「―」相当
    expect(list.report_exclusions[0]?.excluded_count).toBeNull()
  })

  it('除外に当たったアクセスは PV も CV もヒートマップも数えない', async () => {
    // 全アクセスに当たる条件（リファラの部分一致は空文字を許さないので IP の部分一致を使う）
    await postJson(`${server.api}/report-exclusions`, {
      conditions: [{ kind: 'ip', match_type: 'partial', value: '.', join: 'or' }],
    })
    const created = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, {
      title: '除外テスト',
      media_id: 1,
    })
    const uid = created.json.ab_test.uid
    const track = async (payload: Record<string, unknown>): Promise<unknown> => {
      const res = await fetch(`${server.baseUrl}/lp/${uid}/__track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      return res.json()
    }
    expect(await track({ event: 'pv' })).toMatchObject({ excluded: true })
    expect(await track({ event: 'cv', amount: 1000 })).toMatchObject({ excluded: true })
    expect(await track({ event: 'heatmap', bands: 20 })).toMatchObject({ excluded: true })

    const report = await getJson<{ totals: { pv: number; cv: number } }>(
      `${server.api}/ab_tests/${uid}/reports?start_date=2000-01-01&end_date=2099-12-31`,
    )
    expect(report.totals.pv).toBe(0)
    expect(report.totals.cv).toBe(0)
  })

  it('除外に当たらないアクセスは今までどおり数える', async () => {
    await postJson(`${server.api}/report-exclusions`, {
      conditions: [{ kind: 'ip', match_type: 'exact', value: '203.0.113.5', join: 'or' }],
    })
    const created = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, {
      title: '通常テスト',
      media_id: 1,
    })
    const uid = created.json.ab_test.uid
    await fetch(`${server.baseUrl}/lp/${uid}/__track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'pv' }),
    })
    const report = await getJson<{ totals: { pv: number } }>(
      `${server.api}/ab_tests/${uid}/reports?start_date=2000-01-01&end_date=2099-12-31`,
    )
    expect(report.totals.pv).toBe(1)
  })

  it('メールアドレスの除外は、除外リンクを開いたブラウザにだけ効く', async () => {
    const created = await postJson<{ report_exclusion: { uid: string } }>(
      `${server.api}/report-exclusions`,
      { conditions: [{ kind: 'email', match_type: 'exact', value: 'a@example.test', join: 'or' }] },
    )
    const token = created.json.report_exclusion.uid
    const page = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, {
      title: 'メール除外テスト',
      media_id: 1,
    })
    const uid = page.json.ab_test.uid

    // 目印を持たないブラウザは普通に数える
    await fetch(`${server.baseUrl}/lp/${uid}/__track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'pv' }),
    })
    // 除外リンクを開いたブラウザ（Cookieを持つ）は数えない
    const res = await fetch(`${server.baseUrl}/lp/${uid}/__track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `sb_report_exclude=${token}` },
      body: JSON.stringify({ event: 'pv' }),
    })
    expect(await res.json()).toMatchObject({ excluded: true })

    const report = await getJson<{ totals: { pv: number } }>(
      `${server.api}/ab_tests/${uid}/reports?start_date=2000-01-01&end_date=2099-12-31`,
    )
    expect(report.totals.pv).toBe(1)
  })

  it('除外リンクを開くと目印が返る。壊れたリンクは404', async () => {
    const created = await postJson<{ report_exclusion: { uid: string } }>(
      `${server.api}/report-exclusions`,
      { conditions: [{ kind: 'email', match_type: 'exact', value: 'b@example.test', join: 'or' }] },
    )
    const ok = await fetch(`${server.baseUrl}/exclude/${created.json.report_exclusion.uid}`)
    expect(ok.status).toBe(200)
    expect(ok.headers.get('set-cookie') ?? '').toContain('sb_report_exclude')
    const ng = await fetch(`${server.baseUrl}/exclude/NOT_A_REAL_TOKEN`)
    expect(ng.status).toBe(404)
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

  it('タブは「アクセス拒否」だけ（オーディエンス設定は指示で不要）', () => {
    expect(src).toContain('アクセス拒否')
    expect(src).not.toContain("textContent = '配信除外オーディエンス設定'")
  })

  it('実物の文言をそのまま出す', () => {
    expect(src).toContain('サイト閲覧は可能ですが、数値には反映されません')
    expect(src).toContain('ホワイトリストの対象にする')
  })

  it('実物の項目を揃える', () => {
    for (const label of ['除外条件', 'マッチタイプ', '設定済み除外条件', 'リクエスト数']) {
      expect(src, label).toContain(label)
    }
  })

  it('「結合条件」は意味が読める文言にする（指示）', () => {
    expect(src).toContain('次の条件とのつなぎ方')
    expect(src).toContain('または（どちらかに当てはまれば除外）')
    expect(src).toContain('かつ（両方に当てはまれば除外）')
    expect(src).not.toContain("field('結合条件'")
  })

  it('つなぎ方は「次の行がある行」にだけ出す（1行だけのとき意味を持たないため）', () => {
    expect(src).toContain('i === rows.length - 1')
  })

  it('リクエスト数の見出しはプルダウンと同じ呼び名を使う（ばらつかせない）', () => {
    expect(src).toContain('rankBox(KIND_LABELS.referer')
    expect(src).toContain('rankBox(KIND_LABELS.ip')
    expect(src).toContain('rankBox(KIND_LABELS.param')
    // 元の分かりにくい呼び名は残っていない
    expect(src).not.toContain("rankBox('リファラ'")
    expect(src).not.toContain("rankBox('ソースIP'")
    expect(src).not.toContain("rankBox('パラメータ'")
  })

  it('期間ボタンは実物と同じ6つ', () => {
    for (const label of ['今日', '今週', '今月', '3ヶ月', '半年', '1年']) {
      expect(src, label).toContain(label)
    }
  })

  it('分かりにくい名称は言い換える（指示）', () => {
    expect(src).toContain("referer: 'どこから来たか'")
    expect(src).toContain("param: 'URLのパラメーター'")
    // 元の分かりにくい名称は出さない
    expect(src).not.toContain("label: 'リファラ'")
    expect(src).not.toContain("label: 'パラメータ'")
  })

  it('メールアドレスを先頭に置く（指示）', () => {
    const first = src.indexOf("value: 'email'")
    const ip = src.indexOf("value: 'ip'")
    expect(first).toBeGreaterThan(0)
    expect(first).toBeLessThan(ip)
  })

  it('メールアドレスは除外リンク方式だと画面で説明する', () => {
    expect(src).toContain('ブラウザのログインアカウントはWebサイトからは読めない')
    expect(src).toContain('除外リンクをコピー')
  })

  it('プルダウンは実物どおりの選択肢', () => {
    for (const label of ['IPアドレス', 'チーム']) {
      expect(src, label).toContain(label)
    }
    for (const label of ['完全一致', '部分一致', '前方一致', '後方一致']) {
      expect(src, label).toContain(label)
    }
  })

  it('表示項目数は実物どおり5と10だけ', () => {
    expect(src).toContain('const LIMITS = [5, 10]')
  })

  it('複数条件を組み合わせられる（実物のボタン）', () => {
    expect(src).toContain('＋複数条件を組み合わせる')
    expect(src).toContain('addBtn.addEventListener(\'click\', addRow)')
  })
})

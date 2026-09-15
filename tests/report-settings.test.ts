/**
 * レポート設定（歯車から開く「表示するパラメータ」）。
 * 採取物: capture/clean/ab_tests__UID__reports/report-settings-modal/
 *   `_scopeTable_` に utm_medium / utm_source / utm_term / utm_content / utm_id / utm_campaign の6行。
 *   列は クリエイティブ / Branch Operation / ヒートマップ / メモ。初期はすべてON。
 *   保存ボタンは**無い**ので、触った時点で保存される作り（採取物にボタンが1つも無いことで確認）。
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { getJson, postJson, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'

let server: TestServer

interface Scope {
  name: string
  creative: boolean
  branch_operation: boolean
  heatmap: boolean
  description: string
}

async function createAbTest(): Promise<string> {
  const created = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, {
    title: 'レポート設定の確認用',
    media_id: 1,
  })
  return created.json.ab_test.uid
}

beforeEach(async () => {
  if (server === undefined) server = await startTestServer()
  resetStore()
})

afterAll(() => server?.close())

describe('表示するパラメータ', () => {
  it('採取した6行が同じ順で、はじめは全部ON', async () => {
    const uid = await createAbTest()
    const res = await getJson<{ parameter_scopes: Scope[] }>(
      `${server.api}/ab_tests/${uid}/parameter_scopes`,
    )
    expect(res.parameter_scopes.map((s) => s.name)).toEqual([
      'utm_medium',
      'utm_source',
      'utm_term',
      'utm_content',
      'utm_id',
      'utm_campaign',
    ])
    expect(res.parameter_scopes.every((s) => s.creative && s.branch_operation && s.heatmap)).toBe(true)
    expect(res.parameter_scopes.every((s) => s.description === '')).toBe(true)
  })

  it('切り替えとメモを保存して、読み直しても残る', async () => {
    const uid = await createAbTest()
    await sendJson('PUT', `${server.api}/ab_tests/${uid}/parameter_scopes`, {
      parameter_scopes: [{ name: 'utm_term', heatmap: false, description: '使っていない' }],
    })
    const res = await getJson<{ parameter_scopes: Scope[] }>(
      `${server.api}/ab_tests/${uid}/parameter_scopes`,
    )
    const term = res.parameter_scopes.find((s) => s.name === 'utm_term')
    expect(term).toMatchObject({ heatmap: false, creative: true, branch_operation: true, description: '使っていない' })
    // 触っていない行は変わらない
    expect(res.parameter_scopes.find((s) => s.name === 'utm_source')?.heatmap).toBe(true)
  })

  it('知らないパラメータ名は受け取らない（採取した6つだけ）', async () => {
    const uid = await createAbTest()
    await sendJson('PUT', `${server.api}/ab_tests/${uid}/parameter_scopes`, {
      parameter_scopes: [{ name: 'utm_evil', heatmap: false }],
    })
    const res = await getJson<{ parameter_scopes: Scope[] }>(
      `${server.api}/ab_tests/${uid}/parameter_scopes`,
    )
    expect(res.parameter_scopes.map((s) => s.name)).not.toContain('utm_evil')
  })

  it('ヒートマップをOFFにしたパラメータは、ヒートマップの一覧から消える', async () => {
    const uid = await createAbTest()
    const track = async (params: string[]): Promise<void> => {
      await fetch(`${server.baseUrl}/lp/${uid}/__track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'heatmap', bands: 4, reach: [1, 0, 0, 0], params }),
      })
    }
    await track(['utm_source=fb', 'utm_term=abc'])

    const range = 'start_date=2000-01-01&end_date=2099-12-31'
    const before = await getJson<{ parameters: { param: string }[] }>(
      `${server.api}/ab_tests/${uid}/heatmaps/stats?${range}`,
    )
    expect(before.parameters.map((p) => p.param).sort()).toEqual(['utm_source=fb', 'utm_term=abc'])

    await sendJson('PUT', `${server.api}/ab_tests/${uid}/parameter_scopes`, {
      parameter_scopes: [{ name: 'utm_term', heatmap: false }],
    })
    const after = await getJson<{ parameters: { param: string }[] }>(
      `${server.api}/ab_tests/${uid}/heatmaps/stats?${range}`,
    )
    expect(after.parameters.map((p) => p.param)).toEqual(['utm_source=fb'])
  })
})

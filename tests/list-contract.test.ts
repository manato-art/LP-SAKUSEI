/**
 * 一覧応答契約（企画書 §10-6）とモック制御（§10-8）の検証。
 * 「触れるが効かない」を禁止するため、ページング/ソート/フィルタ/検索が実際に効くことを機械証明する。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getJson, getStatus, postJson, resetStore, startTestServer, type TestServer } from './helpers/server.ts'

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

async function seedAbTests(count: number): Promise<void> {
  for (let i = 1; i <= count; i += 1) {
    await postJson(`${server.api}/ab_tests`, {
      title: `サンプル施策${String(i).padStart(3, '0')}`,
      media_id: (i % 8) + 1,
    })
  }
}

describe('ページネーション（§10-6）', () => {
  it('per_page と page が実際に効き、pagination が実件数から算出される', async () => {
    await seedAbTests(25)
    const first = await getJson<{
      pagination: { total_pages: number; total_count: number; current_page: number }
      ab_tests: unknown[]
    }>(`${server.api}/ab_tests?per_page=10&page=1`)
    expect(first.ab_tests).toHaveLength(10)
    expect(first.pagination).toEqual({ total_pages: 3, total_count: 25, current_page: 1 })

    const last = await getJson<{ ab_tests: unknown[] }>(`${server.api}/ab_tests?per_page=10&page=3`)
    expect(last.ab_tests).toHaveLength(5)
  })

  it('per_page 未指定なら既定20件（§10-6）', async () => {
    await seedAbTests(25)
    const page = await getJson<{ ab_tests: unknown[] }>(`${server.api}/ab_tests`)
    expect(page.ab_tests).toHaveLength(20)
  })

  it('current_page でも page と同じく解釈される', async () => {
    await seedAbTests(25)
    const page = await getJson<{ pagination: { current_page: number } }>(
      `${server.api}/ab_tests?per_page=10&current_page=2`,
    )
    expect(page.pagination.current_page).toBe(2)
  })
})

describe('ソート規約はエンドポイントごとに違う（§10-6）', () => {
  it('/ab_tests/rankings は sort & sort_direction を honor する', async () => {
    await seedAbTests(3)
    const asc = await getJson<{ ab_tests: { title: string }[] }>(
      `${server.api}/ab_tests/rankings?sort=title&sort_direction=asc`,
    )
    const desc = await getJson<{ ab_tests: { title: string }[] }>(
      `${server.api}/ab_tests/rankings?sort=title&sort_direction=desc`,
    )
    expect(asc.ab_tests[0]?.title).toBe('サンプル施策001')
    expect(desc.ab_tests[0]?.title).toBe('サンプル施策003')
  })

  it('/teams/version-rankings は sort_by & sort_order を honor する', async () => {
    await seedAbTests(3)
    const asc = await getJson<{ versions: { ab_test_title: string }[] }>(
      `${server.api}/teams/version-rankings?sort_by=name&sort_order=asc`,
    )
    expect(asc.versions.length).toBeGreaterThan(0)
    // sort 規約違い: version-rankings に sort= を渡しても無視される
    const ignored = await getJson<{ versions: unknown[] }>(
      `${server.api}/teams/version-rankings?sort=name&sort_direction=asc`,
    )
    expect(ignored.versions).toHaveLength(asc.versions.length)
  })

  it('許可されていないソートキーは無視される（外部入力を信用しない）', async () => {
    await seedAbTests(3)
    const injected = await getJson<{ ab_tests: unknown[] }>(
      `${server.api}/ab_tests?sort=__proto__&sort_direction=asc`,
    )
    expect(injected.ab_tests).toHaveLength(3)
  })
})

describe('フィルタ・検索（§10-6）', () => {
  it('media_id で実際に絞り込まれる', async () => {
    await seedAbTests(8)
    const filtered = await getJson<{ ab_tests: { media_id: number }[] }>(
      `${server.api}/ab_tests?media_id=2`,
    )
    expect(filtered.ab_tests.length).toBeGreaterThan(0)
    expect(filtered.ab_tests.every((t) => t.media_id === 2)).toBe(true)
  })

  it('published のような真偽フィルタが効く', async () => {
    await seedAbTests(3)
    const unpublished = await getJson<{ ab_tests: unknown[] }>(`${server.api}/ab_tests?published=false`)
    expect(unpublished.ab_tests).toHaveLength(3)
    const published = await getJson<{ ab_tests: unknown[] }>(`${server.api}/ab_tests?published=true`)
    expect(published.ab_tests).toHaveLength(0)
  })

  it('q / keyword で title の部分一致検索ができる', async () => {
    await seedAbTests(12)
    const byQ = await getJson<{ ab_tests: unknown[] }>(`${server.api}/ab_tests?q=施策001`)
    expect(byQ.ab_tests).toHaveLength(1)
    const byKeyword = await getJson<{ ab_tests: unknown[] }>(`${server.api}/ab_tests?keyword=施策01`)
    expect(byKeyword.ab_tests).toHaveLength(3) // 010, 011, 012
  })

  it('ヒット0件でも200で空配列を返す（filter-empty 状態）', async () => {
    await seedAbTests(3)
    const none = await getJson<{ ab_tests: unknown[]; pagination: { total_count: number } }>(
      `${server.api}/ab_tests?q=存在しない語`,
    )
    expect(none.ab_tests).toHaveLength(0)
    expect(none.pagination.total_count).toBe(0)
  })
})

describe('モック制御 ?mock_state=（§10-8）', () => {
  it('empty は空配列を返す', async () => {
    await seedAbTests(3)
    const empty = await getJson<{ ab_tests: unknown[] }>(`${server.api}/ab_tests?mock_state=empty`)
    expect(empty.ab_tests).toHaveLength(0)
  })

  it('error はエラー封筒 {"error":{code,message}} を 500 で返す', async () => {
    const res = await fetch(`${server.api}/ab_tests?mock_state=error`)
    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: { code: string; message: string } }
    expect(body.error.code).toBe('internal_server_error')
    expect(typeof body.error.message).toBe('string')
  })

  it('付与なし（既定）は success', async () => {
    await seedAbTests(2)
    expect(await getStatus(`${server.api}/ab_tests`)).toBe(200)
  })
})

describe('未定義エンドポイント（§13-B「未定義404を作らない」）', () => {
  it('未知のAPIパスは 404 とエラー封筒を返す（無言のハングにしない）', async () => {
    const res = await fetch(`${server.api}/this_endpoint_does_not_exist`)
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('not_found')
  })
})

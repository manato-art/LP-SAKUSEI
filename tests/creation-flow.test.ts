/**
 * 「実際に使える」の機械証明（企画書 §1-4・§10-9）。
 * 新規アカウント（空）から フォルダ作成 → beyondページ作成 → Version追加 → LP編集 → 公開 が
 * 「作成 → 一覧に出る → 開ける」まで一貫して繋がることを検証する。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getJson, postJson, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'

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

describe('新規アカウント発行直後（既定シード＝空・§10-5）', () => {
  it('フォルダ・beyondページ・タスク・CVが0件で始まる', async () => {
    const folders = await getJson<{ folders: unknown[]; pagination: { total_count: number } }>(
      `${server.api}/folders`,
    )
    expect(folders.folders).toHaveLength(0)
    expect(folders.pagination.total_count).toBe(0)

    const abTests = await getJson<{ ab_tests: unknown[] }>(`${server.api}/ab_tests`)
    expect(abTests.ab_tests).toHaveLength(0)

    const tasks = await getJson<{ tasks: unknown[] }>(`${server.api}/tasks`)
    expect(tasks.tasks).toHaveLength(0)

    const conversions = await getJson<{ conversions: unknown[] }>(`${server.api}/conversions`)
    expect(conversions.conversions).toHaveLength(0)
  })

  it('ダッシュボードのKPIは全て0で、ゼロ除算のROASは null になる', async () => {
    const dashboard = await getJson<{
      kpi: { sales: number; cv: number; roas: number | null; cpa: number | null }
      series: unknown[]
    }>(`${server.api}/teams/dashboard`)
    expect(dashboard.kpi.sales).toBe(0)
    expect(dashboard.kpi.cv).toBe(0)
    expect(dashboard.kpi.roas).toBeNull()
    expect(dashboard.kpi.cpa).toBeNull()
    expect(dashboard.series).toHaveLength(7) // 既定期間＝過去7日（§10-6）
  })

  it('媒体ロスターとプランは選択肢として存在する（§10-5 Media固定保持）', async () => {
    const plans = await getJson<{ plans: unknown[]; current_plan_id: number }>(
      `${server.api}/teams/plans`,
    )
    expect(plans.plans).toHaveLength(1)
    expect(plans.current_plan_id).toBe(1)
  })
})

describe('作成フロー（§1-4 creation flow・§10-9 セッション内永続化）', () => {
  it('フォルダ作成 → 一覧に出る → 開ける', async () => {
    const created = await postJson<{ folder: { uid: string; name: string } }>(
      `${server.api}/folders`,
      { name: 'サンプルフォルダ001' },
    )
    expect(created.status).toBe(201)
    expect(created.json.folder.name).toBe('サンプルフォルダ001')

    const list = await getJson<{ folders: { uid: string }[] }>(`${server.api}/folders`)
    expect(list.folders).toHaveLength(1)

    const detail = await getJson<{ folder: { name: string } }>(
      `${server.api}/folders/${created.json.folder.uid}`,
    )
    expect(detail.folder.name).toBe('サンプルフォルダ001')
  })

  it('beyondページ作成で記事と初期Versionが同時に作られ、直後にエディタが開ける', async () => {
    const folder = await postJson<{ folder: { id: number } }>(`${server.api}/folders`, {
      name: 'サンプルフォルダ001',
    })
    const created = await postJson<{
      ab_test: {
        uid: string
        media: { name: string }
        folder: { name: string }
        ad_status: string
        editor_version: number
        created_at: number
      }
      article: { uid: string }
      version: { uid: string; name: string; distribution_ratio: number; status: string }
    }>(`${server.api}/ab_tests`, {
      title: 'サンプル施策001',
      folder_id: folder.json.folder.id,
      media_id: 1,
    })

    expect(created.status).toBe(201)
    // 実機の初期Version名は `Ver.` + 4桁（企画書の「パターンA」は誤り・2026-08-31 実測）
    expect(created.json.version.name).toMatch(/^Ver\.\d{4}$/)
    // 実機の新規作成直後の配信割合は 1（100ではない）
    expect(created.json.version.distribution_ratio).toBe(1)
    expect(created.json.version.status).toBe('準備中')
    // 実APIの media はフラット（`media.attributes` ではない・2026-08-31 実測）
    expect(created.json.ab_test.media.name).toBe('AdAsia')
    expect(created.json.ab_test.folder.name).toBe('サンプルフォルダ001')
    // 実APIの配信ステータスは prepared 始まり、タイムスタンプは数値
    expect(created.json.ab_test.ad_status).toBe('prepared')
    expect(created.json.ab_test.editor_version).toBe(2)
    expect(typeof created.json.ab_test.created_at).toBe('number')

    // フォルダの非正規化カウントが更新される
    const folders = await getJson<{ folders: { ab_tests_count: number }[] }>(`${server.api}/folders`)
    expect(folders.folders[0]?.ab_tests_count).toBe(1)

    // エディタ（/ab_tests/:uid/articles）が叩く3本が揃う（§6-2・§10-3）
    const abTestUid = created.json.ab_test.uid
    const articleUid = created.json.article.uid
    const detail = await getJson<{ ab_test: { title: string } }>(`${server.api}/ab_tests/${abTestUid}`)
    expect(detail.ab_test.title).toBe('サンプル施策001')

    const articles = await getJson<{ articles: unknown[] }>(`${server.api}/ab_tests/${abTestUid}/articles`)
    expect(articles.articles).toHaveLength(1)

    const versions = await getJson<{ versions: { html: string }[]; distribution_total: number }>(
      `${server.api}/articles/${articleUid}/versions`,
    )
    expect(versions.versions).toHaveLength(1)
    expect(versions.versions[0]?.html).toContain('lp-root')
    // 実機の初期配信割合は 1（企画書の100は誤り・2026-08-31 実測）
    expect(versions.distribution_total).toBe(1)
  })
})

describe('Version操作（§9-1[2][4]）', () => {
  async function setupAbTest(): Promise<{ abTestUid: string; articleUid: string; versionUid: string }> {
    const created = await postJson<{
      ab_test: { uid: string }
      article: { uid: string }
      version: { uid: string }
    }>(`${server.api}/ab_tests`, { title: 'サンプル施策001', media_id: 1 })
    return {
      abTestUid: created.json.ab_test.uid,
      articleUid: created.json.article.uid,
      versionUid: created.json.version.uid,
    }
  }

  it('Version追加すると2件になり、合計が100%でないので警告が返る', async () => {
    const { articleUid } = await setupAbTest()
    const added = await postJson<{ version: { name: string; distribution_ratio: number } }>(
      `${server.api}/articles/${articleUid}/versions`,
    )
    expect(added.status).toBe(201)
    expect(added.json.version.name).toMatch(/^Ver\.\d{4}$/)
    expect(added.json.version.distribution_ratio).toBe(0)

    const versions = await getJson<{
      versions: unknown[]
      distribution_total: number
      distribution_warning: string | null
    }>(`${server.api}/articles/${articleUid}/versions`)
    expect(versions.versions).toHaveLength(2)
    // 初期値1 + 追加分0 = 1% なので100%警告が出る
    expect(versions.distribution_total).toBe(1)
    expect(versions.distribution_warning).toContain('100%')
  })

  it('配信割合を変更でき、合計が100%になれば警告が消える', async () => {
    const { articleUid, versionUid } = await setupAbTest()
    const changed = await sendJson<{ distribution_total: number; distribution_warning: string | null }>(
      'PATCH',
      `${server.api}/versions/${versionUid}/distribution`,
      { distribution_ratio: 60 },
    )
    expect(changed.status).toBe(200)
    expect(changed.json.distribution_total).toBe(60)
    expect(changed.json.distribution_warning).toContain('100%')

    const added = await postJson<{ version: { uid: string } }>(
      `${server.api}/articles/${articleUid}/versions`,
    )
    const balanced = await sendJson<{ distribution_total: number; distribution_warning: string | null }>(
      'PATCH',
      `${server.api}/versions/${added.json.version.uid}/distribution`,
      { distribution_ratio: 40 },
    )
    expect(balanced.json.distribution_total).toBe(100)
    expect(balanced.json.distribution_warning).toBeNull()
  })

  it('0-100の範囲外は422で拒否する（境界バリデーション）', async () => {
    const { versionUid } = await setupAbTest()
    const tooLarge = await sendJson<{ error: { message: string } }>(
      'PATCH',
      `${server.api}/versions/${versionUid}/distribution`,
      { distribution_ratio: 150 },
    )
    expect(tooLarge.status).toBe(422)
    expect(tooLarge.json.error.message).toContain('0〜100')

    const negative = await sendJson('PATCH', `${server.api}/versions/${versionUid}/distribution`, {
      distribution_ratio: -1,
    })
    expect(negative.status).toBe(422)
  })

  it('LP編集(html/css)が保存され、再取得で反映されている', async () => {
    const { articleUid, versionUid } = await setupAbTest()
    const edited = '<div class="lp-root"><h1>編集済み見出し</h1></div>'
    const saved = await sendJson<{ version: { html: string } }>('PUT', `${server.api}/versions/${versionUid}`, {
      html: edited,
    })
    expect(saved.status).toBe(200)
    expect(saved.json.version.html).toBe(edited)

    const reloaded = await getJson<{ versions: { html: string }[] }>(
      `${server.api}/articles/${articleUid}/versions`,
    )
    expect(reloaded.versions[0]?.html).toBe(edited)

    // プレビュー（iframe srcdoc注入用・§9-1[3]）にも反映される
    const preview = await getJson<{ preview: { html: string } }>(
      `${server.api}/articles/${articleUid}/previews`,
    )
    expect(preview.preview.html).toBe(edited)
  })

  it('公開すると Version が公開中になり、beyondページの配信ステータスが delivered になる', async () => {
    const { abTestUid, versionUid } = await setupAbTest()
    const published = await postJson<{ version: { status: string } }>(
      `${server.api}/versions/${versionUid}/publish`,
    )
    expect(published.status).toBe(200)
    expect(published.json.version.status).toBe('公開中')

    // 実機の配信ステータスは prepared / delivered / stopping / finished の4値（実測）
    const abTest = await getJson<{ ab_test: { ad_status: string } }>(
      `${server.api}/ab_tests/${abTestUid}`,
    )
    expect(abTest.ab_test.ad_status).toBe('delivered')
  })
})

describe('リセット（§10-9）', () => {
  it('POST /__mock/reset で新規アカウント発行直後（空）へ戻る', async () => {
    await postJson(`${server.api}/folders`, { name: 'サンプルフォルダ001' })
    await postJson(`${server.api}/ab_tests`, { title: 'サンプル施策001' })
    expect((await getJson<{ folders: unknown[] }>(`${server.api}/folders`)).folders).toHaveLength(1)

    await postJson(`${server.baseUrl}/__mock/reset`)

    expect((await getJson<{ folders: unknown[] }>(`${server.api}/folders`)).folders).toHaveLength(0)
    expect((await getJson<{ ab_tests: unknown[] }>(`${server.api}/ab_tests`)).ab_tests).toHaveLength(0)
  })

  it('?reset=1 でも空へ戻る', async () => {
    await postJson(`${server.api}/folders`, { name: 'サンプルフォルダ001' })
    const afterReset = await getJson<{ folders: unknown[] }>(`${server.api}/folders?reset=1`)
    expect(afterReset.folders).toHaveLength(0)
  })
})

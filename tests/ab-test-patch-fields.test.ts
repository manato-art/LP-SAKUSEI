/**
 * beyondページの更新（PUT /ab_tests/:uid）で、画面から送っているのに黙って捨てられていた項目（2026-09-24 点検）。
 *
 *   - 配信ステータス（ad_status）… 一覧の「ステータスを終了にする」と詳細パネルの鉛筆が送るが、
 *     受け口に分岐が無く 200 のまま何も変わらなかった。決まった4つの値だけを受ける。
 *   - 基本情報の 開始/締切/終了・コンバージョン期限・スーパーリロード回数・メディア掲載・成果測定方法 …
 *     入力できて「更新しました」と出るのに、保存されていなかった。どれも**記録するだけ**（配信は変えない）。
 *   - タブ表示名（page_title）… 保存はしていたが、読み込みで返しておらず、次に保存すると空で上書きしていた。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { parseAbTestPatch } from '../mock-server/store/ab-test-patch.ts'
import { createAbTest, createFolder } from '../mock-server/store/actions.ts'
import { getState, setState } from '../mock-server/store/store.ts'
import { getJson, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'

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

function seedAbTest(): string {
  let uid = ''
  setState((state) => {
    const folder = createFolder(state, { name: 'サンプルフォルダ001', parent_id: null })
    const out = createAbTest(folder.state, { title: 'サンプル施策001', memo: '', folder_id: folder.folder.id, media_id: 3 })
    uid = out.abTest.uid
    return out.state
  })
  return uid
}

describe('配信ステータス（ad_status）', () => {
  it('決まった4つの値は patch に入る', () => {
    for (const value of ['prepared', 'delivered', 'stopping', 'finished']) {
      expect(parseAbTestPatch({ ad_status: value })).toEqual({ ok: true, value: { ad_status: value } })
    }
  })

  it('それ以外の値は受け付けない（黙って捨てない）', () => {
    expect(parseAbTestPatch({ ad_status: 'running' }).ok).toBe(false)
    expect(parseAbTestPatch({ ad_status: '終了' }).ok).toBe(false)
    expect(parseAbTestPatch({ ad_status: null }).ok).toBe(false)
  })

  it('PUT で保存され、再取得で戻ってくる', async () => {
    const uid = seedAbTest()
    const saved = await sendJson<{ ab_test: { ad_status: string } }>('PUT', `${server.api}/ab_tests/${uid}`, {
      ad_status: 'finished',
    })
    expect(saved.status).toBe(200)
    expect(saved.json.ab_test.ad_status).toBe('finished')
    const body = await getJson<{ ab_test: { ad_status: string } }>(`${server.api}/ab_tests/${uid}`)
    expect(body.ab_test.ad_status).toBe('finished')
  })

  it('不正な値は 4xx のエラー封筒で返し、保存済みの値は変えない', async () => {
    const uid = seedAbTest()
    const res = await sendJson<{ error: { code: string } }>('PUT', `${server.api}/ab_tests/${uid}`, {
      ad_status: 'running',
    })
    expect(res.status).toBe(422)
    expect(res.json.error.code).toBe('validation_failed')
    expect(getState().abTests.find((t) => t.uid === uid)?.ad_status).toBe('prepared')
  })
})

describe('基本情報の「記録するだけ」の項目', () => {
  it('日付は YYYY-MM-DD か空（未設定）だけ', () => {
    expect(parseAbTestPatch({ start_date: '2026-10-01' })).toEqual({ ok: true, value: { start_date: '2026-10-01' } })
    expect(parseAbTestPatch({ end_date: '' })).toEqual({ ok: true, value: { end_date: null } })
    expect(parseAbTestPatch({ deadline_date: '2026/10/01' }).ok).toBe(false)
    expect(parseAbTestPatch({ start_date: '2026-02-30' }).ok).toBe(false)
  })

  it('コンバージョン期限・スーパーリロード回数は0以上の整数', () => {
    expect(parseAbTestPatch({ conversion_limit_days: '7', super_reload_count: 2 })).toEqual({
      ok: true,
      value: { conversion_limit_days: 7, super_reload_count: 2 },
    })
    expect(parseAbTestPatch({ conversion_limit_days: -1 }).ok).toBe(false)
    expect(parseAbTestPatch({ super_reload_count: 1.5 }).ok).toBe(false)
  })

  it('メディア掲載は true/false、成果測定方法は none/strict だけ', () => {
    expect(parseAbTestPatch({ media_listing: true, measurement_method: 'strict' })).toEqual({
      ok: true,
      value: { media_listing: true, measurement_method: 'strict' },
    })
    expect(parseAbTestPatch({ media_listing: 'yes' }).ok).toBe(false)
    expect(parseAbTestPatch({ measurement_method: 'loose' }).ok).toBe(false)
  })

  it('保存され、基本情報の読み込み（/edit）で戻ってくる', async () => {
    const uid = seedAbTest()
    const saved = await sendJson('PUT', `${server.api}/ab_tests/${uid}`, {
      start_date: '2026-10-01',
      deadline_date: '2026-10-20',
      end_date: '2026-10-31',
      conversion_limit_days: 30,
      super_reload_count: 3,
      media_listing: true,
      measurement_method: 'strict',
      page_title: 'タブの名前',
    })
    expect(saved.status).toBe(200)
    const body = await getJson<{ ab_test: Record<string, unknown> }>(`${server.api}/ab_tests/${uid}/edit`)
    expect(body.ab_test).toMatchObject({
      start_date: '2026-10-01',
      deadline_date: '2026-10-20',
      end_date: '2026-10-31',
      conversion_limit_days: 30,
      super_reload_count: 3,
      media_listing: true,
      measurement_method: 'strict',
      page_title: 'タブの名前',
    })
  })

  it('まだ入れていないページは未設定（null / false / none）で返す', async () => {
    const uid = seedAbTest()
    const body = await getJson<{ ab_test: Record<string, unknown> }>(`${server.api}/ab_tests/${uid}/edit`)
    expect(body.ab_test).toMatchObject({
      start_date: null,
      deadline_date: null,
      end_date: null,
      conversion_limit_days: null,
      super_reload_count: null,
      media_listing: false,
      measurement_method: 'none',
      page_title: '',
    })
  })
})

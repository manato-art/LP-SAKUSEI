/**
 * 異常のお知らせの設定（2026-09-15）。
 * アカウント設定 → 通知設定 から決める。
 *
 * 送り先は**何件でも**持てる（チャットワークとLINEの両方へ、など）。
 * 返す形は必ず配列。1件のオブジェクトで保存されていた古い状態も配列として読む。
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { getJson, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'
import { setState } from '../mock-server/store/store.ts'

let server: TestServer
const URL_PATH = (): string => `${server.api}/settings/alerts`

interface Res {
  settings: {
    enabled: boolean
    cv_silent_hours: number
    cpa_limit: number
    notify: { service: string; destination_id: string }[]
  }
}

beforeEach(async () => {
  if (server === undefined) server = await startTestServer()
  resetStore()
})

afterAll(() => server?.close())

describe('異常のお知らせの設定', () => {
  it('はじめは切（送り先を決めるまで鳴らさない）', async () => {
    const res = await getJson<Res>(URL_PATH())
    expect(res.settings.enabled).toBe(false)
    expect(res.settings.notify).toEqual([])
  })

  it('保存すると残る', async () => {
    await sendJson('PUT', URL_PATH(), {
      enabled: true,
      cv_silent_hours: 12,
      cpa_limit: 8000,
      notify: [{ service: 'slack', destination_id: 'C123' }],
    })
    const res = await getJson<Res>(URL_PATH())
    expect(res.settings).toMatchObject({
      enabled: true,
      cv_silent_hours: 12,
      cpa_limit: 8000,
      notify: [{ service: 'slack', destination_id: 'C123' }],
    })
  })

  it('時間は1〜72の間だけ受ける（0だと鳴りっぱなしになる）', async () => {
    const zero = await sendJson('PUT', URL_PATH(), { cv_silent_hours: 0 })
    expect(zero.status).toBe(422)
    const huge = await sendJson('PUT', URL_PATH(), { cv_silent_hours: 999 })
    expect(huge.status).toBe(422)
  })

  it('CPAの上限に負の数は受けない', async () => {
    const res = await sendJson('PUT', URL_PATH(), { cpa_limit: -1 })
    expect(res.status).toBe(422)
  })

  it('知らない送り先は受けない', async () => {
    const res = await sendJson('PUT', URL_PATH(), {
      notify: [{ service: 'email', destination_id: 'x@example.test' }],
    })
    expect(res.status).toBe(422)
  })

  it('送り先を空にできる（お知らせを止める）', async () => {
    await sendJson('PUT', URL_PATH(), {
      enabled: true,
      notify: [{ service: 'slack', destination_id: 'C1' }],
    })
    await sendJson('PUT', URL_PATH(), { notify: [] })
    const res = await getJson<Res>(URL_PATH())
    expect(res.settings.notify).toEqual([])
  })
})

describe('送り先を何件でも持てる', () => {
  it('チャットワークとLINEの両方へ送れる', async () => {
    await sendJson('PUT', URL_PATH(), {
      enabled: true,
      notify: [
        { service: 'chatwork', destination_id: '123456' },
        { service: 'line', destination_id: '' },
      ],
    })
    const res = await getJson<Res>(URL_PATH())
    expect(res.settings.notify).toEqual([
      { service: 'chatwork', destination_id: '123456' },
      { service: 'line', destination_id: '' },
    ])
  })

  it('LINEは送り先IDが空でもよい（友だち全員へ送る）', async () => {
    const res = await sendJson('PUT', URL_PATH(), {
      notify: [{ service: 'line', destination_id: '' }],
    })
    expect(res.status).toBe(200)
  })

  it('Slackとチャットワークは送り先IDが要る（どこへ送るか決まらない）', async () => {
    const slack = await sendJson('PUT', URL_PATH(), {
      notify: [{ service: 'slack', destination_id: '' }],
    })
    expect(slack.status).toBe(422)
    const chatwork = await sendJson('PUT', URL_PATH(), {
      notify: [{ service: 'chatwork', destination_id: '  ' }],
    })
    expect(chatwork.status).toBe(422)
  })

  it('同じ送り先を2回入れても1件にまとめる（同じ通知が2通来ない）', async () => {
    await sendJson('PUT', URL_PATH(), {
      notify: [
        { service: 'slack', destination_id: 'C1' },
        { service: 'slack', destination_id: 'C1' },
      ],
    })
    const res = await getJson<Res>(URL_PATH())
    expect(res.settings.notify).toHaveLength(1)
  })
})

describe('古い形の設定も読める', () => {
  it('1件のオブジェクトで保存されていたら1件の配列として返す', async () => {
    // この機能が出た日の形（notify がオブジェクト1件）。本番の state に残りうる。
    setState((s) => ({
      ...s,
      alertSetting: {
        ...s.alertSetting,
        notify: { service: 'slack', destination_id: 'C_OLD' },
      } as never,
    }))
    const res = await getJson<Res>(URL_PATH())
    expect(res.settings.notify).toEqual([{ service: 'slack', destination_id: 'C_OLD' }])
  })

  it('null で保存されていたら空の配列として返す', async () => {
    setState((s) => ({ ...s, alertSetting: { ...s.alertSetting, notify: null } as never }))
    const res = await getJson<Res>(URL_PATH())
    expect(res.settings.notify).toEqual([])
  })

  it('1件のオブジェクトで送られてきても受ける', async () => {
    const res = await sendJson('PUT', URL_PATH(), {
      notify: { service: 'chatwork', destination_id: '999' },
    })
    expect(res.status).toBe(200)
    const got = await getJson<Res>(URL_PATH())
    expect(got.settings.notify).toEqual([{ service: 'chatwork', destination_id: '999' }])
  })
})

/**
 * ポップアップは「保存したら、すぐ配信に出る」（2026-10-31 本人「わざわざ 下書き反映 本番反映 これ操作するのだるいから、
 * オンオフのボタンはあるし、追加したら反映でいいよ」）。
 *
 * 2026-09-24 に分けた「下書き」と「本番」をやめる:
 * - 作った（プリセット・新規・複製）・保存した中身が、そのまま配信に出る（配信ONのとき）。出したくないときは配信OFF
 * - 「本番反映」（POST …/publish）はもう無い。返す形にも本番の中身・本番との違いは入れない
 * - 前のデータ: 一度も本番反映していなかったポップアップは、いま配信に出ていない。そのまま出ないよう配信OFFにする
 *   （配信ONのまま本番の中身が無い＝出ていなかった物が、いきなり出ないように）。本番の中身の控えは外す
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { postJson, resetStore, sendJson, startTestServer, type TestServer, issueCreatedPage } from './helpers/server.ts'
import { settlePopupDrafts } from '../mock-server/store/popups.ts'
import { createEmptyState } from '../mock-server/store/seed-empty.ts'
import type { ExitPopup, FollowPopup, State } from '../mock-server/store/types.ts'

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

interface PopupJson {
  uid: string
  ratio: number
  html: string
  name: string
  popup_kind?: string
}

async function newPage(): Promise<{ page: string; version: string }> {
  const created = await postJson<{ ab_test: { uid: string }; version: { uid: string } }>(`${server.api}/ab_tests`, { title: 'ポップ', media_id: 1 })
  await issueCreatedPage(server.api, created.json)
  return { page: created.json.ab_test.uid, version: created.json.version.uid }
}

const lp = async (page: string): Promise<string> => (await fetch(`${server.baseUrl}/lp/${page}`)).text()
const exitUrl = (page: string, uid = ''): string => `${server.api}/ab_tests/${page}/exit_popups${uid === '' ? '' : `/${uid}`}`
const followUrl = (page: string, uid = ''): string => `${server.api}/ab_tests/${page}/follow_popups${uid === '' ? '' : `/${uid}`}`

async function addExit(page: string, html: string, extra: Record<string, unknown> = {}): Promise<PopupJson> {
  const res = await postJson<{ exit_popup: PopupJson }>(exitUrl(page), { name: 'P', html, ...extra })
  expect(res.status).toBe(201)
  return res.json.exit_popup
}

describe('離脱防止・表示直後: 保存したらすぐ配信', () => {
  it('作ったら、すぐ配信に出る（配信ON）', async () => {
    const { page } = await newPage()
    await addExit(page, '<p>MARK-NEW</p>')
    expect(await lp(page)).toContain('MARK-NEW')
  })

  it('保存すると、すぐ配信の中身が変わる', async () => {
    const { page } = await newPage()
    const popup = await addExit(page, '<p>MARK-1</p>')
    expect((await sendJson('PUT', exitUrl(page, popup.uid), { html: '<p>MARK-2</p>' })).status).toBe(200)
    const html = await lp(page)
    expect(html).toContain('MARK-2')
    expect(html).not.toContain('MARK-1')
  })

  it('配信OFFなら出ない', async () => {
    const { page } = await newPage()
    const popup = await addExit(page, '<p>MARK-OFF</p>')
    await sendJson('PUT', exitUrl(page, popup.uid), { enabled: false })
    expect(await lp(page)).not.toContain('MARK-OFF')
  })

  it('「本番反映」はもう無い・返す形に本番の中身や本番との違いを入れない', async () => {
    const { page } = await newPage()
    const popup = await addExit(page, '<p>x</p>')
    expect((await postJson(`${exitUrl(page, popup.uid)}/publish`)).status).toBe(404)
    expect(popup).not.toHaveProperty('live')
    expect(popup).not.toHaveProperty('publish_status')
  })

  it('プレビュー（検証用）も保存した中身', async () => {
    const { page, version } = await newPage()
    const popup = await addExit(page, '<p>MARK-PV1</p>')
    await sendJson('PUT', exitUrl(page, popup.uid), { html: '<p>MARK-PV2</p>' })
    const html = await (await fetch(`${server.baseUrl}/preview/${version}`)).text()
    expect(html).toContain('MARK-PV2')
  })

  it('「LPの上で確認」（?popup_draft=）は、配信OFFでもそのポップアップを出す', async () => {
    const { page, version } = await newPage()
    const popup = await addExit(page, '<p>MARK-CHECK</p>')
    await sendJson('PUT', exitUrl(page, popup.uid), { enabled: false })
    const html = await (await fetch(`${server.baseUrl}/preview/${version}?popup_draft=${popup.uid}`)).text()
    expect(html).toContain('MARK-CHECK')
    expect(html).toContain('このLPは検証用です')
  })

  it('作るときの割合: その種類の1つ目は100%、2つ目からは0%（種類ごと）', async () => {
    const { page } = await newPage()
    expect((await addExit(page, '<p>a</p>')).ratio).toBe(100)
    expect((await addExit(page, '<p>b</p>')).ratio).toBe(0)
    expect((await addExit(page, '<p>c</p>', { popup_kind: 'instant' })).ratio).toBe(100)
  })

  it('複製は、保存した中身を写した別のポップアップ（名前は「〜のコピー」）', async () => {
    const { page } = await newPage()
    const source = await addExit(page, '<p>MARK-SRC</p>')
    const copied = await postJson<{ exit_popup: PopupJson }>(`${exitUrl(page, source.uid)}/duplicate`, { popup_kind: 'instant' })
    expect(copied.status).toBe(201)
    expect(copied.json.exit_popup.uid).not.toBe(source.uid)
    expect(copied.json.exit_popup.html).toBe('<p>MARK-SRC</p>')
    expect(copied.json.exit_popup.name).toBe('Pのコピー')
    expect(copied.json.exit_popup.popup_kind).toBe('instant')
  })
})

describe('追従型: 保存したらすぐ配信', () => {
  it('作ったら出る・保存したら変わる・本番反映は無い', async () => {
    const { page } = await newPage()
    const created = await postJson<{ follow_popup: PopupJson }>(followUrl(page), { name: 'F', html: '<p>MARK-F1</p>' })
    const uid = created.json.follow_popup.uid
    expect(created.json.follow_popup).not.toHaveProperty('publish_status')
    expect(await lp(page)).toContain('MARK-F1')
    await sendJson('PUT', followUrl(page, uid), { html: '<p>MARK-F2</p>' })
    expect(await lp(page)).toContain('MARK-F2')
    expect((await postJson(`${followUrl(page, uid)}/publish`)).status).toBe(404)
  })

  it('複製できる', async () => {
    const { page } = await newPage()
    const created = await postJson<{ follow_popup: PopupJson }>(followUrl(page), { name: 'F', html: '<p>MARK-FC</p>' })
    const copied = await postJson<{ follow_popup: PopupJson }>(`${followUrl(page, created.json.follow_popup.uid)}/duplicate`)
    expect(copied.status).toBe(201)
    expect(copied.json.follow_popup.name).toBe('Fのコピー')
  })
})

describe('前のデータ（下書きと本番に分けていた頃）を読み込むとき', () => {
  type Legacy<T> = T & { live?: Record<string, unknown> | null }
  const exit = (uid: string, enabled: boolean, live: Record<string, unknown> | null | undefined): Legacy<ExitPopup> =>
    ({ uid, enabled, html: `<p>${uid}</p>`, ...(live === undefined ? {} : { live }) }) as unknown as Legacy<ExitPopup>
  const follow = (uid: string, enabled: boolean, live: Record<string, unknown> | null | undefined): Legacy<FollowPopup> =>
    ({ uid, enabled, html: `<p>${uid}</p>`, ...(live === undefined ? {} : { live }) }) as unknown as Legacy<FollowPopup>

  it('一度も本番反映していなかった物（いま出ていない）は配信OFFにする。出ていた物はそのまま', () => {
    const state: State = {
      ...createEmptyState(),
      exitPopups: [exit('E-never', true, null), exit('E-live', true, { html: '<p>E-live</p>' }), exit('E-old', true, undefined)],
      followPopups: [follow('F-never', true, null), follow('F-off', false, null), follow('F-live', true, { html: '<p>F-live</p>' })],
    }
    const out = settlePopupDrafts(state)
    const enabled = (list: readonly { uid: string; enabled: boolean }[]): Record<string, boolean> =>
      Object.fromEntries(list.map((p) => [p.uid, p.enabled]))
    expect(enabled(out.state.exitPopups)).toEqual({ 'E-never': false, 'E-live': true, 'E-old': true })
    expect(enabled(out.state.followPopups)).toEqual({ 'F-never': false, 'F-off': false, 'F-live': true })
    expect(out.turnedOff).toEqual(['E-never', 'F-never'])
  })

  it('本番の中身の控えは外す（保存した中身がそのまま配信）。もう外した後なら何もしない', () => {
    const state: State = { ...createEmptyState(), exitPopups: [exit('E-live', true, { html: '<p>E-live</p>' })], followPopups: [] }
    const out = settlePopupDrafts(state)
    expect(out.state.exitPopups[0]).not.toHaveProperty('live')
    expect(out.changed).toBe(1)
    const again = settlePopupDrafts(out.state)
    expect(again.changed).toBe(0)
    expect(again.state).toBe(out.state)
  })
})

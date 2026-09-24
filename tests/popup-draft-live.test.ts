/**
 * ポップアップの「下書き」と「本番」を分けることの機械証明（2026-09-24 監査 26・本人の決定「下書きと本番を分ける」）。
 *
 * - 「下書き反映」（PUT）は下書きだけを書き換え、配信には出ない。
 * - 「本番反映」（POST …/publish）で、そのときの下書きを本番に写す。配信は本番だけを使う。
 * - 作ったばかりのポップアップ（プリセット・新規・複製）は、本番反映するまで配信しない。
 * - この仕組みより前に作ったポップアップ（本番の項目が無い）は、今までどおり配信する。
 *   最初に下書きを保存したときに、保存前の中身を本番として残す（配信は変わらない）。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getJson, postJson, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'
import { getState, setState } from '../mock-server/store/store.ts'

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
  live: { html: string } | null
  publish_status: 'unpublished' | 'changed' | 'published'
}

async function newPage(): Promise<string> {
  const created = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, { title: 'ポップ', media_id: 1 })
  return created.json.ab_test.uid
}

async function lp(abTestUid: string): Promise<string> {
  return (await fetch(`${server.baseUrl}/lp/${abTestUid}`)).text()
}

const exitUrl = (page: string, uid = ''): string => `${server.api}/ab_tests/${page}/exit_popups${uid === '' ? '' : `/${uid}`}`
const followUrl = (page: string, uid = ''): string => `${server.api}/ab_tests/${page}/follow_popups${uid === '' ? '' : `/${uid}`}`

async function addExit(page: string, html: string, extra: Record<string, unknown> = {}): Promise<PopupJson> {
  const res = await postJson<{ exit_popup: PopupJson }>(exitUrl(page), { name: 'P', html, ...extra })
  expect(res.status).toBe(201)
  return res.json.exit_popup
}

async function publishExit(page: string, uid: string): Promise<PopupJson> {
  const res = await postJson<{ exit_popup: PopupJson }>(`${exitUrl(page, uid)}/publish`)
  expect(res.status).toBe(200)
  return res.json.exit_popup
}

describe('離脱防止・表示直後: 下書きと本番', () => {
  it('作ったばかりのポップアップは配信しない（本番反映するまで）', async () => {
    const page = await newPage()
    const created = await addExit(page, '<p>MARK-NEW</p>')
    expect(created.live).toBeNull()
    expect(created.publish_status).toBe('unpublished')
    expect(await lp(page)).not.toContain('MARK-NEW')
  })

  it('本番反映で配信に出る。そのあとの下書き反映は配信に出ない。もう一度本番反映すると出る', async () => {
    const page = await newPage()
    const created = await addExit(page, '<p>MARK-1</p>')
    const published = await publishExit(page, created.uid)
    expect(published.publish_status).toBe('published')
    expect(await lp(page)).toContain('MARK-1')

    const draft = await sendJson<{ exit_popup: PopupJson }>('PUT', exitUrl(page, created.uid), { html: '<p>MARK-2</p>' })
    expect(draft.json.exit_popup.publish_status).toBe('changed')
    expect(draft.json.exit_popup.live?.html).toBe('<p>MARK-1</p>')
    const html = await lp(page)
    expect(html).toContain('MARK-1')
    expect(html).not.toContain('MARK-2')

    await publishExit(page, created.uid)
    const after = await lp(page)
    expect(after).toContain('MARK-2')
    expect(after).not.toContain('MARK-1')
  })

  it('配信をOFFにしたポップアップは、本番反映してあっても配信しない', async () => {
    const page = await newPage()
    const created = await addExit(page, '<p>MARK-OFF</p>')
    await publishExit(page, created.uid)
    await sendJson('PUT', exitUrl(page, created.uid), { enabled: false })
    expect(await lp(page)).not.toContain('MARK-OFF')
  })

  it('この仕組みより前に作ったポップアップ（本番の項目が無い）は今までどおり配信し、下書きを保存しても配信は変わらない', async () => {
    const page = await newPage()
    const created = await addExit(page, '<p>MARK-OLD</p>')
    // 保存データの形にする（live という項目そのものが無い）
    setState((s) => ({
      ...s,
      exitPopups: s.exitPopups.map((p) => {
        if (p.uid !== created.uid) return p
        const { live: _live, ...legacy } = p
        return legacy
      }),
    }))
    expect('live' in (getState().exitPopups[0] ?? {})).toBe(false)
    expect(await lp(page)).toContain('MARK-OLD')

    const list = await getJson<{ exit_popups: PopupJson[] }>(exitUrl(page))
    expect(list.exit_popups[0]?.publish_status).toBe('published')

    await sendJson('PUT', exitUrl(page, created.uid), { html: '<p>MARK-EDIT</p>' })
    const html = await lp(page)
    expect(html).toContain('MARK-OLD')
    expect(html).not.toContain('MARK-EDIT')
    // 保存前の中身が本番として残る（足すだけ）
    expect(getState().exitPopups[0]?.live?.html).toBe('<p>MARK-OLD</p>')

    await publishExit(page, created.uid)
    expect(await lp(page)).toContain('MARK-EDIT')
  })

  it('本番反映のあと、プレビュー（検証用URL）も本番の中身を出す', async () => {
    const created = await postJson<{ ab_test: { uid: string }; version: { uid: string } }>(`${server.api}/ab_tests`, { title: 'P', media_id: 1 })
    const page = created.json.ab_test.uid
    const popup = await addExit(page, '<p>MARK-PV1</p>')
    const preview = async (): Promise<string> => (await fetch(`${server.baseUrl}/preview/${created.json.version.uid}`)).text()
    expect(await preview()).not.toContain('MARK-PV1')
    await publishExit(page, popup.uid)
    await sendJson('PUT', exitUrl(page, popup.uid), { html: '<p>MARK-PV2</p>' })
    const html = await preview()
    expect(html).toContain('MARK-PV1')
    expect(html).not.toContain('MARK-PV2')
  })

  it('下書きを確認（?popup_draft=）は、そのポップアップの下書きを出す（未公開・配信OFFでも）', async () => {
    const created = await postJson<{ ab_test: { uid: string }; version: { uid: string } }>(`${server.api}/ab_tests`, { title: 'P', media_id: 1 })
    const page = created.json.ab_test.uid
    const popup = await addExit(page, '<p>MARK-DRAFT</p>')
    await sendJson('PUT', exitUrl(page, popup.uid), { enabled: false })
    const html = await (await fetch(`${server.baseUrl}/preview/${created.json.version.uid}?popup_draft=${popup.uid}`)).text()
    expect(html).toContain('MARK-DRAFT')
    expect(html).toContain('このLPは検証用です')
  })

  it('作るときの割合: その種類の1つ目は100%、2つ目からは0%（種類ごと）', async () => {
    const page = await newPage()
    expect((await addExit(page, '<p>a</p>')).ratio).toBe(100)
    expect((await addExit(page, '<p>b</p>')).ratio).toBe(0)
    expect((await addExit(page, '<p>c</p>', { popup_kind: 'instant' })).ratio).toBe(100)
  })

  it('複製は下書きの中身を写した別のポップアップを作り、本番反映するまで配信しない', async () => {
    const page = await newPage()
    const source = await addExit(page, '<p>MARK-SRC</p>')
    await publishExit(page, source.uid)
    await sendJson('PUT', exitUrl(page, source.uid), { html: '<p>MARK-SRC-DRAFT</p>' })
    const copied = await postJson<{ exit_popup: PopupJson & { name: string; popup_kind: string } }>(
      `${exitUrl(page, source.uid)}/duplicate`,
      { popup_kind: 'instant' },
    )
    expect(copied.status).toBe(201)
    expect(copied.json.exit_popup.uid).not.toBe(source.uid)
    expect(copied.json.exit_popup.html).toBe('<p>MARK-SRC-DRAFT</p>')
    expect(copied.json.exit_popup.live).toBeNull()
    expect(copied.json.exit_popup.name).toBe('Pのコピー')
    expect(copied.json.exit_popup.popup_kind).toBe('instant')
    expect(await lp(page)).not.toContain('MARK-SRC-DRAFT')
  })
})

describe('追従型: 下書きと本番', () => {
  it('作ったばかりは配信しない・下書き反映は出ない・本番反映で出る', async () => {
    const page = await newPage()
    const created = await postJson<{ follow_popup: PopupJson }>(followUrl(page), { name: 'F', html: '<p>MARK-F1</p>' })
    const uid = created.json.follow_popup.uid
    expect(created.json.follow_popup.publish_status).toBe('unpublished')
    expect(await lp(page)).not.toContain('MARK-F1')

    expect((await postJson(`${followUrl(page, uid)}/publish`)).status).toBe(200)
    expect(await lp(page)).toContain('MARK-F1')

    await sendJson('PUT', followUrl(page, uid), { html: '<p>MARK-F2</p>' })
    expect(await lp(page)).not.toContain('MARK-F2')
    await postJson(`${followUrl(page, uid)}/publish`)
    expect(await lp(page)).toContain('MARK-F2')
  })

  it('この仕組みより前に作った追従型は今までどおり配信する', async () => {
    const page = await newPage()
    const created = await postJson<{ follow_popup: PopupJson }>(followUrl(page), { name: 'F', html: '<p>MARK-FOLD</p>' })
    setState((s) => ({
      ...s,
      followPopups: s.followPopups.map((p) => {
        if (p.uid !== created.json.follow_popup.uid) return p
        const { live: _live, ...legacy } = p
        return legacy
      }),
    }))
    expect(await lp(page)).toContain('MARK-FOLD')
  })

  it('複製できる（本番反映するまで配信しない）', async () => {
    const page = await newPage()
    const created = await postJson<{ follow_popup: PopupJson }>(followUrl(page), { name: 'F', html: '<p>MARK-FC</p>' })
    const copied = await postJson<{ follow_popup: PopupJson & { name: string } }>(`${followUrl(page, created.json.follow_popup.uid)}/duplicate`)
    expect(copied.status).toBe(201)
    expect(copied.json.follow_popup.name).toBe('Fのコピー')
    expect(copied.json.follow_popup.live).toBeNull()
  })
})

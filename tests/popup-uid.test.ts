/**
 * ポップアップ（離脱防止・表示直後・追従型）の uid が重ならないことの機械証明（2026-09-24 監査 5）。
 *
 * 以前は uid を「今ある件数＋1」で作っていた（EXITPOPUP_0001…）。削除のあとに作ると既存と同じ uid が付き、
 * 更新・削除は uid の先頭一致（findIndex）なので、別のポップアップを書き換える・消すことがあった。
 * Version などは 2026-09-11 に直してある（freshUid・uid-repair.ts）。ポップアップも同じ決め方にする。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { postJson, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'
import { createEmptyState } from '../mock-server/store/seed-empty.ts'
import { createAbTest } from '../mock-server/store/actions.ts'
import { repairDuplicateUids } from '../mock-server/store/uid-repair.ts'
import type { ExitPopup, FollowPopup, InspectionEntry, State } from '../mock-server/store/types.ts'

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

async function newPage(): Promise<string> {
  const created = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, { title: 'ポップ', media_id: 1 })
  return created.json.ab_test.uid
}

async function addExit(abTestUid: string, name: string): Promise<string> {
  const res = await postJson<{ exit_popup: { uid: string } }>(`${server.api}/ab_tests/${abTestUid}/exit_popups`, { name })
  expect(res.status).toBe(201)
  return res.json.exit_popup.uid
}

async function addFollow(abTestUid: string, name: string): Promise<string> {
  const res = await postJson<{ follow_popup: { uid: string } }>(`${server.api}/ab_tests/${abTestUid}/follow_popups`, { name })
  expect(res.status).toBe(201)
  return res.json.follow_popup.uid
}

describe('ポップアップを作るときの uid', () => {
  it('離脱防止: 途中の1件を消してから作っても、残っている物・消した物の uid と重ならない', async () => {
    const page = await newPage()
    const first = await addExit(page, 'A')
    const second = await addExit(page, 'B')
    expect((await sendJson('DELETE', `${server.api}/ab_tests/${page}/exit_popups/${first}`)).status).toBe(204)
    const third = await addExit(page, 'C')
    expect(third).not.toBe(second)
    expect(third).not.toBe(first)
    expect(third).toMatch(/^EXITPOPUP_\d{4,}$/)

    // 名前を変えると、変えた物だけが変わる（同じ uid の別物を書き換えない）
    await sendJson('PUT', `${server.api}/ab_tests/${page}/exit_popups/${third}`, { name: 'C2' })
    const list = await (await fetch(`${server.api}/ab_tests/${page}/exit_popups`)).json() as { exit_popups: { uid: string; name: string }[] }
    expect(list.exit_popups.map((p) => [p.uid, p.name])).toEqual([[second, 'B'], [third, 'C2']])
  })

  it('別々のLPで作っても重ならない', async () => {
    const pageA = await newPage()
    const pageB = await newPage()
    const a = await addExit(pageA, 'A')
    await sendJson('DELETE', `${server.api}/ab_tests/${pageA}/exit_popups/${a}`)
    const b1 = await addExit(pageB, 'B1')
    const b2 = await addExit(pageB, 'B2')
    expect(new Set([a, b1, b2]).size).toBe(3)
  })

  it('追従型: 消してから作っても重ならない', async () => {
    const page = await newPage()
    const first = await addFollow(page, 'A')
    const second = await addFollow(page, 'B')
    await sendJson('DELETE', `${server.api}/ab_tests/${page}/follow_popups/${first}`)
    const third = await addFollow(page, 'C')
    expect(new Set([first, second, third]).size).toBe(3)
    expect(third).toMatch(/^FOLLOWPOPUP_\d{4,}$/)
  })
})

/** 保存データにある「同じ uid のポップアップ」を直す */
describe('保存データにある同じ uid のポップアップを直す', () => {
  function base(): State {
    const made = createAbTest(createEmptyState(), { title: 'A', memo: '', media_id: 1, folder_id: null })
    return { ...made.state, nextId: 200 }
  }
  const exitRow = (id: number, uid: string): ExitPopup => ({
    id, uid, ab_test_id: 1, name: `P${id}`, ratio: 0, enabled: true, preset_id: null, visit_count: 'all',
    phone_number: '', link_url: '', link_target: '_blank', tracking_urls: [], animation: 'fade', delay_seconds: 0,
    scroll_trigger: false, scroll_position: 50, countdown_trigger: false, countdown_seconds: 0,
    back_button_trigger: false, exit_trigger: true, position_x: 50, position_y: 50,
    device_sp: true, device_tablet: true, device_pc: true, html: '<p>x</p>', javascript: '', head_tag: '', body_tag: '',
  })
  const followRow = (id: number, uid: string): FollowPopup => ({
    id, uid, ab_test_id: 1, name: `F${id}`, enabled: true, preset_id: null, position: 'bottom', show_after_scroll: 0,
    show_close_button: true, animation: 'slideUp', device_sp: true, device_tablet: true, device_pc: true,
    html: '<p>y</p>', javascript: '', css: '',
  })

  it('一番古い（id が小さい）1件はそのまま、あとから作った方だけ付け直す', () => {
    const before: State = {
      ...base(),
      exitPopups: [exitRow(30, 'EXITPOPUP_0002'), exitRow(10, 'EXITPOPUP_0001'), exitRow(20, 'EXITPOPUP_0002')],
      followPopups: [followRow(11, 'FOLLOWPOPUP_0001'), followRow(12, 'FOLLOWPOPUP_0001')],
    }
    const { state, changes } = repairDuplicateUids(before)
    expect(state.exitPopups.map((p) => [p.id, p.uid])).toEqual([
      [30, 'EXITPOPUP_0200'],
      [10, 'EXITPOPUP_0001'],
      [20, 'EXITPOPUP_0002'],
    ])
    expect(state.followPopups.map((p) => [p.id, p.uid])).toEqual([
      [11, 'FOLLOWPOPUP_0001'],
      [12, 'FOLLOWPOPUP_0201'],
    ])
    expect(changes.map((c) => c.collection)).toEqual(['exitPopups', 'followPopups'])
    // 中身は uid 以外そのまま
    expect(state.exitPopups[0]).toEqual({ ...before.exitPopups[0], uid: 'EXITPOPUP_0200' })
  })

  it('審査の記録（uid で結び付く）は、付け直した方にも同じ記録を足す（残す方の記録は消さない）', () => {
    const entry: InspectionEntry = { kind: 'popup', target_uid: 'EXITPOPUP_0002', status: 'approved', comment: 'OK', updated_at: 5 }
    const versionEntry: InspectionEntry = { kind: 'version', target_uid: 'EXITPOPUP_0002', status: 'rejected', comment: '', updated_at: 6 }
    const before: State = {
      ...base(),
      exitPopups: [exitRow(10, 'EXITPOPUP_0002'), exitRow(20, 'EXITPOPUP_0002')],
      inspectionEntries: [entry, versionEntry],
    }
    const { state } = repairDuplicateUids(before)
    expect(state.inspectionEntries).toEqual([entry, versionEntry, { ...entry, target_uid: 'EXITPOPUP_0200' }])
    // 2回目は何も変えない（同じ state をそのまま返す）
    expect(repairDuplicateUids(state).state).toBe(state)
  })
})

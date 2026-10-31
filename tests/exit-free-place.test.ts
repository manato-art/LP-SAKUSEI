/**
 * 離脱防止・表示直後のポップアップも、つまんで好きな場所に置ける（指示39・2026-10-31 本人「ポップアップの表示位置なんだけど、
 * 実際にLPの中を自由に移動して決めたい」→ 本人の選択「つまんで好きな位置（追従型と同じやり方・スマホとPCで同じ位置）」）。
 *
 * 置いた場所は追従型と同じ形（画面の中で動ける幅の何％か・src/shared/follow-free-place.ts の 'corner'＝端から16px）。
 * 置いた場所があれば、9か所（上中下×左中右）ではなくそこに出す。9か所を選ぶと置いた場所は消える（画面側）。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildPopupSnippet } from '../mock-server/routes/delivery-popup-html.ts'
import type { ExitPopup } from '../mock-server/store/types.ts'
import { getJson, postJson, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'

const base = {
  id: 1, uid: 'EXITPOPUP_0001', ab_test_id: 1, name: 'P', ratio: 100, enabled: true, preset_id: null,
  visit_count: 'all', phone_number: '', link_url: '', link_target: '_blank', tracking_urls: [],
  animation: 'fade', delay_seconds: 0, scroll_trigger: false, scroll_position: 50,
  countdown_trigger: false, countdown_seconds: 0, back_button_trigger: false, exit_trigger: true,
  position_x: 50, position_y: 50, device_sp: true, device_tablet: true, device_pc: true,
  html: '<p>中身</p>', javascript: '', head_tag: '', body_tag: '', popup_kind: 'exit', link_action: 'link',
} as unknown as ExitPopup

describe('配信のポップアップの置き場所', () => {
  it('置いた場所があれば、暗い幕の中のその場所に出す（端から16px・スマホとPCで同じ割合）', () => {
    const html = buildPopupSnippet({ ...base, free_position: { x: 20, y: 70 } }, 'sp')
    expect(html).toContain('class="ep-content fade" style="position:absolute;top:calc(16px + (100% - 32px) * 0.7);left:calc(16px + (100% - 32px) * 0.2);translate:-20% -70%"')
  })

  it('置いた場所が無ければ、今までどおり9か所の置き方', () => {
    const html = buildPopupSnippet(base, 'sp')
    expect(html).toContain('justify-content:center;align-items:center')
    expect(html).toContain('class="ep-content fade">')
  })
})

describe('保存', () => {
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
    exit_popup: { uid: string; free_position: { x: number; y: number } | null }
  }

  const setup = async (): Promise<string> => {
    const page = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, { title: '置き場所', media_id: 1 })
    const created = await postJson<PopupJson>(`${server.api}/ab_tests/${page.json.ab_test.uid}/exit_popups`, { name: 'P' })
    expect(created.json.exit_popup.free_position).toBeNull()
    return `${server.api}/ab_tests/${page.json.ab_test.uid}/exit_popups/${created.json.exit_popup.uid}`
  }

  it('置いた場所を保存でき、null で消せる', async () => {
    const url = await setup()
    const saved = await sendJson<PopupJson>('PUT', url, { free_position: { x: 20, y: 70.04 } })
    expect(saved.json.exit_popup.free_position).toEqual({ x: 20, y: 70 })
    const cleared = await sendJson<PopupJson>('PUT', url, { free_position: null })
    expect(cleared.json.exit_popup.free_position).toBeNull()
  })

  it('おかしな値は断り、保存してある場所は変えない', async () => {
    const url = await setup()
    await sendJson('PUT', url, { free_position: { x: 20, y: 70 } })
    expect((await sendJson('PUT', url, { free_position: { x: 'left', y: 0 } })).status).toBe(422)
    const list = await getJson<{ exit_popups: { free_position: unknown }[] }>(url.replace(/\/[^/]+$/, ''))
    expect(list.exit_popups[0]?.free_position).toEqual({ x: 20, y: 70 })
  })
})

/**
 * 追従型ポップアップを、つまんで好きな場所へ置く（2026-10-30 本人「表示位置を動かしたい」→「つまんで好きな場所へ」
 * 「スマホとPCで同じ位置」）。
 *
 * 置いた場所は「画面の中で動ける幅の何％か」で覚える（0＝上・左の端、100＝下・右の端）。画面の大きさが違っても、
 * スマホとPCで同じ割合の所に出る。上の帯・下の帯（画面の幅いっぱい）は上下だけ、右下・左下の小さい物は上下左右に動く。
 * 小さい物は今までどおり画面の端から16px あける。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  FREE_EDGE,
  freeBoxPlace,
  freeKindOf,
  freePlaceCss,
  freePositionAt,
  parseFreePosition,
} from '../src/shared/follow-free-place.ts'
import { buildFollowPopupSnippet } from '../mock-server/routes/delivery-popup-html.ts'
import type { FollowPopup } from '../mock-server/store/types.ts'
import { getJson, issueCreatedPage, postJson, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'

const stage = { w: 400, h: 800 }

describe('どの動き方か', () => {
  it('上の帯・下の帯は上下だけ、右下・左下は上下左右', () => {
    expect(freeKindOf('top')).toBe('bar')
    expect(freeKindOf('bottom')).toBe('bar')
    expect(freeKindOf('bottom-right')).toBe('corner')
    expect(freeKindOf('bottom-left')).toBe('corner')
  })
})

describe('置いた場所と、画面の中の位置', () => {
  it('帯: 上下の割合で置き、左右はまん中', () => {
    const box = { w: 400, h: 100 }
    expect(freeBoxPlace('bar', stage, box, { x: 50, y: 0 })).toEqual({ left: 0, top: 0 })
    expect(freeBoxPlace('bar', stage, box, { x: 50, y: 100 })).toEqual({ left: 0, top: 700 })
    expect(freeBoxPlace('bar', stage, box, { x: 50, y: 50 })).toEqual({ left: 0, top: 350 })
    // 編集画面の帯はLPの幅（画面より狭い）＝左右はまん中
    expect(freeBoxPlace('bar', { w: 1000, h: 800 }, { w: 620, h: 100 }, { x: 0, y: 0 }).left).toBe(190)
  })

  it('小さい物: 画面の端から16px あけて、上下左右の割合で置く', () => {
    const box = { w: 100, h: 50 }
    expect(freeBoxPlace('corner', stage, box, { x: 0, y: 0 })).toEqual({ left: FREE_EDGE, top: FREE_EDGE })
    expect(freeBoxPlace('corner', stage, box, { x: 100, y: 100 })).toEqual({ left: 400 - FREE_EDGE - 100, top: 800 - FREE_EDGE - 50 })
  })

  it('つまんで動かした所から、割合に戻せる（行って戻ると同じ）', () => {
    const box = { w: 100, h: 50 }
    const place = { x: 25, y: 75 }
    const at = freeBoxPlace('corner', stage, box, place)
    expect(freePositionAt('corner', stage, box, at)).toEqual(place)
    expect(freePositionAt('bar', stage, { w: 400, h: 100 }, { left: 0, top: 350 })).toEqual({ x: 50, y: 50 })
  })

  it('画面の外まで動かしても、端で止まる', () => {
    const box = { w: 100, h: 50 }
    expect(freePositionAt('corner', stage, box, { left: -500, top: 5000 })).toEqual({ x: 0, y: 100 })
  })

  it('中身が画面より大きいときは、上・左の端に置く', () => {
    expect(freePositionAt('bar', stage, { w: 400, h: 900 }, { left: 0, top: 300 })).toEqual({ x: 50, y: 0 })
    expect(freeBoxPlace('bar', stage, { w: 400, h: 900 }, { x: 50, y: 60 }).top).toBe(0)
  })
})

describe('配信のCSS（画面の大きさが違っても同じ割合の所）', () => {
  it('帯: 幅いっぱいのまま、上から何％か', () => {
    expect(freePlaceCss('bar', { x: 50, y: 30 })).toBe('top:30%;left:0;right:0;translate:0 -30%')
  })

  it('小さい物: 端から16px あけて、上下左右の割合', () => {
    expect(freePlaceCss('corner', { x: 25, y: 75 })).toBe(
      'top:calc(16px + (100% - 32px) * 0.75);left:calc(16px + (100% - 32px) * 0.25);translate:-25% -75%',
    )
  })
})

describe('受け取った値を確かめる', () => {
  it('0〜100 の数を2つ持つ形だけ受ける（小数は1桁まで）', () => {
    expect(parseFreePosition({ x: 12.345, y: 99.96 })).toEqual({ ok: true, value: { x: 12.3, y: 100 } })
    expect(parseFreePosition(null)).toEqual({ ok: true, value: null })
  })

  it('範囲の外・数でない・形が違うものは断る', () => {
    expect(parseFreePosition({ x: -1, y: 10 }).ok).toBe(false)
    expect(parseFreePosition({ x: 10, y: 101 }).ok).toBe(false)
    expect(parseFreePosition({ x: '10', y: 10 }).ok).toBe(false)
    expect(parseFreePosition({ x: Number.NaN, y: 10 }).ok).toBe(false)
    expect(parseFreePosition('top:0').ok).toBe(false)
    expect(parseFreePosition([10, 10]).ok).toBe(false)
  })
})

describe('配信のバナー', () => {
  const base: FollowPopup = {
    id: 1,
    uid: 'FOLLOWPOPUP_0001',
    ab_test_id: 1,
    name: 'ボトムCTAバナー',
    enabled: true,
    preset_id: null,
    position: 'bottom',
    show_after_scroll: 0,
    show_close_button: true,
    animation: 'slideUp',
    device_sp: true,
    device_tablet: true,
    device_pc: true,
    html: '<div>バナー</div>',
    javascript: '',
    css: '',
  }

  it('置いた場所があれば、その場所に出す（下端に固定しない）', () => {
    const html = buildFollowPopupSnippet({ ...base, free_position: { x: 50, y: 40 } }, 'sp')
    expect(html).toContain('top:40%;left:0;right:0;translate:0 -40%')
    expect(html).not.toContain('bottom:0;left:0;right:0')
  })

  it('置いた場所が無ければ、今までどおり選んだ表示位置', () => {
    expect(buildFollowPopupSnippet(base, 'sp')).toContain('bottom:0;left:0;right:0')
  })
})

describe('保存（保存したらすぐ配信・2026-10-31）', () => {
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
    follow_popup: { uid: string; free_position: { x: number; y: number } | null }
  }

  const setup = async () => {
    const page = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, { title: '置き場所', media_id: 1 })
    await issueCreatedPage(server.api, page.json)
    const uid = page.json.ab_test.uid
    const created = await postJson<PopupJson>(`${server.api}/ab_tests/${uid}/follow_popups`, { name: 'バナー' })
    const popupUid = created.json.follow_popup.uid
    const lp = async (): Promise<string> => (await fetch(`${server.baseUrl}/lp/${uid}`)).text()
    return { url: `${server.api}/ab_tests/${uid}/follow_popups/${popupUid}`, created: created.json, lp }
  }

  it('作ったばかりは置いた場所なし', async () => {
    const { created } = await setup()
    expect(created.follow_popup.free_position).toBeNull()
  })

  it('置いた場所を保存すると、すぐ配信のバナーがその場所に出る', async () => {
    const { url, lp } = await setup()
    const res = await sendJson<PopupJson>('PUT', url, { free_position: { x: 50, y: 35.04 } })
    expect(res.status).toBe(200)
    expect(res.json.follow_popup.free_position).toEqual({ x: 50, y: 35 })
    expect(await lp()).toContain('top:35%;left:0;right:0;translate:0 -35%')
  })

  it('null を送ると置いた場所を消す（選んだ表示位置に戻る）', async () => {
    const { url, lp } = await setup()
    await sendJson('PUT', url, { free_position: { x: 50, y: 35 } })
    const cleared = await sendJson<PopupJson>('PUT', url, { free_position: null })
    expect(cleared.json.follow_popup.free_position).toBeNull()
    const html = await lp()
    expect(html).not.toContain('translate:0 -35%')
    expect(html).toContain('bottom:0;left:0;right:0')
  })

  it('おかしな値は断り、保存してある場所は変えない', async () => {
    const { url } = await setup()
    await sendJson('PUT', url, { free_position: { x: 50, y: 35 } })
    const bad = await sendJson('PUT', url, { free_position: { x: 50, y: 'top:0;' } })
    expect(bad.status).toBe(422)
    const list = await getJson<{ follow_popups: { free_position: unknown }[] }>(url.replace(/\/[^/]+$/, ''))
    expect(list.follow_popups[0]?.free_position).toEqual({ x: 50, y: 35 })
  })
})

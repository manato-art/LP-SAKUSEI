/**
 * 編集画面に出ているポップアップの設定が、配信で効くことの機械証明（2026-09-24 監査 26）。
 *
 * - 割合: 1回の表示で出すのは、種類（離脱防止／表示直後）ごとに1つだけ。割合の重みで選ぶ。
 *   0% は出さない。同じ種類がすべて 0% でも出さない（2026-09-24 本人「0%ってやってんだから出さないで」）。
 * - 訪問回数: 全て／初回のみ／2回目以降／3回目以降。LP ごとの訪問回数を Cookie で数える（同じブラウザを閉じるまでは1回）。
 * - このVersionで配信: Version ごとに OFF にでき、OFF の Version を配信するときはポップアップを出さない。
 * - 位置（9か所）・渦巻アニメ・電話をかける・表示のきっかけ（スクロール／カウントダウン／バックボタン／離脱）。
 */
import { runInNewContext } from 'node:vm'
import { parseHTML } from 'linkedom'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getJson, postJson, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'
import { matchesVisitCount, pickPopupsForView } from '../mock-server/routes/delivery-popups.ts'
import { buildPopupSnippet } from '../mock-server/routes/delivery-popup-html.ts'
import type { ExitPopup } from '../mock-server/store/types.ts'

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

function popup(over: Partial<ExitPopup>): ExitPopup {
  return {
    id: 1, uid: 'EXITPOPUP_0001', ab_test_id: 1, name: 'P', ratio: 0, enabled: true, preset_id: null,
    visit_count: 'all', phone_number: '', link_url: '', link_target: '_blank', tracking_urls: [],
    animation: 'fade', delay_seconds: 0, scroll_trigger: false, scroll_position: 50,
    countdown_trigger: false, countdown_seconds: 0, back_button_trigger: false, exit_trigger: true,
    position_x: 50, position_y: 50, device_sp: true, device_tablet: true, device_pc: true,
    html: '<p>x</p>', javascript: '', head_tag: '', body_tag: '', popup_kind: 'exit', link_action: 'link',
    ...over,
  }
}

describe('割合と訪問回数で、1回の表示に出すポップアップを選ぶ（純粋関数）', () => {
  const a = popup({ uid: 'A', ratio: 70 })
  const b = popup({ uid: 'B', ratio: 30 })
  const zero = popup({ uid: 'Z', ratio: 0 })
  const instant = popup({ uid: 'I', ratio: 100, popup_kind: 'instant' })

  it('種類ごとに1つだけ、割合の重みで選ぶ（0%は出さない）', () => {
    expect(pickPopupsForView([a, b, zero], null, () => 0).map((p) => p.uid)).toEqual(['A'])
    expect(pickPopupsForView([a, b, zero], null, () => 0.69).map((p) => p.uid)).toEqual(['A'])
    expect(pickPopupsForView([a, b, zero], null, () => 0.71).map((p) => p.uid)).toEqual(['B'])
    expect(pickPopupsForView([a, b, zero], null, () => 0.999).map((p) => p.uid)).toEqual(['B'])
  })

  it('同じ種類がすべて0%なら、どれも出さない（0%は「出さない」）', () => {
    const z2 = popup({ uid: 'Z2', ratio: 0 })
    expect(pickPopupsForView([zero, z2], null, () => 0.2)).toEqual([])
    expect(pickPopupsForView([zero], null, () => 0.7)).toEqual([])
  })

  it('離脱防止と表示直後は別々に1つずつ選ぶ', () => {
    expect(pickPopupsForView([a, instant], null, () => 0.5).map((p) => p.uid)).toEqual(['A', 'I'])
  })

  it('訪問回数が合わないポップアップは候補から外してから選ぶ', () => {
    const first = popup({ uid: 'F', ratio: 100, visit_count: 'first' })
    const second = popup({ uid: 'S', ratio: 100, visit_count: '2+' })
    expect(pickPopupsForView([first, second], 1, () => 0.5).map((p) => p.uid)).toEqual(['F'])
    expect(pickPopupsForView([first, second], 2, () => 0.5).map((p) => p.uid)).toEqual(['S'])
  })

  it('訪問回数の判定', () => {
    expect(matchesVisitCount('all', 1)).toBe(true)
    expect(matchesVisitCount('first', 1)).toBe(true)
    expect(matchesVisitCount('first', 2)).toBe(false)
    expect(matchesVisitCount('2+', 1)).toBe(false)
    expect(matchesVisitCount('2+', 2)).toBe(true)
    expect(matchesVisitCount('3+', 2)).toBe(false)
    expect(matchesVisitCount('3+', 5)).toBe(true)
  })
})

interface Page {
  abTestUid: string
  versionUid: string
}

async function newPage(): Promise<Page> {
  const created = await postJson<{ ab_test: { uid: string }; version: { uid: string } }>(`${server.api}/ab_tests`, { title: 'P', media_id: 1 })
  return { abTestUid: created.json.ab_test.uid, versionUid: created.json.version.uid }
}

async function addPublished(page: Page, body: Record<string, unknown>): Promise<string> {
  const created = await postJson<{ exit_popup: { uid: string } }>(`${server.api}/ab_tests/${page.abTestUid}/exit_popups`, { name: 'P', ...body })
  const uid = created.json.exit_popup.uid
  if (typeof body['ratio'] === 'number') {
    await sendJson('PUT', `${server.api}/ab_tests/${page.abTestUid}/exit_popups/${uid}`, { ratio: body['ratio'] })
  }
  await postJson(`${server.api}/ab_tests/${page.abTestUid}/exit_popups/${uid}/publish`)
  return uid
}

async function open(page: Page, cookie = ''): Promise<{ html: string; cookies: string[] }> {
  const res = await fetch(`${server.baseUrl}/lp/${page.abTestUid}`, { headers: cookie === '' ? {} : { cookie } })
  return { html: await res.text(), cookies: res.headers.getSetCookie() }
}

describe('配信で効く（LPを開く）', () => {
  it('割合100%と0%なら、何回開いても100%の方だけ・1回に1つだけ', async () => {
    const page = await newPage()
    await addPublished(page, { html: '<p>MARK-A</p>', ratio: 100 })
    await addPublished(page, { html: '<p>MARK-B</p>' })
    for (let i = 0; i < 15; i += 1) {
      const { html } = await open(page)
      expect(html).toContain('MARK-A')
      expect(html).not.toContain('MARK-B')
      expect(html.match(/class="ep-overlay"/g) ?? []).toHaveLength(1)
    }
  }, 20000)

  it('訪問回数: 初めて開いたら「初回のみ」、Cookie の回数が1なら次は「2回目以降」', async () => {
    const page = await newPage()
    await addPublished(page, { html: '<p>MARK-FIRST</p>', visit_count: 'first' })
    // 2つなら合計100%に保たれる（片方を50にするともう片方も50）。0%は出さないので、どちらも1以上にする
    await addPublished(page, { html: '<p>MARK-AGAIN</p>', visit_count: '2+', ratio: 50 })

    const first = await open(page)
    expect(first.html).toContain('MARK-FIRST')
    expect(first.html).not.toContain('MARK-AGAIN')
    expect(first.cookies.some((c) => c.startsWith(`_sb_pv_${page.abTestUid}=1;`))).toBe(true)
    expect(first.cookies.some((c) => c.startsWith(`_sb_ps_${page.abTestUid}=1;`))).toBe(true)

    // 同じブラウザを開いたまま（ps あり）は数えない
    const same = await open(page, `_sb_pv_${page.abTestUid}=1; _sb_ps_${page.abTestUid}=1`)
    expect(same.html).toContain('MARK-FIRST')

    // ブラウザを閉じてまた来た（ps なし）＝2回目
    const again = await open(page, `_sb_pv_${page.abTestUid}=1`)
    expect(again.html).toContain('MARK-AGAIN')
    expect(again.html).not.toContain('MARK-FIRST')
    expect(again.cookies.some((c) => c.startsWith(`_sb_pv_${page.abTestUid}=2;`))).toBe(true)
  }, 20000)

  it('このVersionで配信: OFF の Version を配信するときはポップアップ（追従型も）を出さない・設定は残る', async () => {
    const page = await newPage()
    await addPublished(page, { html: '<p>MARK-EXIT</p>' })
    const follow = await postJson<{ follow_popup: { uid: string } }>(`${server.api}/ab_tests/${page.abTestUid}/follow_popups`, { name: 'F', html: '<p>MARK-FOLLOW</p>' })
    await postJson(`${server.api}/ab_tests/${page.abTestUid}/follow_popups/${follow.json.follow_popup.uid}/publish`)
    expect((await open(page)).html).toContain('MARK-FOLLOW')

    const off = await sendJson<{ version: { uid: string; popup_delivery: boolean } }>(
      'PUT',
      `${server.api}/ab_tests/${page.abTestUid}/popup_delivery/${page.versionUid}`,
      { enabled: false },
    )
    expect(off.status).toBe(200)
    expect(off.json.version.popup_delivery).toBe(false)
    const listed = await getJson<{ versions: { uid: string; popup_delivery: boolean }[] }>(`${server.api}/ab_tests/${page.abTestUid}/popup_delivery`)
    expect(listed.versions).toEqual([expect.objectContaining({ uid: page.versionUid, popup_delivery: false })])

    const html = (await open(page)).html
    expect(html).not.toContain('MARK-EXIT')
    expect(html).not.toContain('MARK-FOLLOW')

    await sendJson('PUT', `${server.api}/ab_tests/${page.abTestUid}/popup_delivery/${page.versionUid}`, { enabled: true })
    expect((await open(page)).html).toContain('MARK-EXIT')
  }, 20000)

  it('このVersionで配信: 別のLPの Version は変えられない', async () => {
    const page = await newPage()
    const other = await newPage()
    const res = await sendJson('PUT', `${server.api}/ab_tests/${page.abTestUid}/popup_delivery/${other.versionUid}`, { enabled: false })
    expect(res.status).toBe(404)
  })
})

describe('位置・アニメ・電話', () => {
  it('位置（9か所）: 左下なら左に寄せて下に置く。中央は今までどおり真ん中', () => {
    expect(buildPopupSnippet(popup({ position_x: 0, position_y: 100 }), 'pc')).toMatch(/class="ep-overlay" style="justify-content:flex-start;align-items:flex-end"/)
    expect(buildPopupSnippet(popup({ position_x: 100, position_y: 0 }), 'pc')).toMatch(/style="justify-content:flex-end;align-items:flex-start"/)
    expect(buildPopupSnippet(popup({}), 'pc')).toMatch(/style="justify-content:center;align-items:center"/)
  })

  it('渦巻（spiral）のアニメがある', () => {
    const snippet = buildPopupSnippet(popup({ animation: 'spiral' }), 'pc')
    expect(snippet).toContain('@keyframes epSpiral')
    expect(snippet).toContain('.ep-content.spiral')
    expect(snippet).toContain('class="ep-content spiral"')
  })
})

/** 配信のポップアップのスクリプトを、作り物のブラウザで動かす */
function run(p: ExitPopup): {
  overlay: () => boolean
  tick: (ms: number) => void
  scrollTo: (y: number) => void
  popstate: () => void
  mouseLeaveTop: () => void
  click: (selector: string) => void
  pushed: () => number
  backs: () => number
  href: () => string
} {
  const snippet = buildPopupSnippet(p, 'pc')
  const script = /<script>([\s\S]*)<\/script>$/.exec(snippet)?.[1] ?? ''
  const { window, document } = parseHTML(`<!doctype html><html><body><div style="height:3000px"></div>${snippet.replace(/<script>[\s\S]*<\/script>$/, '')}</body></html>`)
  Object.defineProperty(document.documentElement, 'scrollHeight', { value: 3000 })
  Object.defineProperty(document.body, 'scrollHeight', { value: 3000 })
  let now = 0
  let timers: { at: number; fn: () => void }[] = []
  const winListeners: Record<string, (() => void)[]> = {}
  const state = { pushed: 0, backs: 0, href: '' }
  const win = {
    scrollY: 0,
    innerHeight: 1000,
    addEventListener: (type: string, fn: () => void) => {
      winListeners[type] = [...(winListeners[type] ?? []), fn]
    },
  }
  runInNewContext(script, {
    window: win,
    document,
    history: { pushState: () => { state.pushed += 1 }, back: () => { state.backs += 1 } },
    location: { set href(v: string) { state.href = v }, get href() { return state.href } },
    navigator: {},
    CustomEvent: window.CustomEvent,
    setTimeout: (fn: () => void, ms: number) => { timers = [...timers, { at: now + ms, fn }] },
  })
  const fire = (type: string): void => {
    for (const fn of winListeners[type] ?? []) fn()
  }
  const overlayEl = (): Element => document.querySelector('.ep-overlay') as Element
  return {
    overlay: () => overlayEl().classList.contains('visible'),
    tick: (ms) => {
      now += ms
      const due = timers.filter((t) => t.at <= now)
      timers = timers.filter((t) => t.at > now)
      for (const t of due) t.fn()
    },
    scrollTo: (y) => {
      win.scrollY = y
      fire('scroll')
    },
    popstate: () => fire('popstate'),
    mouseLeaveTop: () => {
      const e = new window.Event('mouseout')
      Object.defineProperty(e, 'clientY', { value: 0 })
      Object.defineProperty(e, 'relatedTarget', { value: null })
      document.dispatchEvent(e)
    },
    click: (selector) => {
      const target = document.querySelector(selector) as Element
      target.dispatchEvent(new window.Event('click', { bubbles: true }))
    },
    pushed: () => state.pushed,
    backs: () => state.backs,
    href: () => state.href,
  }
}

describe('表示のきっかけ（配信のスクリプトを動かして確かめる）', () => {
  it('スクロールで表示: 指定の位置まで下げたら出る', () => {
    const page = run(popup({ scroll_trigger: true, scroll_position: 50, exit_trigger: false }))
    page.scrollTo(500) // 500 / (3000-1000) = 25%
    expect(page.overlay()).toBe(false)
    page.scrollTo(1000) // 50%
    expect(page.overlay()).toBe(true)
  })

  it('スクロールで表示 0%: 開いた時点で出る', () => {
    const page = run(popup({ scroll_trigger: true, scroll_position: 0, exit_trigger: false }))
    expect(page.overlay()).toBe(true)
  })

  it('カウントダウンで表示: 指定の秒数がたったら出る', () => {
    const page = run(popup({ countdown_trigger: true, countdown_seconds: 3, exit_trigger: false }))
    page.tick(2999)
    expect(page.overlay()).toBe(false)
    page.tick(1)
    expect(page.overlay()).toBe(true)
  })

  it('バックボタンで表示: 1回目の戻るで出す。2回目の戻るは本当に戻す', () => {
    const page = run(popup({ back_button_trigger: true, exit_trigger: false }))
    expect(page.pushed()).toBe(1)
    page.popstate()
    expect(page.overlay()).toBe(true)
    page.popstate()
    expect(page.backs()).toBe(1)
  })

  it('バックボタンも離脱もOFFなら、戻るを捕まえない', () => {
    const page = run(popup({ back_button_trigger: false, exit_trigger: false }))
    expect(page.pushed()).toBe(0)
  })

  it('離脱で表示: 秒数のあと、カーソルが画面の上へ抜けたら出る', () => {
    const page = run(popup({ exit_trigger: true, delay_seconds: 2 }))
    page.mouseLeaveTop()
    expect(page.overlay()).toBe(false)
    page.tick(2000)
    page.mouseLeaveTop()
    expect(page.overlay()).toBe(true)
  })

  it('表示直後: 秒数のあとに出る', () => {
    const page = run(popup({ popup_kind: 'instant', delay_seconds: 2 }))
    page.tick(1999)
    expect(page.overlay()).toBe(false)
    page.tick(1)
    expect(page.overlay()).toBe(true)
  })

  it('電話をかける: 中身を押すと電話番号へ（数字と + だけにする）', () => {
    const page = run(popup({ popup_kind: 'instant', link_action: 'tel', phone_number: '03-1234-5678' }))
    page.click('.ep-content p')
    expect(page.href()).toBe('tel:0312345678')
  })
})

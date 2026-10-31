/**
 * ポップアップに「移行先URL」を入れられるようにする（指示44・2026-10-31 本人「画像で入れたポップアップなんだけど、URLを
 * 入れることができない。あと、編集画面もそうなんだけど、2枚目の表示設定でも移行先URLを設定できるようにしてほしい。
 * これは3種類全部。てか、今後も全部に対して」）。
 *
 *  - 「中身を編集」で画像（動画も）を選ぶと「リンク先」を入れられる。住所は画像そのものに書く（data-link-url・
 *    LP の画像と同じ。配信で画像をリンクで包む＝delivery-image-links.ts。ポップの中の画像にも効く）
 *  - 追従型にも「移行先URL」（帯のどこを押してもそこへ移る・新しいタブ・計測は離脱防止と同じ）。離脱防止・表示直後は「基本」のタブ
 */
import { parseHTML } from 'linkedom'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { sampleSlots, type SlotNode } from '../src/app/panels/nocode/sample-model.ts'
import { editSample } from '../src/app/panels/nocode/sample-dom.ts'
import { buildFollowPopupSnippet } from '../mock-server/routes/delivery-popup-html.ts'
import type { FollowPopup } from '../mock-server/store/types.ts'
import { getJson, postJson, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'

const URL_A = 'https://shop.example.test/buy'

const root = (html: string): SlotNode =>
  parseHTML(`<!doctype html><html><body><div id="r">${html}</div></body></html>`).document.getElementById('r') as unknown as SlotNode

describe('「中身を編集」の画像のリンク先', () => {
  beforeAll(() => {
    // editSample はブラウザの DOMParser・Element を使う（テストは linkedom のものを置く）
    const dom = parseHTML('<!doctype html><html></html>')
    const g = globalThis as unknown as Record<string, unknown>
    g['DOMParser'] = dom.DOMParser
    g['Element'] = dom.Element
    g['Text'] = dom.Text
  })

  it('画像の部品は、いまのリンク先と「新しいタブで開く」を持つ', () => {
    const slots = sampleSlots(root(`<img src="a.png" data-link-url="${URL_A}"><img src="b.png" data-link-url="${URL_A}" data-link-target="_self"><img src="c.png">`), [])
    const images = slots.filter((slot) => slot.kind === 'image')
    expect(images.map((slot) => (slot.kind === 'image' ? [slot.link, slot.newTab] : null))).toEqual([
      [URL_A, true],
      [URL_A, false],
      ['', true],
    ])
  })

  it('リンク先を入れると画像に住所を書き、空にすると外す。開けない住所は入れない', () => {
    const html = '<p>見出し</p><img src="a.png">'
    const id = sampleSlots(root(html), []).find((slot) => slot.kind === 'image')?.id ?? ''
    const linked = editSample(html, id, { kind: 'imageLink', value: URL_A, newTab: false })
    expect(linked).toContain(`data-link-url="${URL_A}"`)
    expect(linked).toContain('data-link-target="_self"')
    const cleared = editSample(linked, id, { kind: 'imageLink', value: '', newTab: true })
    expect(cleared).not.toContain('data-link-url')
    expect(cleared).not.toContain('data-link-target')
    expect(editSample(html, id, { kind: 'imageLink', value: 'javascript:alert(1)', newTab: true })).toBe(html)
  })
})

describe('追従型の移行先URL（配信）', () => {
  const base = {
    id: 1, uid: 'FOLLOWPOPUP_0001', ab_test_id: 1, name: 'F', enabled: true, preset_id: null, position: 'bottom',
    show_after_scroll: 0, show_close_button: true, animation: 'slideUp', device_sp: true, device_tablet: true, device_pc: true,
    html: '<div>帯</div>', javascript: '', css: '',
  } as FollowPopup

  it('移行先URLがあれば、帯のどこを押してもそこへ移る（×・中の本物のリンク・ボタンはそれぞれの動き・仮のリンク＝# は帯の移行先へ）', () => {
    const html = buildFollowPopupSnippet({ ...base, link_url: URL_A, link_target: '_self' }, 'sp')
    expect(html).toContain(`var fpLink=${JSON.stringify(URL_A)}`)
    expect(html).toContain('var fpTarget="_self"')
    expect(html).toContain("if(h&&h!=='#'&&!/^javascript:/i.test(h))return;")
    expect(html).toContain("closest('.fp-close,button,[data-nc-go]')")
  })

  it('移行先URLが無ければ、押しても何もしない（今までどおり）', () => {
    expect(buildFollowPopupSnippet(base, 'sp')).not.toContain('fpLink')
  })
})

describe('追従型の移行先URL（保存）', () => {
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
    follow_popup: { uid: string; link_url: string; link_target: string }
  }

  const setup = async (): Promise<{ url: string; created: PopupJson }> => {
    const page = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, { title: 'リンク', media_id: 1 })
    const created = await postJson<PopupJson>(`${server.api}/ab_tests/${page.json.ab_test.uid}/follow_popups`, { name: 'F' })
    return { url: `${server.api}/ab_tests/${page.json.ab_test.uid}/follow_popups/${created.json.follow_popup.uid}`, created: created.json }
  }

  it('作ったばかりは移行先URLなし・新しいタブ', async () => {
    const { created } = await setup()
    expect(created.follow_popup).toMatchObject({ link_url: '', link_target: '_blank' })
  })

  it('移行先URLと開き方を保存できる', async () => {
    const { url } = await setup()
    const saved = await sendJson<PopupJson>('PUT', url, { link_url: URL_A, link_target: '_self' })
    expect(saved.json.follow_popup).toMatchObject({ link_url: URL_A, link_target: '_self' })
  })

  it('開けない住所は断り、保存してある住所は変えない', async () => {
    const { url } = await setup()
    await sendJson('PUT', url, { link_url: URL_A })
    expect((await sendJson('PUT', url, { link_url: 'javascript:alert(1)' })).status).toBe(422)
    const list = await getJson<{ follow_popups: { link_url: string }[] }>(url.replace(/\/[^/]+$/, ''))
    expect(list.follow_popups[0]?.link_url).toBe(URL_A)
  })
})

/**
 * LPごとの住所（2026-10-30 本人「フォルダベースで決めなくていい。何もしない時は c1page.com/lp/… って感じ。
 * 基本情報から https:// と .c1page.com の間を自由に決めることができる。この先作成するLPに反映させていく」）。
 *
 *   - これから作る・複製するLPは、何もしなければ土台そのもの（c1page.com）で出る
 *   - 基本情報で頭の名前を決めると <名前>.c1page.com に変わる（空に戻せば c1page.com）
 *   - それより前のLPは今までどおり（フォルダのドメイン）＝配信中の広告のURLを変えない
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { addressChangeNote, canRegisterAddress, editableAddressLabel } from '../src/app/pages/basic-info-address.ts'
import { buildUpdatePayload, deliveryUrlFor, validateBasicInfo, type AbTestForEdit } from '../src/app/pages/basic-info-form.ts'
import {
  effectiveDeliveryDomain,
  labelOfPageDomain,
  pageDomainFromLabel,
  pageDomainLabelError,
} from '../src/shared/page-delivery-domain.ts'
import { postJson, requestWithHost, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'

const BASE = 'c1-news.test'

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

interface PageJson {
  ab_test: { uid: string; delivery_domain: string }
  error?: { message: string }
}

async function createFolder(name: string): Promise<{ id: number; uid: string }> {
  return (await postJson<{ folder: { id: number; uid: string } }>(`${server.api}/folders`, { name })).json.folder
}

async function createPage(folderId: number | null): Promise<PageJson['ab_test']> {
  const res = await postJson<PageJson>(`${server.api}/ab_tests`, { title: 'めぐりのページ', media_id: 1, folder_id: folderId })
  return res.json.ab_test
}

const setBase = (base: string) => sendJson('PUT', `${server.api}/teams/quick_domain`, { base })
const setLabel = (uid: string, label: string) =>
  sendJson<PageJson>('PUT', `${server.api}/ab_tests/${uid}`, { delivery_label: label })
const openOn = async (uid: string, host: string) =>
  (await requestWithHost('GET', `${server.baseUrl}/lp/${uid}`, { host })).status

describe('住所の決まり（画面とサーバーで同じ）', () => {
  it('頭の名前が空なら土台そのもの、入れれば <名前>.<土台>（大文字は小文字にそろえる）', () => {
    expect(pageDomainFromLabel('', BASE)).toBe(BASE)
    expect(pageDomainFromLabel('Meguri', BASE)).toBe(`meguri.${BASE}`)
  })

  it('住所から頭の名前を取り出せる（土台そのものなら空）', () => {
    expect(labelOfPageDomain(BASE, BASE)).toBe('')
    expect(labelOfPageDomain(`meguri.${BASE}`, BASE)).toBe('meguri')
    expect(labelOfPageDomain('other.example.test', BASE)).toBeNull()
  })

  it('空はよい。形がおかしい名前は理由を返す', () => {
    expect(pageDomainLabelError('')).toBeNull()
    expect(pageDomainLabelError('meguri')).toBeNull()
    expect(pageDomainLabelError('めぐり')).toContain('英字')
  })

  it('配信URLは、ページ自身の住所があればそれ、無ければフォルダのドメイン', () => {
    const origin = 'https://lp.example.test'
    expect(deliveryUrlFor(effectiveDeliveryDomain(BASE, 'kanaya.example.test'), origin, 'P1')).toBe(`https://${BASE}/lp/P1`)
    expect(deliveryUrlFor(effectiveDeliveryDomain('', 'kanaya.example.test'), origin, 'P1')).toBe('https://kanaya.example.test/lp/P1')
    expect(deliveryUrlFor(effectiveDeliveryDomain(undefined, undefined), origin, 'P1')).toBeNull()
  })
})

describe('これから作るLP', () => {
  beforeEach(async () => {
    await setBase(BASE)
  })

  it('何もしなければ、土台そのもの（c1page.com）で出る', async () => {
    const page = await createPage((await createFolder('めぐり')).id)
    expect(page.delivery_domain).toBe(BASE)
    expect(await openOn(page.uid, BASE)).toBe(200)
  })

  it('フォルダのドメインでは出ない（住所はフォルダで決めない）', async () => {
    const folder = await createFolder('めぐり')
    await postJson(`${server.api}/folders/${folder.uid}/quick_domain`, { label: 'meguri' })
    const page = await createPage(folder.id)
    expect(await openOn(page.uid, `meguri.${BASE}`)).toBe(404)
    expect(await openOn(page.uid, BASE)).toBe(200)
  })

  it('基本情報で頭の名前を決めると <名前>.<土台> に変わり、前の住所では出ない', async () => {
    const page = await createPage(null)
    const res = await setLabel(page.uid, 'Meguri')
    expect(res.status).toBe(200)
    expect(res.json.ab_test.delivery_domain).toBe(`meguri.${BASE}`)
    expect(await openOn(page.uid, `meguri.${BASE}`)).toBe(200)
    expect(await openOn(page.uid, BASE)).toBe(404)
    expect(await openOn(page.uid, `other.${BASE}`)).toBe(404)
  })

  it('同じ頭の名前を、ほかのLPでも使える（同じ商材のLPを同じ住所にまとめられる）', async () => {
    const first = await createPage(null)
    const second = await createPage(null)
    expect((await setLabel(first.uid, 'meguri')).status).toBe(200)
    expect((await setLabel(second.uid, 'meguri')).status).toBe(200)
    expect(await openOn(second.uid, `meguri.${BASE}`)).toBe(200)
  })

  it('空に戻すと c1page.com に戻る', async () => {
    const page = await createPage(null)
    await setLabel(page.uid, 'meguri')
    const res = await setLabel(page.uid, '')
    expect(res.json.ab_test.delivery_domain).toBe(BASE)
    expect(await openOn(page.uid, BASE)).toBe(200)
  })

  it('形がおかしい名前は受け付けない（住所は変わらない）', async () => {
    const page = await createPage(null)
    const res = await setLabel(page.uid, 'めぐり')
    expect(res.status).toBe(422)
    expect(res.json.error?.message).toContain('英字')
    expect(await openOn(page.uid, BASE)).toBe(200)
  })

  it('計測も、そのLPの住所でだけ受け付ける', async () => {
    const page = await createPage(null)
    const beacon = (host: string) =>
      requestWithHost('POST', `${server.baseUrl}/lp/${page.uid}/__track`, {
        host,
        contentType: 'text/plain',
        body: JSON.stringify({ event: 'pv' }),
      })
    expect((await beacon(`other.${BASE}`)).status).toBe(404)
    expect((await beacon(BASE)).status).not.toBe(404)
  })

  it('このシステムのドメインでは今までどおり開ける（管理画面の確認用）', async () => {
    const page = await createPage(null)
    expect(await openOn(page.uid, 'lp-sakusei.example.test')).toBe(200)
  })
})

describe('複製したLP', () => {
  it('前からあるLPを複製すると、写しは c1page.com で出る', async () => {
    const folder = await createFolder('金谷')
    const old = await createPage(folder.id) // 土台を決める前に作った＝前からあるLP
    await setBase(BASE)
    const copy = await postJson<PageJson>(`${server.api}/ab_tests/${old.uid}/duplicate`, {})
    expect(copy.json.ab_test.delivery_domain).toBe(BASE)
  })

  it('頭の名前を決めたLPを複製すると、写しも同じ住所', async () => {
    await setBase(BASE)
    const page = await createPage(null)
    await setLabel(page.uid, 'meguri')
    const copy = await postJson<PageJson>(`${server.api}/ab_tests/${page.uid}/duplicate`, {})
    expect(copy.json.ab_test.delivery_domain).toBe(`meguri.${BASE}`)
  })
})

describe('前からあるLP（住所を持たない）', () => {
  it('今までどおりフォルダのドメインで出る。基本情報から住所は変えられない', async () => {
    const folder = await createFolder('金谷')
    const old = await createPage(folder.id)
    expect(old.delivery_domain).toBe('')
    await setBase(BASE)
    await postJson(`${server.api}/folders/${folder.uid}/quick_domain`, { label: 'kanaya' })
    expect(await openOn(old.uid, `kanaya.${BASE}`)).toBe(200)
    expect(await openOn(old.uid, BASE)).toBe(404)
    const res = await setLabel(old.uid, 'meguri')
    expect(res.status).toBe(422)
    expect(await openOn(old.uid, `kanaya.${BASE}`)).toBe(200)
  })
})

describe('基本情報の画面', () => {
  it('頭の名前の欄は、住所を持つLP（これから作るLP）だけに出す', () => {
    expect(editableAddressLabel(BASE, BASE)).toBe('')
    expect(editableAddressLabel(`meguri.${BASE}`, BASE)).toBe('meguri')
    expect(editableAddressLabel('', BASE)).toBeNull()
    expect(editableAddressLabel(undefined, BASE)).toBeNull()
  })

  it('名前を変えると、新しい住所と「前の住所では開けなくなる」ことを案内する', () => {
    const note = addressChangeNote(BASE, 'meguri', BASE, 'P1')
    expect(note).toContain(`https://meguri.${BASE}/lp/P1`)
    expect(note).toContain(`https://${BASE}/lp/P1`)
    expect(note).toContain('開けなくなる')
    expect(addressChangeNote(`meguri.${BASE}`, 'Meguri', BASE, 'P1')).toBeNull()
    expect(addressChangeNote(BASE, 'めぐり', BASE, 'P1')).toContain('英字')
  })

  it('配信URLの横の「登録する」は、住所が変わる正しい名前のときだけ押せる（2026-10-30 本人「配信URLの横にも登録ボタン」）', () => {
    expect(canRegisterAddress(BASE, 'meguri', BASE)).toBe(true)
    expect(canRegisterAddress(`meguri.${BASE}`, '', BASE)).toBe(true)
    expect(canRegisterAddress(`meguri.${BASE}`, ' Meguri ', BASE)).toBe(false)
    expect(canRegisterAddress(BASE, '', BASE)).toBe(false)
    expect(canRegisterAddress(BASE, 'めぐり', BASE)).toBe(false)
  })

  const page: AbTestForEdit = {
    uid: 'P1',
    title: 'めぐり',
    page_title: '',
    memo: '',
    ad_status: 'prepared',
    editor_version: 2,
    delivery_type: 'same_url',
    media_id: 1,
    conversion_unit_price: 0,
    conversion_setting: { conversion_condition: 'click' },
    affiliate_service_provider: null,
    gender: null,
    age_from: null,
    age_to: null,
    media: null,
    folder: null,
    delivery_domain: BASE,
  }
  const values = { title: 'めぐり', page_title: '', memo: '', affiliate_service_provider: '', conversion_unit_price: '0' }

  it('欄があるときだけ、登録で頭の名前を送る（大文字は小文字にそろえる）', () => {
    expect(buildUpdatePayload(page, { ...values, delivery_label: ' Meguri ' })['delivery_label']).toBe('meguri')
    expect('delivery_label' in buildUpdatePayload(page, values)).toBe(false)
  })

  it('形がおかしい名前では登録しない', () => {
    expect(validateBasicInfo({ ...values, delivery_label: 'めぐり' })).toEqual({ ok: false, message: expect.stringContaining('英字') })
    expect(validateBasicInfo({ ...values, delivery_label: '' })).toEqual({ ok: true })
  })
})

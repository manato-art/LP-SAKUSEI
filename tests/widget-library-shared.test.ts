/**
 * 「作成したWidget」と「お気に入り」をサーバーに置く（2026-10-24 本人「僕のアカウントで作ったウィジェットが他のアカウントで見れない」）。
 *
 * 以前はどちらも作った人のブラウザ（localStorage）だけにあり、ほかの人のパソコン・ほかのアカウントからは1件も見えなかった。
 * 本人の選択:
 * - 作成したWidget … 全員（管理者もLP作成者も）で全部を共有
 * - 消せるのは管理者なら誰でも（LP作成者は今の決まりどおり何も消せない）
 * - お気に入り … アカウントごと（どのパソコンから入っても同じ・ほかの人には出ない）
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createCreatorAccount, resetCreatorAccountsForTest } from '../mock-server/store/creator-accounts.ts'
import { resetWidgetLibraryForTest } from '../mock-server/store/widget-library.ts'
import { emailGateToken } from '../mock-server/lib/creator-session.ts'
import { startTestServer, type TestServer } from './helpers/server.ts'

let server: TestServer
beforeAll(async () => {
  server = await startTestServer()
})
afterAll(async () => {
  await server.close()
})

interface Call {
  status: number
  json: Record<string, unknown>
}

async function call(method: string, path: string, cookie: string, body?: unknown): Promise<Call> {
  const res = await fetch(`${server.api}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie === '' ? {} : { cookie }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  return { status: res.status, json: ((await res.json().catch(() => ({}))) ?? {}) as Record<string, unknown> }
}

/** 管理者（開発中はログインを見ないので、入口で入れたメールの印だけ付ける） */
const admin = (email: string): string => `email_gate=${emailGateToken(email)}`

async function loginCreator(email: string): Promise<string> {
  const gate = await fetch(`${server.baseUrl}/__auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  const gateCookie = (gate.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
  const res = await fetch(`${server.baseUrl}/__auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: gateCookie },
    body: JSON.stringify({ password: 'creator-pass-01' }),
  })
  expect(res.status).toBe(200)
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0] ?? '').filter((c) => !c.endsWith('=')).join('; ')
}

const A = admin('ebina@example.com')
const B = admin('staff@example.com')
let creator = ''

const createdNames = async (cookie: string): Promise<string[]> =>
  ((await call('GET', '/widget_library', cookie)).json['created'] as { name: string }[]).map((w) => w.name)
const favoriteKeys = async (cookie: string): Promise<string[]> =>
  ((await call('GET', '/widget_library', cookie)).json['favorites'] as { key: string }[]).map((w) => w.key)

beforeEach(async () => {
  resetWidgetLibraryForTest()
  resetCreatorAccountsForTest()
  const out = createCreatorAccount({ email: 'writer@example.com', name: '佐藤', password: 'creator-pass-01' })
  if (!out.ok) throw new Error(out.message)
  creator = await loginCreator('writer@example.com')
})

describe('作成したWidgetは全員で共有する', () => {
  it('管理者が登録したWidgetは、ほかの管理者にもLP作成者にも見える', async () => {
    const saved = await call('POST', '/widget_library/created', A, { name: '申込ボタン', html: '<a>申し込む</a>' })
    expect(saved.status).toBe(201)
    expect(await createdNames(B)).toEqual(['申込ボタン'])
    expect(await createdNames(creator)).toEqual(['申込ボタン'])
  })

  it('LP作成者も登録でき、管理者から見える（新しいものが先頭）', async () => {
    await call('POST', '/widget_library/created', A, { name: '1つ目', html: '<p>1</p>' })
    expect((await call('POST', '/widget_library/created', creator, { name: '2つ目', html: '<p>2</p>' })).status).toBe(201)
    expect(await createdNames(A)).toEqual(['2つ目', '1つ目'])
  })

  it('カテゴリー・説明文・元の入力（部品の設定）も一緒に残す', async () => {
    const source = { kind: 'builder', screens: [] }
    await call('POST', '/widget_library/created', A, { name: '比較表', html: '<table></table>', category: '表', description: '3社比較', source })
    const [w] = (await call('GET', '/widget_library', B)).json['created'] as Record<string, unknown>[]
    expect(w).toMatchObject({ name: '比較表', category: '表', description: '3社比較', source })
  })

  it('名前・中身が空なら入れない', async () => {
    expect((await call('POST', '/widget_library/created', A, { name: ' ', html: '<p>x</p>' })).status).toBe(422)
    expect((await call('POST', '/widget_library/created', A, { name: 'x', html: '' })).status).toBe(422)
  })

  it('埋め込みの画像（data URL）は保存の前にファイルにする（保存データを軽くする）', async () => {
    const big = `data:image/png;base64,${'A'.repeat(4000)}`
    await call('POST', '/widget_library/created', A, { name: '画像入り', html: `<img src="${big}">` })
    const [w] = (await call('GET', '/widget_library', A)).json['created'] as { html: string }[]
    expect(w?.html).not.toContain('data:image/png')
    expect(w?.html).toContain('/uploads/')
  })
})

describe('消せるのは管理者だけ', () => {
  it('LP作成者は消せない・管理者は誰が作ったものでも消せる', async () => {
    const saved = await call('POST', '/widget_library/created', creator, { name: '作成者の分', html: '<p>x</p>' })
    const id = (saved.json['widget'] as { id: string }).id
    expect((await call('DELETE', `/widget_library/created/${id}`, creator)).status).toBe(403)
    expect((await call('DELETE', `/widget_library/created/${id}`, B)).status).toBe(204)
    expect(await createdNames(A)).toEqual([])
    expect((await call('DELETE', `/widget_library/created/${id}`, B)).status).toBe(404)
  })
})

describe('お気に入りはアカウントごと', () => {
  it('自分の★だけが自分のお気に入りに出る（どのパソコンからでも同じ・ほかの人には出ない）', async () => {
    const on = await call('POST', '/widget_library/favorites/toggle', A, { key: '見出しA', name: '見出しA', html: '<h2>A</h2>' })
    expect(on.json['favorite']).toBe(true)
    await call('POST', '/widget_library/favorites/toggle', creator, { key: '見出しC', name: '見出しC', html: '<h2>C</h2>' })
    expect(await favoriteKeys(A)).toEqual(['見出しA'])
    expect(await favoriteKeys(B)).toEqual([])
    expect(await favoriteKeys(creator)).toEqual(['見出しC'])
  })

  it('もう一度押すと外れる', async () => {
    await call('POST', '/widget_library/favorites/toggle', A, { key: 'k', name: 'k', html: '<p>k</p>' })
    const off = await call('POST', '/widget_library/favorites/toggle', A, { key: 'k', name: 'k', html: '<p>k</p>' })
    expect(off.json['favorite']).toBe(false)
    expect(await favoriteKeys(A)).toEqual([])
  })
})

describe('ブラウザに残っている分をサーバーへ移す（一度だけ・同じものは二重にしない）', () => {
  it('作成したWidgetは全員の一覧へ、お気に入りはそのアカウントへ', async () => {
    const local = {
      created: [{ id: 'cw_old1', name: '前に作った', html: '<p>前</p>', ts: 1 }],
      favorites: [{ key: 'fav1', name: 'お気に入り1', html: '<p>f</p>', ts: 1 }],
    }
    const first = await call('POST', '/widget_library/import', A, local)
    expect(first.json['imported']).toEqual({ created: 1, favorites: 1 })
    const again = await call('POST', '/widget_library/import', A, local)
    expect(again.json['imported']).toEqual({ created: 0, favorites: 0 })
    expect(await createdNames(creator)).toEqual(['前に作った'])
    expect(await favoriteKeys(A)).toEqual(['fav1'])
    expect(await favoriteKeys(B)).toEqual([])
  })

  it('形の崩れたものは取り込まない', async () => {
    const out = await call('POST', '/widget_library/import', A, { created: [{ id: 'x' }, 'こわれた'], favorites: null })
    expect(out.json['imported']).toEqual({ created: 0, favorites: 0 })
  })
})

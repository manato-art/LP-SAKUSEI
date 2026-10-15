/**
 * LP作成者が使える範囲（2026-10-15 本人指定）。画面で隠すだけでなく、サーバーでも断る。
 *
 * - 使える: ページ一覧・ページの作成・Versionタブ（編集・プレビュー）・離脱防止ポップ・中間ページ・切り替え・基本情報
 * - 見られるのは**自分が作ったページだけ**（ほかの人のページは「見つかりません」）
 * - 使えない: 削除（ページ・Version・ポップアップなど全部）・数字（レポート・ダッシュボード・CV速報）・ツール・全体の設定
 * - 管理者は今までどおり全部使える
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getState } from '../mock-server/store/store.ts'
import { createCreatorAccount, resetCreatorAccountsForTest } from '../mock-server/store/creator-accounts.ts'
import { resetStore, startTestServer, type TestServer } from './helpers/server.ts'

let server: TestServer
beforeAll(async () => {
  server = await startTestServer()
})
afterAll(async () => {
  await server.close()
})

let creator = ''
let otherCreator = ''

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

async function loginAs(email: string, password: string): Promise<string> {
  const gate = await fetch(`${server.baseUrl}/__auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  const gateCookie = (gate.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
  const res = await fetch(`${server.baseUrl}/__auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: gateCookie },
    body: JSON.stringify({ password }),
  })
  expect(res.status).toBe(200)
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0] ?? '').filter((c) => !c.endsWith('=')).join('; ')
}

interface Page {
  abTest: string
  article: string
  version: string
}

async function createPage(cookie: string, title: string): Promise<Page> {
  const out = await call('POST', '/ab_tests', cookie, { title, media_id: 1 })
  expect(out.status).toBe(201)
  const abTest = (out.json['ab_test'] as { uid: string }).uid
  const article = (out.json['article'] as { uid: string }).uid
  const version = (out.json['version'] as { uid: string }).uid
  return { abTest, article, version }
}

let mine: Page
let admins: Page

beforeEach(async () => {
  resetStore()
  resetCreatorAccountsForTest()
  for (const [email, name] of [['writer@example.com', '佐藤'], ['other@example.com', '鈴木']] as const) {
    const out = createCreatorAccount({ email, name, password: 'creator-pass-01' })
    if (!out.ok) throw new Error(out.message)
  }
  creator = await loginAs('writer@example.com', 'creator-pass-01')
  otherCreator = await loginAs('other@example.com', 'creator-pass-01')
  admins = await createPage('', '管理者のページ')
  mine = await createPage(creator, '自分のページ')
})

describe('自分が作ったページだけ', () => {
  it('LP作成者が作ったページには、作った人の印が付く（管理者のページには付かない）', () => {
    const state = getState()
    const created = state.abTests.find((t) => t.uid === mine.abTest)
    const adminPage = state.abTests.find((t) => t.uid === admins.abTest)
    expect(created?.created_by).toMatch(/^creator_/)
    expect(adminPage?.created_by).toBeUndefined()
  })

  it('ページの一覧には自分のページだけが出る（管理者には全部出る）', async () => {
    const list = await call('GET', '/ab_tests', creator)
    expect((list.json['ab_tests'] as { uid: string }[]).map((t) => t.uid)).toEqual([mine.abTest])
    const all = await call('GET', '/ab_tests', '')
    expect((all.json['ab_tests'] as { uid: string }[]).map((t) => t.uid).sort()).toEqual(
      [admins.abTest, mine.abTest].sort(),
    )
  })

  it('フォルダを開いたときのページの一覧・フォルダのページ数にも、ほかの人のページを出さない', async () => {
    // 作ったページはフォルダなし（folder_id 無し）なので、同じフォルダへ入れてから確かめる
    const folder = await call('POST', '/folders', '', { name: '共有フォルダ' })
    const shared = (folder.json['folder'] as { uid: string; id: number })
    await call('PUT', `/ab_tests/${admins.abTest}`, '', { folder_id: shared.id })
    await call('PUT', `/ab_tests/${mine.abTest}`, creator, { folder_id: shared.id })

    const detail = await call('GET', `/folders/${shared.uid}`, creator)
    expect((detail.json['ab_tests'] as { uid: string }[]).map((t) => t.uid)).toEqual([mine.abTest])
    const list = await call('GET', '/folders?per_page=200', creator)
    const counted = (list.json['folders'] as { uid: string; ab_tests_count: number }[]).find((f) => f.uid === shared.uid)
    expect(counted?.ab_tests_count).toBe(1)
    // 管理者には全部
    const adminDetail = await call('GET', `/folders/${shared.uid}`, '')
    expect((adminDetail.json['ab_tests'] as unknown[]).length).toBe(2)
  })

  it('ほかの人のページは「見つかりません」（中身も設定も読めない・書けない）', async () => {
    expect((await call('GET', `/ab_tests/${admins.abTest}/articles`, creator)).status).toBe(404)
    expect((await call('GET', `/articles/${admins.article}/versions`, creator)).status).toBe(404)
    expect((await call('PUT', `/versions/${admins.version}`, creator, { html: '<p>x</p>' })).status).toBe(404)
    expect((await call('GET', `/ab_tests/${mine.abTest}/articles`, otherCreator)).status).toBe(404)
  })

  it('ほかの人のページは複製できない・自分のページの複製は自分のものになる', async () => {
    expect((await call('POST', `/ab_tests/${admins.abTest}/duplicate`, creator, {})).status).toBe(404)
    const copy = await call('POST', `/ab_tests/${mine.abTest}/duplicate`, creator, {})
    expect(copy.status).toBe(201)
    const uid = (copy.json['ab_test'] as { uid: string }).uid
    expect(getState().abTests.find((t) => t.uid === uid)?.created_by).toMatch(/^creator_/)
  })

  it('Versionをほかの人のページへ複製することはできない', async () => {
    const out = await call('POST', `/versions/${mine.version}/duplicate_to`, creator, { target_article_uid: admins.article })
    expect(out.status).toBe(404)
  })
})

describe('自分のページでできること', () => {
  it('Versionタブ: 中身の保存・Versionを足す・配信割合', async () => {
    expect((await call('PUT', `/versions/${mine.version}`, creator, { html: '<p>こんにちは</p>' })).status).toBe(200)
    expect((await call('POST', `/articles/${mine.article}/versions`, creator, {})).status).toBe(201)
    expect((await call('PATCH', `/versions/${mine.version}/distribution`, creator, { distribution_ratio: 100 })).status).toBe(200)
  })

  it('基本情報・離脱防止ポップ・中間ページ・切り替え', async () => {
    expect((await call('GET', `/ab_tests/${mine.abTest}`, creator)).status).toBe(200)
    expect((await call('POST', `/ab_tests/${mine.abTest}/exit_popups`, creator, { name: 'ポップ' })).status).toBe(201)
    expect((await call('GET', `/ab_tests/${mine.abTest}/redirect_pages`, creator)).status).toBe(200)
    expect((await call('GET', `/ab_tests/${mine.abTest}/split_test_settings/devices`, creator)).status).not.toBe(403)
  })
})

describe('LP作成者には使えないもの（サーバーでも断る）', () => {
  it.each([
    ['DELETE', () => `/ab_tests/${mine.abTest}`],
    ['DELETE', () => `/versions/${mine.version}`],
    ['GET', () => `/ab_tests/${mine.abTest}/reports`],
    ['GET', () => `/ab_tests/${mine.abTest}/heatmaps/stats`],
    ['GET', () => '/teams/dashboard'],
    ['GET', () => '/conversions'],
    ['POST', () => '/folders'],
    ['PUT', () => '/settings/theme'],
    ['GET', () => '/allowed_emails'],
    ['GET', () => '/creator_accounts'],
    ['GET', () => '/tasks'],
    ['POST', () => '/articles/bulk_replaces'],
  ])('%s %s は 403', async (method, path) => {
    const out = await call(method, path(), creator, method === 'GET' ? undefined : {})
    expect(out.status).toBe(403)
    expect(JSON.stringify(out.json)).toContain('LP作成者')
  })
})

describe('LP作成者のアカウントの管理（管理者だけ）', () => {
  it('管理者は足す・一覧・パスワード変更・削除ができ、応答にパスワードを出さない', async () => {
    const add = await call('POST', '/creator_accounts', '', { email: 'new@example.com', name: '高橋', password: 'new-pass-0001' })
    expect(add.status).toBe(201)
    const uid = (add.json['creator_account'] as { uid: string }).uid
    const list = await call('GET', '/creator_accounts', '')
    expect(JSON.stringify(list.json)).not.toContain('new-pass-0001')
    expect(JSON.stringify(list.json)).not.toContain('password_hash')
    expect((list.json['creator_accounts'] as { email: string }[]).map((a) => a.email)).toContain('new@example.com')
    expect((await call('PUT', `/creator_accounts/${uid}`, '', { password: 'changed-pass-01' })).status).toBe(200)
    expect((await call('DELETE', `/creator_accounts/${uid}`, '')).status).toBe(204)
  })

  it('同じメールや短いパスワードは、理由つきで断る', async () => {
    const dup = await call('POST', '/creator_accounts', '', { email: 'writer@example.com', name: 'x', password: 'creator-pass-01' })
    expect(dup.status).toBe(409)
    const short = await call('POST', '/creator_accounts', '', { email: 'n2@example.com', name: 'x', password: 'short' })
    expect(short.status).toBe(422)
  })
})

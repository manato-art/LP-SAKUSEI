/**
 * SquadBeyond の Widget を Widget一覧に戻す（2026-10-26 本人「SquadBeyondのものを戻して、1個1個SB本体のLPに入れて
 * 動きを確かめて再現して」）。ここはサーバー側＝分類と中身を配る窓口と、写した画像を /uploads に置くこと。
 *
 * 本人の決定: 種類は全部（1,587件）／架空への置き換えはかけない／画像はEBIyonに写して持つ／自作の見本とは別の分類。
 * 中身はログインした人だけが読める（/api の中）。LP作成者もLPを作るので読める。
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { seedSbWidgetMedia, SB_WIDGET_MEDIA_DIR } from '../mock-server/lib/sb-widget-media.ts'
import { checkCreatorAccess } from '../mock-server/lib/creator-access.ts'
import { getState } from '../mock-server/store/store.ts'
import { startTestServer, type TestServer } from './helpers/server.ts'

const uploads = mkdtempSync(join(tmpdir(), 'lp-sakusei-sb-widgets-'))
let server: TestServer

beforeAll(async () => {
  vi.stubEnv('UPLOADS_DIR', uploads)
  seedSbWidgetMedia()
  server = await startTestServer()
})

afterAll(async () => {
  await server.close()
  vi.unstubAllEnvs()
  rmSync(uploads, { recursive: true, force: true })
})

interface Category {
  id: number
  name: string
  count: number
}
interface Part {
  id: number
  name: string
  html: string
  css: string
}

const get = async <T>(path: string): Promise<{ status: number; json: T }> => {
  const res = await fetch(`${server.api}${path}`)
  return { status: res.status, json: (await res.json()) as T }
}

describe('分類と中身を配る', () => {
  it('分類は SB と同じ16＋分類なし。件数を合わせると 1,587件', async () => {
    const res = await get<{ categories: Category[] }>('/sb_widgets')
    expect(res.status).toBe(200)
    const names = res.json.categories.map((c) => c.name)
    expect(names.slice(0, 16)).toEqual([
      '見出し', '囲み枠', '吹き出し', '文字', '画像', 'クチコミ', 'フッター', 'アクション',
      'ボタン', '表', '埋め込み', '自動表示', 'アンケート', 'テンプレート記事', 'オリジナル', '区切り線',
    ])
    expect(names[16]).toBe('分類なし')
    expect(res.json.categories.reduce((sum, c) => sum + c.count, 0)).toBe(1587)
  })

  it('分類を選ぶと、その分類の Widget（番号・名前・HTML・CSS）。SBの置き場を指すURLは残っていない', async () => {
    const { json } = await get<{ categories: Category[] }>('/sb_widgets')
    const survey = json.categories.find((c) => c.name === 'アンケート')
    const res = await get<{ parts: Part[] }>(`/sb_widgets/${survey?.id}`)
    expect(res.status).toBe(200)
    expect(res.json.parts).toHaveLength(survey?.count ?? -1)
    for (const part of res.json.parts) {
      expect(typeof part.id).toBe('number')
      expect(part.name).not.toBe('')
      expect(`${part.html}${part.css}`).not.toMatch(/production\.static\.squadbeyond\.com|file\.mysquadbeyond\.com|d24894ewhzyuok\.cloudfront\.net/)
    }
  })

  it('他の会社・個人の置き場を直接読まない（2026-10-27 本人選択「読み込みを外して一覧に残す」）', async () => {
    const { json } = await get<{ categories: Category[] }>('/sb_widgets')
    const all: Part[] = []
    for (const category of json.categories) all.push(...(await get<{ parts: Part[] }>(`/sb_widgets/${category.id}`)).json.parts)
    const text = (id: number): string => {
      const part = all.find((p) => p.id === id)
      return `${part?.html ?? ''}${part?.css ?? ''}`
    }
    // 一覧には残す
    expect([4571, 2549, 2470].every((id) => all.some((p) => p.id === id))).toBe(true)
    for (const part of all) expect(`${part.html}${part.css}`).not.toMatch(/ec-force\.s3\.amazonaws\.com|antiaging-sign\.com|dropboxusercontent\.com/)
    // 4571 のスライダーは、同じ版（Swiper 7.0.0）を公開の配布元から読む（スライダーとして動くまま）
    expect(text(4571)).toContain('https://cdn.jsdelivr.net/npm/swiper@7.0.0/swiper-bundle.min.js')
    expect(text(4571)).toContain('https://cdn.jsdelivr.net/npm/swiper@7.0.0/swiper-bundle.min.css')
  })

  it('1問ずつ別ページへ移る前提の見本8本は、画面①②③に分けた形で配る（2026-10-27 本人「今まで通り分けるのが理想」・9月と同じ作り変え）', async () => {
    const { json } = await get<{ categories: Category[] }>('/sb_widgets')
    const all: Part[] = []
    for (const category of json.categories) all.push(...(await get<{ parts: Part[] }>(`/sb_widgets/${category.id}`)).json.parts)
    const screened = all.filter((part) => part.html.includes('data-nc-screens')).map((part) => part.id).sort((a, b) => a - b)
    expect(screened).toEqual([8690, 9575, 9577, 10150, 15296, 19424, 20020, 20021])
    for (const id of screened) {
      const part = all.find((p) => p.id === id)
      // 画面は2つ以上。最初の画面だけが見え、ほかは隠れている
      const screens = [...(part?.html ?? '').matchAll(/<div class="nc-screen" data-nc-screen="s\d+"[^>]*>/g)].map((m) => m[0])
      expect(screens.length).toBeGreaterThan(1)
      expect(screens.map((tag) => !/\shidden(="")?>$/.test(tag))).toEqual(screens.map((_, i) => i === 0))
    }
  })

  it('無い分類は 404', async () => {
    expect((await get('/sb_widgets/999')).status).toBe(404)
    expect((await get('/sb_widgets/abc')).status).toBe(404)
  })

  it('LP作成者も読める（LPを作るので）', () => {
    const state = getState()
    const writer = { uid: 'writer-1', email: 'writer@example.com', name: '佐藤', created_at: 0, password_hash: '' }
    expect(checkCreatorAccess(state, writer, 'GET', '/sb_widgets', {}).ok).toBe(true)
    expect(checkCreatorAccess(state, writer, 'GET', '/sb_widgets/13', {}).ok).toBe(true)
  })
})

describe('写した画像などを /uploads に置く', () => {
  it('起動時に置く。中身の sha256 が名前なので、Widget の中の /uploads/… がそのまま開ける', async () => {
    const files = readdirSync(SB_WIDGET_MEDIA_DIR)
    expect(files.length).toBeGreaterThan(600)
    for (const name of files.slice(0, 5)) {
      const content = readFileSync(join(uploads, name))
      expect(name.startsWith(createHash('sha256').update(content).digest('hex'))).toBe(true)
    }
    const { json } = await get<{ parts: Part[] }>('/sb_widgets/5')
    const url = json.parts.map((p) => /\/uploads\/[0-9a-f]{64}\.[a-z0-9]+/.exec(p.html)?.[0]).find((u) => u !== undefined)
    expect(url).toBeDefined()
    const res = await fetch(`${server.baseUrl}${url}`)
    expect(res.status).toBe(200)
  })

  it('何度起動しても同じ（あるファイルは書き直さない）', () => {
    const before = readdirSync(uploads).length
    expect(seedSbWidgetMedia()).toBe(0)
    expect(readdirSync(uploads).length).toBe(before)
    expect(existsSync(uploads)).toBe(true)
  })
})

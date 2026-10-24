/**
 * 「作成したWidget」と「お気に入り」の置き場所（画面の側）。
 *
 * 2026-10-24 本人「僕のアカウントで作ったウィジェットが他のアカウントで見れない」で、ブラウザ（localStorage）から
 * サーバー（/widget_library）へ移した。画面はサーバーの中身を手元に写して使う（一覧を描くたびに待たないため）。
 * - ブラウザに残っている分は、このブラウザで一度だけサーバーへ移す（移せなかったら次に開いたときにまた移す）
 * - 保存・削除・★はサーバーへ送り、通った分だけ手元の写しも変える。通らなければ false／エラー（黙って捨てない）
 * - 型・部品から作ったものの「元の入力（source）」・カテゴリー・説明文も一緒に送る（以前と同じ）
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

/** node には localStorage が無いので、最小の偽物を置く */
class FakeStorage {
  private data = new Map<string, string>()
  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
  removeItem(key: string): void {
    this.data.delete(key)
  }
}
const storage = new FakeStorage()
;(globalThis as unknown as { localStorage: FakeStorage }).localStorage = storage

type Handler = (method: string, path: string, body?: unknown) => unknown
let handler: Handler = () => ({})
const calls: Array<{ method: string; path: string; body?: unknown }> = []
vi.mock('../src/app/api.ts', () => ({
  request: async (method: string, path: string, body?: unknown) => {
    calls.push({ method, path, body })
    return handler(method, path, body)
  },
}))

const lib = await import('../src/app/panels/widget-library-storage.ts')

const SERVER = {
  created: [{ id: 'cw_1', name: '申込ボタン', html: '<a>申し込む</a>', ts: 2 }],
  favorites: [{ key: '見出しA', name: '見出しA', html: '<h2>A</h2>', ts: 1 }],
}

beforeEach(() => {
  for (const key of ['lp-sakusei:created-widgets', 'lp-sakusei:favorite-widgets', 'lp-sakusei:widget-library-moved']) {
    storage.removeItem(key)
  }
  calls.length = 0
  handler = (method, path) => (method === 'GET' && path === '/widget_library' ? SERVER : {})
})

describe('サーバーの中身を読む', () => {
  it('作成したWidget（全員の分）とお気に入り（自分の分）を手元に写す', async () => {
    await lib.refreshWidgetLibrary()
    expect(lib.loadCreatedWidgets().map((w) => w.name)).toEqual(['申込ボタン'])
    expect(lib.loadFavorites().map((f) => f.key)).toEqual(['見出しA'])
    expect(lib.isFavorite('見出しA')).toBe(true)
    expect(lib.isFavorite('ほか')).toBe(false)
  })
})

describe('ブラウザに残っている分を一度だけサーバーへ移す', () => {
  it('前に作った分・お気に入りを送り、印を付ける（2回目は送らない）', async () => {
    storage.setItem('lp-sakusei:created-widgets', JSON.stringify([{ id: 'cw_old', name: '前の', html: '<p>x</p>', ts: 1 }]))
    storage.setItem('lp-sakusei:favorite-widgets', JSON.stringify([{ key: 'k', name: 'k', html: '<p>k</p>', ts: 1 }]))
    await lib.refreshWidgetLibrary()
    const moved = calls.find((c) => c.path === '/widget_library/import')
    expect(moved?.body).toEqual({
      created: [{ id: 'cw_old', name: '前の', html: '<p>x</p>', ts: 1 }],
      favorites: [{ key: 'k', name: 'k', html: '<p>k</p>', ts: 1 }],
    })
    calls.length = 0
    await lib.refreshWidgetLibrary()
    expect(calls.some((c) => c.path === '/widget_library/import')).toBe(false)
  })

  it('移せなかったら印を付けない（次に開いたときにまた移す）。一覧は読む', async () => {
    storage.setItem('lp-sakusei:created-widgets', JSON.stringify([{ id: 'cw_old', name: '前の', html: '<p>x</p>', ts: 1 }]))
    handler = (method, path) => {
      if (path === '/widget_library/import') throw new Error('つながらない')
      return method === 'GET' ? SERVER : {}
    }
    await lib.refreshWidgetLibrary()
    expect(storage.getItem('lp-sakusei:widget-library-moved')).toBeNull()
    expect(lib.loadCreatedWidgets()).toHaveLength(1)
  })

  it('ブラウザに何も無ければ送らない', async () => {
    await lib.refreshWidgetLibrary()
    expect(calls.map((c) => c.path)).toEqual(['/widget_library'])
  })
})

describe('作ったWidgetを保存する・消す', () => {
  it('サーバーへ送り、通ったら true・一覧の先頭に入る（元の入力・カテゴリー・説明文も送る）', async () => {
    await lib.refreshWidgetLibrary()
    handler = (_m, path, body) => (path === '/widget_library/created' ? { widget: { id: 'cw_2', ts: 3, ...(body as object) } } : SERVER)
    const source = { kind: 'builder' }
    expect(await lib.saveCreatedWidget('比較表', '<table></table>', source, { category: '表', description: '3社比較' })).toBe(true)
    expect(calls.at(-1)).toEqual({
      method: 'POST',
      path: '/widget_library/created',
      body: { name: '比較表', html: '<table></table>', source, category: '表', description: '3社比較' },
    })
    expect(lib.loadCreatedWidgets().map((w) => w.name)).toEqual(['比較表', '申込ボタン'])
  })

  it('通らなければ false（作ったつもりで一覧に無い、を黙ってやらない）', async () => {
    await lib.refreshWidgetLibrary()
    handler = () => {
      throw new Error('大きすぎる')
    }
    expect(await lib.saveCreatedWidget('大きいWidget', '<p>x</p>')).toBe(false)
    expect(lib.loadCreatedWidgets().map((w) => w.name)).toEqual(['申込ボタン'])
  })

  it('消すとサーバーからも手元からも消える', async () => {
    await lib.refreshWidgetLibrary()
    expect(await lib.deleteCreatedWidget('cw_1')).toBe(true)
    expect(calls.at(-1)).toMatchObject({ method: 'DELETE', path: '/widget_library/created/cw_1' })
    expect(lib.loadCreatedWidgets()).toEqual([])
  })
})

describe('お気に入り（★）', () => {
  it('サーバーで付け外しし、返ってきた自分のお気に入りに写す', async () => {
    await lib.refreshWidgetLibrary()
    handler = () => ({ favorite: true, favorites: [{ key: '見出しB', name: '見出しB', html: '<h2>B</h2>', ts: 3 }, ...SERVER.favorites] })
    expect(await lib.toggleFavorite('見出しB', '見出しB', '<h2>B</h2>')).toBe(true)
    expect(lib.isFavorite('見出しB')).toBe(true)
  })
})

describe('Widgetライブラリへの組み込み', () => {
  const library = readFileSync('src/app/panels/widget-library.ts', 'utf8')

  it('開いたとき・「作成したWidget」「お気に入り」を選んだときにサーバーから読み直す', () => {
    expect(library).toMatch(/refreshWidgetLibrary\(\)/)
    expect(library).not.toContain('localStorage の自作Widget')
  })

  it('LP作成者には「削除」を出さない（消せるのは管理者だけ）', () => {
    expect(library).toMatch(/if \(!isCreator\(\)\) actions\.append\(del\)/)
  })

  it('登録したときは、サーバーに入ったか確かめてから知らせる', () => {
    const studio = readFileSync('src/app/panels/widget-studio.ts', 'utf8')
    expect(studio).toMatch(/void saveCreatedWidget\(name, html\)\.then\(\(ok\) =>/)
    const creator = readFileSync('src/app/panels/widget-creator.ts', 'utf8')
    expect(creator).toMatch(/void saveCreatedWidget\(widgetName, finalHtml, undefined, \{ category, description \}\)\.then/)
  })
})

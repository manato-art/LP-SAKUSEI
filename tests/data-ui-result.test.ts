/**
 * データ画面の読み込み失敗を「0件」に見せない（2026-09-24 点検）。
 *
 * data-ui.ts の getJson は失敗を null にするので、呼び出し側は理由が分からない。
 * 既存の呼び出し側（ほかの画面）はそのまま残し、理由つきで返す getJsonResult を足す。
 * ダッシュボード（全体・各ページ）はこちらを使い、失敗したら理由つきのエラー表示にする。
 */
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getJsonResult } from '../src/app/pages/data-ui.ts'

const g = globalThis as unknown as Record<string, unknown>
const savedFetch = g['fetch']

afterEach(() => {
  g['fetch'] = savedFetch
})

describe('getJsonResult', () => {
  it('成功したら中身を返す', async () => {
    g['fetch'] = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ items: [] }) }))
    expect(await getJsonResult('/x')).toEqual({ ok: true, data: { items: [] } })
  })

  it('サーバーのエラー封筒があれば、その文言を理由にする', async () => {
    g['fetch'] = vi.fn(async () => ({
      ok: false,
      status: 422,
      json: async () => ({ error: { code: 'validation_failed', message: '期間が不正です。' } }),
    }))
    expect(await getJsonResult('/x')).toEqual({ ok: false, message: '期間が不正です。' })
  })

  it('封筒が無いときは状態コードを理由にする', async () => {
    g['fetch'] = vi.fn(async () => ({ ok: false, status: 500, json: async () => { throw new Error('not json') } }))
    expect(await getJsonResult('/x')).toEqual({ ok: false, message: '読み込みに失敗しました（500）' })
  })

  it('つながらないときは、その理由を返す', async () => {
    g['fetch'] = vi.fn(async () => {
      throw new Error('Failed to fetch')
    })
    expect(await getJsonResult('/x')).toEqual({ ok: false, message: 'Failed to fetch' })
  })
})

describe('ダッシュボード', () => {
  it('理由つきの読み込みを使い、失敗したら理由を画面に出す', () => {
    const source = readFileSync('src/app/pages/dashboard-page.ts', 'utf8')
    expect(source).toContain('getJsonResult<DashboardData>(')
    expect(source).toMatch(/取得できませんでした[^']*\$\{/)
  })
})

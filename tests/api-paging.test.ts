/**
 * 一覧の取りこぼし（2026-09-24 点検）。
 * フォルダ一覧と beyondページ一覧は per_page=200 の1回だけで取っていたので、201件目からが黙って消えていた。
 * サーバーの pagination（total_pages）を見て、最後のページまで取る。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { fetchAllPages } from '../src/app/api-paging.ts'

function fakeServer(total: number, perPage: number): (page: number) => Promise<{ items: number[]; pagination: { total_pages: number; current_page: number; total_count: number } }> {
  const all = Array.from({ length: total }, (_, i) => i + 1)
  return async (page) => ({
    items: all.slice((page - 1) * perPage, page * perPage),
    pagination: { total_pages: Math.max(1, Math.ceil(total / perPage)), current_page: page, total_count: total },
  })
}

describe('fetchAllPages', () => {
  it('最後のページまで順に取り、全部つなげて返す', async () => {
    const calls: number[] = []
    const fetchPage = fakeServer(450, 200)
    const items = await fetchAllPages(
      async (page) => {
        calls.push(page)
        return fetchPage(page)
      },
      (res) => res.items,
    )
    expect(items).toHaveLength(450)
    expect(items.at(-1)).toBe(450)
    expect(calls).toEqual([1, 2, 3])
  })

  it('1ページで終わるときは1回だけ取る', async () => {
    const calls: number[] = []
    const fetchPage = fakeServer(3, 200)
    await fetchAllPages(
      async (page) => {
        calls.push(page)
        return fetchPage(page)
      },
      (res) => res.items,
    )
    expect(calls).toEqual([1])
  })

  it('途中のページで失敗したら、黙って途中までを返さずに失敗させる', async () => {
    const fetchPage = fakeServer(450, 200)
    await expect(
      fetchAllPages(
        async (page) => {
          if (page === 2) throw new Error('GET 失敗')
          return fetchPage(page)
        },
        (res) => res.items,
      ),
    ).rejects.toThrow('GET 失敗')
  })
})

describe('一覧APIは全ページを取る', () => {
  const source = readFileSync('src/app/api.ts', 'utf8')
  it('フォルダ一覧と beyondページ一覧は fetchAllPages を通す', () => {
    expect(source).toMatch(/folders: \(\) =>\s*fetchAllPages/)
    expect(source).toMatch(/abTests: \(\) =>\s*fetchAllPages/)
  })
})

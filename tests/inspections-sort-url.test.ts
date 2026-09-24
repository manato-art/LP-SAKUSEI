/**
 * 審査の「↑↓（並び替え）」「beyondページURL検索」と、審査の意味の書き方。
 *
 * 以前:
 *   - ↑↓ は描き直すだけで並びが変わらなかった
 *   - URL検索は `/ab/<uid>` の形しか読めず、このシステムの本当の配信URL `/lp/<uid>` や
 *     プレビューURL `/preview/<VersionのID>` を貼っても、見当違いのページへ飛んでいた
 *   - 「公開前のVersionを承認する画面」と書いてあり、承認しないと配信されないように読めた
 * 本人の決定（2026-09-24）: 審査は配信に影響しない（確認と承認の記録）。非承認のVersionも配信される。
 */
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { parsePageUrl } from '../mock-server/lib/page-url.ts'
import { sortInspectionEntries } from '../src/app/pages/inspection-sort.ts'
import type { InspectionEntry } from '../src/app/api.ts'
import { postJson, resetStore, startTestServer, type TestServer } from './helpers/server.ts'

const entry = (over: Partial<InspectionEntry>): InspectionEntry => ({
  uid: 'v',
  name: 'Version 1',
  kind: 'version',
  status: 'waiting',
  comment: '',
  folder_name: 'F',
  ab_test_uid: 'a',
  ab_test_title: 'ページA',
  ...over,
})

describe('並び替え', () => {
  const rows = [
    entry({ uid: '1', ab_test_title: 'いちご', name: 'Version 2' }),
    entry({ uid: '2', ab_test_title: 'あんず', name: 'Version 1' }),
    entry({ uid: '3', ab_test_title: 'いちご', name: 'Version 1' }),
  ]
  it('昇順はページ名 → Version名の順', () => {
    expect(sortInspectionEntries(rows, true).map((r) => r.uid)).toEqual(['2', '3', '1'])
  })
  it('降順はその逆', () => {
    expect(sortInspectionEntries(rows, false).map((r) => r.uid)).toEqual(['1', '3', '2'])
  })
  it('元の配列は変えない', () => {
    const before = rows.map((r) => r.uid)
    sortInspectionEntries(rows, false)
    expect(rows.map((r) => r.uid)).toEqual(before)
  })
})

describe('URLの読み取り', () => {
  it('配信URL /lp/<uid> を読む（ドメインやパラメータが付いていても）', () => {
    expect(parsePageUrl('https://lp.example.test/lp/Abc123xyz?utm_source=x')).toEqual({ kind: 'page', uid: 'Abc123xyz' })
  })
  it('実物の形 /ab/<uid> も読む', () => {
    expect(parsePageUrl('https://x.test/ab/Abc123xyz')).toEqual({ kind: 'page', uid: 'Abc123xyz' })
  })
  it('プレビューURL /preview/<VersionのID> を読む', () => {
    expect(parsePageUrl('https://x.test/preview/VERSION_0001')).toEqual({ kind: 'preview', uid: 'VERSION_0001' })
  })
  it('中間ページURL /redirect_pages/<uid> を読む', () => {
    expect(parsePageUrl('https://x.test/redirect_pages/REDIRECT_0001')).toEqual({ kind: 'redirect', uid: 'REDIRECT_0001' })
  })
  it('uid だけでも読む。読めない物は null', () => {
    expect(parsePageUrl('Abc123xyz')).toEqual({ kind: 'page', uid: 'Abc123xyz' })
    expect(parsePageUrl('https://x.test/folders')).toBeNull()
    expect(parsePageUrl('')).toBeNull()
  })
})

describe('URLからページを探すAPI', () => {
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

  it('配信URLとプレビューURLのどちらからでも同じページが見つかる', async () => {
    const created = await postJson<{ ab_test: { uid: string }; version: { uid: string } }>(`${server.api}/ab_tests`, {
      title: 'サンプル施策001',
    })
    const pageUid = created.json.ab_test.uid
    const byLp = await fetch(`${server.api}/inspections/lookup?url=${encodeURIComponent(`https://x.test/lp/${pageUid}`)}`)
    expect(byLp.status).toBe(200)
    expect(((await byLp.json()) as { ab_test_uid: string }).ab_test_uid).toBe(pageUid)

    const byPreview = await fetch(
      `${server.api}/inspections/lookup?url=${encodeURIComponent(`https://x.test/preview/${created.json.version.uid}`)}`,
    )
    expect(((await byPreview.json()) as { ab_test_uid: string }).ab_test_uid).toBe(pageUid)
  })

  it('見つからなければ404（見当違いのページへ飛ばない）', async () => {
    const res = await fetch(`${server.api}/inspections/lookup?url=${encodeURIComponent('https://x.test/lp/nope')}`)
    expect(res.status).toBe(404)
    const bad = await fetch(`${server.api}/inspections/lookup?url=${encodeURIComponent('https://x.test/folders')}`)
    expect(bad.status).toBe(422)
  })
})

describe('審査は配信に影響しないと書く', () => {
  const src = readFileSync('src/app/pages/inspections-page.ts', 'utf8')
  it('「公開前のVersionを承認する」とは書かない', () => {
    expect(src).not.toContain('公開前のVersionを承認する')
  })
  it('非承認のVersionも配信されることを、閉じられない場所に書く', () => {
    expect(src).toContain('非承認のVersionも配信されます')
    expect(src).toContain('ins-delivery-note')
  })
})

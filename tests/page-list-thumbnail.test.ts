/**
 * ページ一覧の行の左に、そのページの画像を小さく出す（2026-10-27 本人「こんな感じにリデザインしたい」＋見本の画像）。
 * 出す画像は、最初のステップの、いちばん配信割合の大きい Version の最初の画像（ヘッダー画像があればそれ）。
 * 画像が無いページ・アドレスでない画像（data:）は null＝今までのページのしるし。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { addVersion, createAbTest } from '../mock-server/store/actions.ts'
import { relationCountsFor } from '../mock-server/store/relation-counts.ts'
import { getState, resetState, setState } from '../mock-server/store/store.ts'

function seed(htmlA: string, htmlB?: string, ratioB = 0): number {
  let id = 0
  setState((state) => {
    const created = createAbTest(state, { title: 'テスト', memo: '', folder_id: null, media_id: null })
    id = created.abTest.id
    let next = created.state
    next = { ...next, versions: next.versions.map((v) => (v.uid === created.version.uid ? { ...v, html: htmlA, distribution_ratio: 100 - ratioB } : v)) }
    if (htmlB !== undefined) {
      const added = addVersion(next, created.article.uid)
      const uid = added.version?.uid ?? ''
      next = { ...added.state, versions: added.state.versions.map((v) => (v.uid === uid ? { ...v, html: htmlB, distribution_ratio: ratioB } : v)) }
    }
    return next
  })
  return id
}

beforeEach(() => {
  resetState()
})

describe('ページ一覧のサムネ', () => {
  it('最初の画像を返す（アドレスの &amp; は戻す）', () => {
    const id = seed('<p>文</p><p><img src="/uploads/a.webp?x=1&amp;y=2"></p><p><img src="/uploads/b.webp"></p>')
    expect(relationCountsFor(getState(), id).thumbnail_url).toBe('/uploads/a.webp?x=1&y=2')
  })

  it('ヘッダー画像があれば、それを返す', () => {
    const id = seed('<!--header-image:/uploads/head.png--><p><img src="/uploads/a.webp"></p>')
    expect(relationCountsFor(getState(), id).thumbnail_url).toBe('/uploads/head.png')
  })

  it('いちばん配信割合の大きい Version の画像を返す', () => {
    const id = seed('<p><img src="/uploads/a.webp"></p>', '<p><img src="/uploads/main.webp"></p>', 70)
    expect(relationCountsFor(getState(), id).thumbnail_url).toBe('/uploads/main.webp')
  })

  it('画像が無い・data: の画像なら null', () => {
    expect(relationCountsFor(getState(), seed('<p>文だけ</p>')).thumbnail_url).toBeNull()
    expect(relationCountsFor(getState(), seed('<p><img src="data:image/png;base64,AAAA"></p>')).thumbnail_url).toBeNull()
  })
})

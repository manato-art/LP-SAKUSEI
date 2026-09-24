/**
 * 変更・復元履歴をファイルに残す（2026-09-24 全体点検3: デプロイのたびに履歴が消えていた）
 */
import { describe, expect, it } from 'vitest'
import { historiesFromFile, historiesToFile } from '../mock-server/store/article-history-file.ts'
import { articleKey, type ArticleHistoryState } from '../mock-server/store/article-history.ts'
import type { State } from '../mock-server/store/types.ts'

const article = { id: 1, uid: 'ARTICLE_1' }
const state = {
  articles: [article],
  versions: [{ uid: 'VERSION_1' }, { uid: 'VERSION_2' }],
} as unknown as State

const entry = (id: number, version: string, article_uid = 'ARTICLE_1') => ({
  id,
  article_uid,
  version_uid: version,
  html: `<p>${String(id)}</p>`,
  css: '',
  recorded_at: id,
  label: '編集',
})

describe('履歴のファイル', () => {
  it('書く形にはプロセスの中だけの印（article_key）を入れない', () => {
    const history: ArticleHistoryState = { entries: [{ ...entry(1, 'VERSION_1'), article_key: 'ARTICLE_1@9' }], nextId: 2 }
    const file = historiesToFile(history)
    expect(file.entries[0]).not.toHaveProperty('article_key')
    expect(file.nextId).toBe(2)
  })

  it('読み戻すときは今の記事に付け直し、消えた記事・Versionの分は捨てる', () => {
    const restored = historiesFromFile(
      { entries: [entry(1, 'VERSION_1'), entry(2, 'VERSION_2'), entry(3, 'VERSION_GONE'), entry(4, 'VERSION_1', 'ARTICLE_GONE')], nextId: 5 },
      state,
    )
    expect(restored.entries.map((e) => e.id)).toEqual([1, 2])
    expect(restored.entries.every((e) => e.article_key === articleKey(article as never))).toBe(true)
    expect(restored.nextId).toBe(5)
  })

  it('次の番号は、ファイルの番号と実際の最大の番号の大きい方から', () => {
    const restored = historiesFromFile({ entries: [entry(7, 'VERSION_1')], nextId: 3 }, state)
    expect(restored.nextId).toBe(8)
  })
})

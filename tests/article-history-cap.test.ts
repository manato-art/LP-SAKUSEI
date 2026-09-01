import { describe, it, expect } from 'vitest'
import {
  HISTORY_MAX_PER_ARTICLE,
  appendArticleHistory,
  describeHtmlChange,
  historiesOf,
  type ArticleHistoryState,
} from '../mock-server/store/article-history.ts'

/**
 * 変更履歴の上限（指示⑪「N件だけキャッシュ」）と操作ログ（「何をしたか」）。
 */
describe('describeHtmlChange: 何をしたかのログ', () => {
  it('初回は作成', () => {
    expect(describeHtmlChange(undefined, '<p>a</p>')).toBe('作成')
  })
  it('画像/動画の増減を検出', () => {
    expect(describeHtmlChange('<p>a</p>', '<p>a</p><img src="x">')).toBe('画像を追加')
    expect(describeHtmlChange('<p>a</p>', '<p>a</p><img src="x"><img src="y">')).toBe('画像を2枚追加')
    expect(describeHtmlChange('<img src="x">', '<p>a</p>')).toBe('画像を削除')
    expect(describeHtmlChange('<p>a</p>', '<p>a</p><video src="v"></video>')).toBe('動画を追加')
  })
  it('本文の増減を文字数で出す', () => {
    expect(describeHtmlChange('<p>ab</p>', '<p>abcde</p>')).toBe('本文 +3文字')
    expect(describeHtmlChange('<p>abcde</p>', '<p>ab</p>')).toBe('本文 -3文字')
  })
})

describe('appendArticleHistory: 上限で古い方から捨てる', () => {
  it(`1記事あたり ${HISTORY_MAX_PER_ARTICLE} 件を超えない（古い順に破棄）`, () => {
    let state: ArticleHistoryState = { entries: [], nextId: 1 }
    const total = HISTORY_MAX_PER_ARTICLE + 5
    for (let i = 0; i < total; i += 1) {
      const out = appendArticleHistory(state, {
        article_key: 'A@1',
        article_uid: 'ART',
        version_uid: 'V1',
        html: `<p>${i}</p>`, // 毎回内容を変える（同一はスキップされるため）
        css: '',
        recorded_at: 1000 + i,
      })
      state = out.state
      expect(out.recorded).toBe(true)
    }
    const mine = historiesOf(state, 'A@1')
    expect(mine.length).toBe(HISTORY_MAX_PER_ARTICLE)
    // 古い方（最初の5件）が捨てられ、最新が残る
    expect(mine[0]?.html).toBe(`<p>5</p>`)
    expect(mine.at(-1)?.html).toBe(`<p>${total - 1}</p>`)
  })

  it('別記事の履歴は上限計算に混ざらない', () => {
    let state: ArticleHistoryState = { entries: [], nextId: 1 }
    for (let i = 0; i < 3; i += 1) {
      state = appendArticleHistory(state, {
        article_key: 'B@2', article_uid: 'B', version_uid: 'V', html: `<p>b${i}</p>`, css: '', recorded_at: i,
      }).state
    }
    const out = appendArticleHistory(state, {
      article_key: 'A@1', article_uid: 'A', version_uid: 'V', html: '<p>a</p>', css: '', recorded_at: 9,
    })
    expect(historiesOf(out.state, 'B@2').length).toBe(3)
    expect(historiesOf(out.state, 'A@1').length).toBe(1)
    expect(out.history.label).toBe('作成')
  })
})

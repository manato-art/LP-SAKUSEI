/**
 * 本番URLを発行済みのページを消すときは、もう1回「本当に削除しますか？」と聞く
 * （2026-10-30 本人「発行済のページを削除しようとした際は、ほんとにいいですか？って警告を出して」）。
 */
import { describe, expect, it } from 'vitest'
import { issuedDeleteWarning } from '../src/app/pages/page-delete-warning.ts'

const URL = 'https://meguri.c1-news.test/lp/P1'

describe('発行済みのページを消すときの、2回目の警告', () => {
  it('発行前のページには出さない（まだ誰も見られないので、いつもの確認だけ）', () => {
    expect(issuedDeleteWarning({ title: 'めぐり', issued: false, ad_status: 'prepared' }, URL)).toBeNull()
  })

  it('発行済みなら「本当に削除しますか？」と、開けなくなる本番URLを出す（赤いボタン）', () => {
    const warning = issuedDeleteWarning({ title: 'めぐり', issued: true, ad_status: 'prepared' }, URL)
    expect(warning?.title).toBe('本当に削除しますか？')
    expect(warning?.message).toContain('「めぐり」')
    expect(warning?.message).toContain('本番URLを発行済み')
    expect(warning?.message).toContain(URL)
    expect(warning?.danger).toBe(true)
  })

  it('前からあるページ（発行の項目が無い）も発行済みとして聞く', () => {
    expect(issuedDeleteWarning({ title: '金谷味噌汁', ad_status: 'prepared' }, URL)).not.toBeNull()
  })

  it('配信中の札・最後に人が来た日があれば、それも見せて考えてもらう', () => {
    const warning = issuedDeleteWarning(
      { title: 'めぐり', issued: true, ad_status: 'delivered', last_visit_date: '2026-10-30' },
      URL,
    )
    expect(warning?.detail).toContain('配信中')
    expect(warning?.detail).toContain('2026-10-30')
  })
})

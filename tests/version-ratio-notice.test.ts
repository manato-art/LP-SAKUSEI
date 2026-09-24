/**
 * 配信割合の合計が100%でないときの知らせ（2026-09-24 全体点検34:
 * 50・50・50 にすると実際は3等分になるのに、何も出ていなかった）
 */
import { describe, expect, it } from 'vitest'
import { ratioNotice } from '../src/app/pages/version-ratio-notice.ts'

const v = (name: string, ratio: number, archived = false) => ({ name, distribution_ratio: ratio, archived })

describe('配信割合の知らせ', () => {
  it('合計が100%なら何も出さない', () => {
    expect(ratioNotice([v('A', 50), v('B', 50)])).toBeNull()
    expect(ratioNotice([v('A', 100), v('B', 0)])).toBeNull()
  })

  it('合計が100%でないときは、実際に出る割合を添えて知らせる（配信は合計で割って配る）', () => {
    expect(ratioNotice([v('A', 50), v('B', 50), v('C', 50)])).toBe(
      '配信割合の合計が150%です。実際は A 33%・B 33%・C 33% の割合で出ます。',
    )
  })

  it('アーカイブしたVersionは数えない', () => {
    expect(ratioNotice([v('A', 60), v('B', 40), v('C', 30, true)])).toBeNull()
  })

  it('全部0%なら、配信されないことを知らせる', () => {
    expect(ratioNotice([v('A', 0), v('B', 0)])).toBe('配信割合が1以上のVersionがありません。このステップは配信されません。')
  })
})

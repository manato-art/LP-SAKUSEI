/**
 * 消す・外す操作は、押した瞬間に実行せず確認カード（赤＝danger）を出す。
 *
 * 以前は次の操作が押した瞬間に実行されていた（誤タップで設定やデータが消えた）:
 *   メディア / 商品の削除、レポート除外の削除、Slackの連携解除、
 *   チャットワーク・LINE のトークン削除、異常のお知らせの送り先の「消す」、
 *   アクセス管理の許可メールアドレスの削除（チームメンバーの削除も同じ）
 * ソースを読んで、実行する呼び出しの直前に確認カードがあることを見張る。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const CASES: readonly { file: string; marker: string }[] = [
  { file: 'src/app/pages/media-page.ts', marker: 'api.deleteMedia(' },
  { file: 'src/app/pages/media-page.ts', marker: 'api.deleteProduct(' },
  { file: 'src/app/pages/report-exclusions.ts', marker: 'api.deleteReportExclusion(' },
  { file: 'src/app/panels/notify-target.ts', marker: 'api.disconnectSlack(' },
  { file: 'src/app/panels/notify-target.ts', marker: 'api.clearIntegration(' },
  { file: 'src/app/pages/alert-settings-section.ts', marker: 'rows.splice(' },
  { file: 'src/app/pages/account-settings.ts', marker: 'accountApi.deleteAllowedEmail(' },
  { file: 'src/app/pages/team-members.ts', marker: 'accountApi.deleteMember(' },
]

/** marker の直前（同じ操作の中）に confirmCard と danger: true があるか */
function guardedOccurrences(source: string, marker: string): { total: number; guarded: number } {
  let total = 0
  let guarded = 0
  let at = source.indexOf(marker)
  while (at >= 0) {
    total += 1
    const before = source.slice(Math.max(0, at - 900), at)
    const card = before.lastIndexOf('confirmCard(')
    if (card >= 0 && before.slice(card).includes('danger: true')) guarded += 1
    at = source.indexOf(marker, at + marker.length)
  }
  return { total, guarded }
}

describe('消す操作は確認カードを通す', () => {
  for (const { file, marker } of CASES) {
    it(`${file}: ${marker} の前に赤い確認カードがある`, () => {
      const { total, guarded } = guardedOccurrences(readFileSync(file, 'utf8'), marker)
      expect(total).toBeGreaterThan(0)
      expect(guarded).toBe(total)
    })
  }
})

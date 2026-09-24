/**
 * 一括タグの「CV条件」と「計測ツール・ASP」の説明。
 *
 * - 「CV条件」は保存されるだけで、配信にもCVの数え方にも一度も使われていなかった。
 *   CVの数え方はページごとの「CV条件」（基本情報・conversion_setting）が決めていて、
 *   一括タグ側の値がそれとどう関係するか（上書きか、既定か、複数の一括タグが違う値のときどうするか）が
 *   決まっていない → 推測で作らず、画面から外した（保存済みの値は消さない・要確認）
 * - 「計測ツール・ASP」の説明は「連携用パラメーターを自動で付与」とだけ書いていたが、
 *   実際に付くのは AFFILICODE のときの3つだけ（mock-server/routes/delivery.ts）。実装どおりに書く。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const page = readFileSync('src/app/pages/bulk-tags-page.ts', 'utf8')
const delivery = readFileSync('mock-server/routes/delivery.ts', 'utf8')

describe('一括タグの設定項目', () => {
  it('使われていない「CV条件」は出さず、保存もしない（保存済みの値は触らない）', () => {
    expect(page).not.toContain("fieldBlock('CV条件'")
    expect(page).not.toContain('cv_condition:')
  })

  it('ASPの説明は、AFFILICODEのときに付く3つだけを書く', () => {
    for (const param of ['squadbeyond_uid', 'sb_tracking=true', 'sb_article_uid']) {
      expect(page).toContain(param)
      expect(delivery).toContain(param)
    }
    expect(page).not.toContain('ASPを設定すると連携用パラメーターを自動で付与します')
  })
})

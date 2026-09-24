/**
 * ポップアップの中身を Widget編集の画面で開くときの、部品の設定データと名前（uid）（2026-09-24）。
 * DOM を使わない（テストは tests/popup-studio.test.ts）。
 *
 *  - 中身が空 → 白紙（右の「何から作りますか？」から選べる）
 *  - 部品で作った中身（外側に data-nc-data）→ その設定データ
 *  - プリセット・手書きのHTML → 見本の部品1つ（CSS も中に入れる。余白0・背景なしで、見え方は変えない）
 */
import { extractBuilderData, wrapHtmlAsBuilder } from './nocode/builder-data.ts'
import { BUILDER_TEMPLATE, blankBuilderData } from './nocode/templates/builder.ts'
import { newUid } from './nocode/templates/kit.ts'
import type { TemplateData } from './nocode/templates/types.ts'

export function popupStudioStart(html: string, css: string, title: string, now: Date): { data: TemplateData; uid: string } {
  const body = html.trim()
  const style = css.trim()
  if (body === '' && style === '') return { data: blankBuilderData(now), uid: newUid() }
  const found = extractBuilderData(html)
  if (found !== null) return found
  const whole = (style === '' ? '' : `<style>${style}</style>`) + html
  return { data: wrapHtmlAsBuilder(whole, title, BUILDER_TEMPLATE.defaults(now)), uid: newUid() }
}

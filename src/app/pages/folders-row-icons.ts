/**
 * ページ一覧の行のアイコン（Version / ステップ / ポップアップ / 中間ページ / CV）を実数にする（2026-09-24）。
 *
 * 以前は採取物の行の数字（Version 2 / ステップ 0 / ポップアップ 0 / 中間ページ 1 / CVタグ未設定）が
 * どのページにもそのまま出ていた。関連数（relation_counts）の値で書き換える。
 * 取れなかったときは、採取物の数字を残さず「-」にする（数字を発明しない）。
 *
 * CVの欄: このシステムからは「CVタグを貼ったか」は分からない。分かるのは
 * 「CVタグから成果が届いたことがあるか」なので、それをそのまま出す。
 */
import type { RelationCounts } from '../api.ts'

const ICON_COUNTS: readonly { testId: string; label: string; pick: (c: RelationCounts) => number }[] = [
  { testId: 'version-icon', label: 'Version数', pick: (c) => c.versions_count },
  { testId: 'funnel-icon', label: 'ステップ数（最初のステップを除く）', pick: (c) => c.funnel_steps_count },
  { testId: 'popup-icon', label: 'ポップアップ数（離脱防止＋追従型）', pick: (c) => c.popups_count },
  { testId: 'redirectPage-icon', label: '中間ページ数', pick: (c) => c.redirect_pages_count },
]

/** 採取物の行で、CVの文言が入っている要素 */
const CV_LABEL = '.ehlzdh00'

export const CV_LABEL_TEXT = {
  received: 'CV計測あり',
  none: 'CV未計測',
  unknown: 'CV -',
} as const

/** アイコンの隣の数字（テキストノード）だけを書き換える。アイコン自体は残す */
function setCount(holder: Element, text: string): void {
  const textNode = [...holder.childNodes].find((n) => n.nodeType === 3)
  if (textNode !== undefined) textNode.textContent = text
  else holder.append(text)
}

export function applyRowCounts(row: HTMLElement, counts: RelationCounts | null): void {
  for (const { testId, label, pick } of ICON_COUNTS) {
    const holder = row.querySelector(`[data-testid="${testId}"]`)?.parentElement ?? null
    if (holder === null) continue
    setCount(holder, counts === null ? '-' : String(pick(counts)))
    holder.setAttribute('title', label)
  }
  const cv = row.querySelector(CV_LABEL)
  if (cv !== null) {
    cv.textContent =
      counts === null ? CV_LABEL_TEXT.unknown : counts.has_conversion ? CV_LABEL_TEXT.received : CV_LABEL_TEXT.none
    cv.parentElement?.setAttribute(
      'title',
      'CVタグから成果が届いたことがあるか（タグを貼ったかどうかは、このシステムからは分かりません）',
    )
  }
}

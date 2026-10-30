/**
 * ポップアップの編集画面・一覧で使う小さな道具。編集画面では直している途中の形を draft と呼ぶ。
 *
 * DOM に触らない（テストで確かめられるように）。「保存」で送る項目は src/shared/popup-content.ts＋名前。
 * 保存したら、すぐ配信に出る（配信ONのとき・2026-10-31 本人「下書き反映・本番反映の操作はだるい」で下書きと本番をやめた）。
 * 配信のON/OFFと割合は、編集画面でも変えたその場で保存する。
 */
import type { ExitPopup, FollowPopup, PopupDeliveryVersion } from '../api-popups.ts'
import { EXIT_POPUP_CONTENT_KEYS, FOLLOW_POPUP_CONTENT_KEYS } from '../../shared/popup-content.ts'

const EXIT_DRAFT_KEYS = [...EXIT_POPUP_CONTENT_KEYS, 'name'] as const
const FOLLOW_DRAFT_KEYS = [...FOLLOW_POPUP_CONTENT_KEYS, 'name'] as const

type ExitDraftKey = (typeof EXIT_DRAFT_KEYS)[number]
type FollowDraftKey = (typeof FOLLOW_DRAFT_KEYS)[number]

function pick<T extends object, K extends keyof T>(item: T, keys: readonly K[]): Pick<T, K> {
  return Object.fromEntries(keys.filter((k) => k in item).map((k) => [k, item[k]])) as Pick<T, K>
}

function differs<T extends object>(a: T, b: T, keys: readonly (keyof T)[]): boolean {
  return keys.some((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
}

/** 「保存」で送る項目（中身・表示のきっかけ・位置・出し分け・リンク・名前） */
export function exitDraftPatch(draft: ExitPopup): Pick<ExitPopup, ExitDraftKey> {
  return pick(draft, EXIT_DRAFT_KEYS)
}

export function followDraftPatch(draft: FollowPopup): Pick<FollowPopup, FollowDraftKey> {
  return pick(draft, FOLLOW_DRAFT_KEYS)
}

/** 保存していない変更があるか（戻るときに確かめる） */
export function isExitDraftDirty(draft: ExitPopup, saved: ExitPopup): boolean {
  return differs(draft, saved, EXIT_DRAFT_KEYS)
}

export function isFollowDraftDirty(draft: FollowPopup, saved: FollowPopup): boolean {
  return differs(draft, saved, FOLLOW_DRAFT_KEYS)
}

/** 割合の説明（一覧・編集画面で同じ文） */
export const RATIO_HELP =
  '1回の表示で出すのは、この種類から1つだけ。割合が大きいほど出やすくなります。0%は出しません（全部0%なら、どれも出ません）'

/**
 * ポップアップを重ねて確かめるVersion（「LPの上に重ねて見る」と同じ＝最初のステップで配信の割合がいちばん大きいVersion）。
 * 無ければ null
 */
export function mainVersionUid(versions: readonly PopupDeliveryVersion[]): string | null {
  const firstStep = versions.filter((v) => v.step === 1)
  const main = [...firstStep].sort((a, b) => b.distribution_ratio - a.distribution_ratio)[0]
  return main?.uid ?? null
}

/** 「LPの上で確認」のURL（検証用のプレビューに、そのポップアップだけを出す・配信OFFでも） */
export function draftCheckUrl(versionUid: string, popupUid: string): string {
  return `/preview/${encodeURIComponent(versionUid)}?popup_draft=${encodeURIComponent(popupUid)}`
}

/** 「このVersionで配信」の選択肢の名前（ステップが2つ以上あるときだけ、何番目のステップかを付ける） */
export function popupDeliveryOptionLabel(version: PopupDeliveryVersion, hasSteps: boolean): string {
  return hasSteps ? `ステップ${version.step} / ${version.name}` : version.name
}

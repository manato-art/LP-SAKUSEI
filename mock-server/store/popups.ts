/**
 * ポップアップ（離脱防止・表示直後・追従型）の「下書き」と「本番」（2026-09-24・本人の決定「下書きと本番を分ける」）。
 *
 *   - 編集画面で直す項目（中身・表示のきっかけ・位置・出し分け・リンク）は、ポップアップの本体の項目＝下書き。
 *     「下書き反映」は下書きだけを書き換える（配信には出ない）。
 *   - 「本番反映」で、そのときの下書きを live に写す。配信は live だけを使う。
 *   - live が null ＝ 作ってからまだ一度も本番反映していない。配信しない（プリセット・新規・複製）。
 *   - live という項目が無い ＝ この仕組みより前に作ったポップアップ。本体の項目をそのまま本番として扱う（今までどおり配信）。
 *     最初に下書きを保存するときに、保存する前の本体の項目を live に写してから下書きを書き換える（足すだけ・配信は変わらない）。
 *   - 名前・配信のON/OFF・割合・種類（離脱防止/表示直後）は分けない。一覧からすぐ変えられる運用の項目。
 */
import type { ExitPopup, ExitPopupContent, FollowPopup, FollowPopupContent } from './types.ts'
import {
  EXIT_POPUP_CONTENT_KEYS,
  FOLLOW_POPUP_CONTENT_KEYS,
  type PopupPublishStatus,
} from '../../src/shared/popup-content.ts'

/** 本番に写す項目（画面と同じ並び・src/shared/popup-content.ts） */
export const EXIT_CONTENT_KEYS: readonly (keyof ExitPopupContent)[] = EXIT_POPUP_CONTENT_KEYS
export const FOLLOW_CONTENT_KEYS: readonly (keyof FollowPopupContent)[] = FOLLOW_POPUP_CONTENT_KEYS

export type { PopupPublishStatus }

function pick<T extends object, K extends keyof T>(item: T, keys: readonly K[]): Pick<T, K> {
  return Object.fromEntries(keys.filter((k) => k in item).map((k) => [k, item[k]])) as Pick<T, K>
}

/**
 * 本体に本番の中身を重ねる。本番に無い項目（古いデータに無かった項目）は、下書きの値を使わず「未設定」に戻す
 * （下書きで足した項目が本番へ漏れないように）
 */
function overlay<T extends object, K extends keyof T>(item: T, live: Pick<T, K>, keys: readonly K[]): T {
  return { ...item, ...Object.fromEntries(keys.map((k) => [k, live[k]])) }
}

function sameContent<T extends object>(a: T, b: T, keys: readonly (keyof T)[]): boolean {
  return keys.every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]))
}

/* ── 離脱防止・表示直後 ── */

/** 今の下書き（本体の項目） */
export function exitDraftOf(popup: ExitPopup): ExitPopupContent {
  return pick(popup, EXIT_CONTENT_KEYS)
}

/** 本番。null＝まだ本番反映していない。項目が無い古いポップアップは本体の項目が本番 */
export function exitLiveOf(popup: ExitPopup): ExitPopupContent | null {
  return popup.live === undefined ? exitDraftOf(popup) : popup.live
}

/** 下書きを書き換える前に呼ぶ。古いポップアップ（live が無い）は今の中身を本番として残す */
export function withExitLive(popup: ExitPopup): ExitPopup {
  return popup.live === undefined ? { ...popup, live: exitDraftOf(popup) } : popup
}

/** 本番反映: 今の下書きを本番に写す */
export function publishExitPopup(popup: ExitPopup): ExitPopup {
  return { ...popup, live: exitDraftOf(popup) }
}

export function exitPublishStatus(popup: ExitPopup): PopupPublishStatus {
  const live = exitLiveOf(popup)
  if (live === null) return 'unpublished'
  return sameContent({ ...exitDraftOf(popup) }, { ...live }, EXIT_CONTENT_KEYS) ? 'published' : 'changed'
}

/** 配信に使う形（本体の運用の項目＋本番の中身）。本番反映していなければ null */
export function deliveredExitPopup(popup: ExitPopup): ExitPopup | null {
  const live = exitLiveOf(popup)
  return live === null ? null : overlay(popup, live, EXIT_CONTENT_KEYS)
}

/** API で返す形（live は必ず入れる＝null か本番の中身・publish_status を足す） */
export function serializeExitPopup(popup: ExitPopup): Record<string, unknown> {
  return { ...popup, live: exitLiveOf(popup), publish_status: exitPublishStatus(popup) }
}

/* ── 追従型 ── */

export function followDraftOf(popup: FollowPopup): FollowPopupContent {
  return pick(popup, FOLLOW_CONTENT_KEYS)
}

export function followLiveOf(popup: FollowPopup): FollowPopupContent | null {
  return popup.live === undefined ? followDraftOf(popup) : popup.live
}

export function withFollowLive(popup: FollowPopup): FollowPopup {
  return popup.live === undefined ? { ...popup, live: followDraftOf(popup) } : popup
}

export function publishFollowPopup(popup: FollowPopup): FollowPopup {
  return { ...popup, live: followDraftOf(popup) }
}

export function followPublishStatus(popup: FollowPopup): PopupPublishStatus {
  const live = followLiveOf(popup)
  if (live === null) return 'unpublished'
  return sameContent({ ...followDraftOf(popup) }, { ...live }, FOLLOW_CONTENT_KEYS) ? 'published' : 'changed'
}

export function deliveredFollowPopup(popup: FollowPopup): FollowPopup | null {
  const live = followLiveOf(popup)
  return live === null ? null : overlay(popup, live, FOLLOW_CONTENT_KEYS)
}

export function serializeFollowPopup(popup: FollowPopup): Record<string, unknown> {
  return { ...popup, live: followLiveOf(popup), publish_status: followPublishStatus(popup) }
}

/** 複製の名前（元の名前＋「のコピー」） */
export function copyName(name: string): string {
  return `${name}のコピー`
}

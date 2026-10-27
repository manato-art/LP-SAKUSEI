/**
 * エディタの中身が「Quill の外」で変わった合図（2026-09-24 全体点検11）。
 *
 * 自動保存は Quill の text-change でしか動かないので、ヘッダー画像の出し入れや、
 * 文字間隔・行間のように DOM へ直接書く変更は保存されていなかった。
 * そうした変更をした所から `notifyEditorChanged` を呼ぶと、editor-layout.ts が受けて自動保存する。
 */
export const EDITOR_CHANGE_EVENT = 'lp-editor-change'

export function notifyEditorChanged(from: Element): void {
  from.dispatchEvent(new CustomEvent(EDITOR_CHANGE_EVENT, { bubbles: true }))
}

/**
 * 本文がまるごと別の中身に入れ替わった合図（Versionの切り替え・履歴から戻す等。2026-10-27）。
 * 入れ替えは Quill に知らせずに行う（自動保存を起こさない）ので、本文を見ているパネル（リンク置換の一覧）はこれで知る。
 * 保存はしない（EDITOR_CHANGE_EVENT とは別）。
 */
export const EDITOR_CONTENT_SHOWN_EVENT = 'lp-editor-content-shown'

export function notifyContentShown(from: Element): void {
  from.dispatchEvent(new CustomEvent(EDITOR_CONTENT_SHOWN_EVENT, { bubbles: true }))
}

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

/**
 * 右レール9番目「外部サーバー画像アップロード」（企画書 §9-1）。
 *
 * ⚠ 実物のこのモーダル（メディアライブラリのグリッド）は、自動操作で安定して開けず
 * **採取できていない**。実DOMが無いものを手書きで“似せる”のは本案件の禁じ手（§11）なので、
 * ここでは実物の見た目を真似ず、**ブラウザ標準のファイル選択**という明らかに別物の代替で
 * 「画像を実際に挿入できる」ところだけを担保する（プレビュー画面と同じ“正直な代替”の方針）。
 *
 * 本番サーバーへは一切上げない（§3-2）。選んだ画像はその場で dataURL にして、
 * エディタ（Quill）のカーソル位置へ挿入する＝クローン内で完結する。
 */
import type Quill from 'quill'
import { pickAndInsertMedia } from './media-insert.ts'

/** 右レールの並び: 8=外部サーバー画像アップロード */
export const EXTERNAL_IMAGE_TOOL_INDEX = 8

export function mountExternalImage(icon: HTMLElement, quill: Quill): void {
  if (icon.dataset['externalImageWired'] === 'true') return
  icon.dataset['externalImageWired'] = 'true'
  icon.style.cursor = 'pointer'
  icon.addEventListener('click', () => pickAndInsertMedia(quill))
}

/**
 * 右のパネルの外を押したら閉じる（2026-10-27 指示㉓ リンク置換・指示㉚ 履歴「リンク置換と同じように外を押したら閉じて」）。
 * パネルを開け閉めするアイコン（toggleAttr の印）を押したときは閉じない（押すと開け閉めするので、閉じてすぐ開き直してしまう）。
 * 見張りは画面の寿命で外す（page-life.ts・前の編集画面をつかみ続けない）
 */
import { pageLife } from '../page-life.ts'
import { PANEL_OPEN_CLASS } from './panel-group.ts'

export function wireOutsideClose(panel: HTMLElement, toggleAttr: string, onClose: () => void): void {
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (!panel.classList.contains(PANEL_OPEN_CLASS)) return
      const target = event.target
      if (!(target instanceof Node) || panel.contains(target)) return
      if (target instanceof Element && target.closest(`[${toggleAttr}]`) !== null) return
      onClose()
    },
    { capture: true, signal: pageLife() },
  )
}

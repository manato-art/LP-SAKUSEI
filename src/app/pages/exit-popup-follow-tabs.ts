/**
 * 追従型ポップアップの編集画面のタブ（2026-10-31 案A「3種類を同じ型に」・本人の選択「タブは今の5つに合わせる」）。
 *
 * 前は「表示設定」1つに移行先URL・表示位置・アニメーション・読んだら表示を全部入れていた。いまは離脱防止・表示直後と
 * 同じ5つのタブ（基本 / 表示 / 位置 / 出し分け / コード）・同じ並び（popup-editor-layout.ts の表）で、追従型で
 * 使えない設定は薄く出す。どのタブも直している途中の形（draft）を書き換えるだけで、保存は編集画面の「保存」。
 */
import type { FollowPopup } from '../api-popups.ts'
import { gridPlaceOfFollow } from './popup-lp-placer.ts'
import { labelOf, renderSettingsTab, type EditorTab, type SettingRenderers } from './popup-editor-layout.ts'
import { animationField, codeField, deviceField, positionField, scrollField, toggleRow, type PositionCell } from './popup-editor-parts.ts'
import { popupLinkField } from './popup-link-field.ts'

/** 追従型の配信で動くアニメーション（delivery-popup-html.ts） */
const FOLLOW_ANIMATIONS: readonly string[] = ['slideUp', 'slideDown', 'fade', 'none']

/** 「スクロールで表示」をオンにしたときの割合（0＝開いてすぐ出すなので、0からは始めない・離脱防止の初めと同じ） */
const SCROLL_START = 50

/** 9か所のうち、追従型が出せる所（上の帯・下の帯・左下・右下） */
const FOLLOW_CELLS: readonly { x: number; y: number; position: FollowPopup['position'] }[] = [
  { x: 50, y: 0, position: 'top' },
  { x: 0, y: 100, position: 'bottom-left' },
  { x: 50, y: 100, position: 'bottom' },
  { x: 100, y: 100, position: 'bottom-right' },
]
const followCellOf = (cell: { readonly x: number; readonly y: number }) => FOLLOW_CELLS.find((c) => c.x === cell.x && c.y === cell.y)

export function renderFollowTab(body: HTMLElement, draft: FollowPopup, tab: EditorTab): void {
  renderSettingsTab(body, tab, 'follow', renderersOf(draft, tab))
}

function renderersOf(draft: FollowPopup, tab: EditorTab): SettingRenderers {
  switch (tab) {
    case 'basic':
      return {
        // 移行先URL（帯のどこを押してもそこへ移る・指示44）。離脱防止・表示直後と同じ欄
        link: () =>
          popupLinkField({ url: draft.link_url, target: draft.link_target }, (link) => {
            draft.link_url = link.url
            draft.link_target = link.target
          }),
      }
    case 'display':
      return displayRenderers(draft)
    case 'position':
      return {
        position: () =>
          positionField({
            grid: gridPlaceOfFollow(draft.position),
            isFree: draft.free_position !== null,
            usable: (cell: PositionCell) => followCellOf(cell) !== undefined,
            // 上下は画面の幅いっぱいの帯
            wide: (cell) => cell.x === 50,
            onPick: (cell) => {
              const picked = followCellOf(cell)
              if (picked === undefined) return
              draft.position = picked.position
              draft.free_position = null
            },
            note: '追従型は、上・下・左下・右下のどれかに出します（上と下は画面の幅いっぱいの帯）',
          }),
      }
    case 'device':
      return { device: () => deviceField(draft) }
    case 'code':
      // 中身の HTML は「中身を編集」で直す（2026-09-24）。ここは動きの JavaScript と CSS
      return {
        code: () =>
          codeField('follow', {
            javascript: { get: () => draft.javascript, set: (v) => { draft.javascript = v } },
            css: { get: () => draft.css, set: (v) => { draft.css = v } },
          }),
      }
  }
}

function displayRenderers(draft: FollowPopup): SettingRenderers {
  // 「↓まで読んだら表示」の割合（オフ＝0＝開いてすぐ出す）。オフにする前の割合は、オンに戻したときに使う
  let lastPct = draft.show_after_scroll > 0 ? draft.show_after_scroll : SCROLL_START
  return {
    animation: () => animationField(FOLLOW_ANIMATIONS, draft.animation, (v) => { draft.animation = v }),
    scroll: () =>
      scrollField(draft.show_after_scroll > 0, lastPct, (on, pct) => {
        if (on) lastPct = pct
        draft.show_after_scroll = on ? lastPct : 0
      }),
    close_button: () => toggleRow(labelOf('close_button'), draft.show_close_button, (on) => { draft.show_close_button = on }),
  }
}

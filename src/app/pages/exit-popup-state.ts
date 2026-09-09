/**
 * ポップアップ画面の状態（exit-popup.ts から分離）。
 *
 * 画面を組み立てる関数がファイルをまたいで受け渡すので、
 * exit-popup.ts に置いたままだと import が循環する。
 *
 * `rerender` は「一覧を描き直す」1手。実体は exit-popup.ts の renderPanel だが、
 * 各ファイルから直接呼ぶと逆向きの import が要るので、state 経由で渡している。
 */
import type { ExitPopup, FollowPopup } from '../api.ts'

/** 現在のサブタブ */
export type SubTab = 'exit' | 'follow' | 'instant'
/** 指示176: ポップの種別を判定（未設定は 'exit' 扱い）。 */
export function popupKindOf(p: ExitPopup): 'exit' | 'instant' {
  return p.popup_kind === 'instant' ? 'instant' : 'exit'
}
/** 現在の表示状態 */
export interface PopupPageState {
  abTestUid: string
  folderUid: string
  popups: ExitPopup[]
  followPopups: FollowPopup[]
  deliveryEnabled: boolean
  editingPopup: ExitPopup | null
  activeSubTab: SubTab
  root: HTMLElement
  /** 一覧を描き直す。実体は exit-popup.ts の renderPanel */
  rerender: () => void
}

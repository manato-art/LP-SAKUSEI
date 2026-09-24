/**
 * ポップアップ（離脱防止・表示直後・追従型）のAPIと型（api.ts から分離・2026-09-24）。
 *
 * 下書きと本番を分けた（本人の決定）: 更新（PUT）は下書き、publish で本番に写す。配信は本番だけを使う。
 * 名前・割合・配信ON/OFF は下書きと本番に分けない（変えたらすぐ効く）。分ける項目は src/shared/popup-content.ts。
 */
import { request } from './api.ts'
import type {
  ExitPopupContentKey,
  FollowPopupContentKey,
  PopupPublishStatus,
} from '../shared/popup-content.ts'

export type { PopupPublishStatus }

/** 離脱ポップアップ（指示80） */
export interface ExitPopup {
  id: number
  uid: string
  ab_test_id: number
  name: string
  ratio: number
  enabled: boolean
  preset_id: string | null
  visit_count: string
  phone_number: string
  /** クリック時の遷移先URL（計測ON時は sb_tracking=true 付き・画像リンクと同じ規約） */
  link_url: string
  /** 遷移先を新しいタブで開くか（'_blank' / '_self'） */
  link_target: string
  /** 計測用URL（クリックでビーコン発火・複数可・画像の data-tracking-urls と同じ） */
  tracking_urls: string[]
  animation: string
  delay_seconds: number
  scroll_trigger: boolean
  scroll_position: number
  countdown_trigger: boolean
  countdown_seconds: number
  back_button_trigger: boolean
  exit_trigger: boolean
  position_x: number
  position_y: number
  device_sp: boolean
  device_tablet: boolean
  device_pc: boolean
  html: string
  javascript: string
  head_tag: string
  body_tag: string
  /** 指示176: ポップの種別。'exit'=離脱防止（既定・離脱意図で発動）/
   *  'instant'=表示直後（LPを開いた直後にオーバーレイ表示）。未設定は 'exit' 扱い。 */
  popup_kind?: 'exit' | 'instant'
  /** 指示172: ポップを触ったときの動作。'link'=遷移先URLへ移動（既定）/
   *  'close'=LPに戻る（ポップを閉じて元の位置へ・×と同じ）/ 'tel'=電話をかける（phone_number）。未設定は 'link' 扱い。 */
  link_action?: 'link' | 'close' | 'tel'
  /** 本番（配信に使う中身）。null＝まだ本番反映していない。上の項目は下書き（2026-09-24） */
  live: ExitPopupContent | null
  /** 本番との違い（まだ本番反映していない／下書きに変更がある／本番と同じ） */
  publish_status: PopupPublishStatus
}

/** 離脱防止ポップアップの、下書きと本番に分ける項目 */
export type ExitPopupContent = Pick<ExitPopup, ExitPopupContentKey>

/** 追尾型ポップアップ（指示85） */
export interface FollowPopup {
  id: number
  uid: string
  ab_test_id: number
  name: string
  enabled: boolean
  preset_id: string | null
  position: 'top' | 'bottom' | 'bottom-right' | 'bottom-left'
  show_after_scroll: number
  show_close_button: boolean
  animation: string
  device_sp: boolean
  device_tablet: boolean
  device_pc: boolean
  html: string
  javascript: string
  css: string
  /** 本番（配信に使う中身）。null＝まだ本番反映していない。上の項目は下書き（2026-09-24） */
  live: FollowPopupContent | null
  publish_status: PopupPublishStatus
}

/** 追従型ポップアップの、下書きと本番に分ける項目 */
export type FollowPopupContent = Pick<FollowPopup, FollowPopupContentKey>

/** ポップアップ画面の「このVersionで配信」の1行（Versionごと） */
export interface PopupDeliveryVersion {
  uid: string
  name: string
  /** 何番目のステップか（1始まり） */
  step: number
  distribution_ratio: number
  popup_delivery: boolean
}

export const popupApi = {
  /** 離脱ポップアップ一覧 */
  exitPopups: (abTestUid: string) =>
    request<{ exit_popups: ExitPopup[] }>('GET', `/ab_tests/${abTestUid}/exit_popups`),
  /** 離脱ポップアップ作成 */
  createExitPopup: (abTestUid: string, body: Partial<ExitPopup> & { name: string }) =>
    request<{ exit_popup: ExitPopup }>('POST', `/ab_tests/${abTestUid}/exit_popups`, body),
  /** 離脱ポップアップ更新（割合変更時は2個なら adjusted_siblings で相方の追従結果が返る） */
  updateExitPopup: (abTestUid: string, popupUid: string, patch: Partial<ExitPopup>) =>
    request<{
      exit_popup: ExitPopup
      adjusted_siblings?: ReadonlyArray<{ uid: string; ratio: number }>
    }>('PUT', `/ab_tests/${abTestUid}/exit_popups/${popupUid}`, patch),
  /** 離脱ポップアップ削除 */
  deleteExitPopup: (abTestUid: string, popupUid: string) =>
    request<void>('DELETE', `/ab_tests/${abTestUid}/exit_popups/${popupUid}`),
  /** 離脱ポップアップの本番反映（今の下書きを本番に写す） */
  publishExitPopup: (abTestUid: string, popupUid: string) =>
    request<{ exit_popup: ExitPopup }>('POST', `/ab_tests/${abTestUid}/exit_popups/${popupUid}/publish`),
  /** 離脱ポップアップの複製（下書きを写した別のポップアップ・本番反映するまで配信しない） */
  duplicateExitPopup: (abTestUid: string, popupUid: string, popupKind: 'exit' | 'instant') =>
    request<{ exit_popup: ExitPopup }>('POST', `/ab_tests/${abTestUid}/exit_popups/${popupUid}/duplicate`, {
      popup_kind: popupKind,
    }),
  /** 「このVersionで配信」: Versionごとのポップアップ配信のON/OFF */
  popupDelivery: (abTestUid: string) =>
    request<{ versions: PopupDeliveryVersion[] }>('GET', `/ab_tests/${abTestUid}/popup_delivery`),
  setPopupDelivery: (abTestUid: string, versionUid: string, enabled: boolean) =>
    request<{ version: PopupDeliveryVersion }>('PUT', `/ab_tests/${abTestUid}/popup_delivery/${versionUid}`, {
      enabled,
    }),

  /** 追尾型ポップアップ一覧 */
  followPopups: (abTestUid: string) =>
    request<{ follow_popups: FollowPopup[] }>('GET', `/ab_tests/${abTestUid}/follow_popups`),
  /** 追尾型ポップアップ作成 */
  createFollowPopup: (abTestUid: string, body: Partial<FollowPopup> & { name: string }) =>
    request<{ follow_popup: FollowPopup }>('POST', `/ab_tests/${abTestUid}/follow_popups`, body),
  /** 追尾型ポップアップ更新 */
  updateFollowPopup: (abTestUid: string, popupUid: string, patch: Partial<FollowPopup>) =>
    request<{ follow_popup: FollowPopup }>('PUT', `/ab_tests/${abTestUid}/follow_popups/${popupUid}`, patch),
  /** 追尾型ポップアップ削除 */
  deleteFollowPopup: (abTestUid: string, popupUid: string) =>
    request<void>('DELETE', `/ab_tests/${abTestUid}/follow_popups/${popupUid}`),
  /** 追尾型ポップアップの本番反映 */
  publishFollowPopup: (abTestUid: string, popupUid: string) =>
    request<{ follow_popup: FollowPopup }>('POST', `/ab_tests/${abTestUid}/follow_popups/${popupUid}/publish`),
  /** 追尾型ポップアップの複製（本番反映するまで配信しない） */
  duplicateFollowPopup: (abTestUid: string, popupUid: string) =>
    request<{ follow_popup: FollowPopup }>('POST', `/ab_tests/${abTestUid}/follow_popups/${popupUid}/duplicate`),
}

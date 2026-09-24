/**
 * ポップアップの「下書き」と「本番」に分ける項目（2026-09-24・本人の決定「下書きと本番を分ける」）。
 *
 * サーバー（mock-server/store/popups.ts＝本番へ写す・配信に使う）と画面（下書き反映で送る・保存していない変更があるか）で
 * 同じ並びを使う。ここに無い項目（名前・割合・配信ON/OFF・種類）は下書きと本番に分けず、変えたらすぐ効く。
 */

/** 離脱防止・表示直後 */
export const EXIT_POPUP_CONTENT_KEYS = [
  'visit_count',
  'phone_number',
  'link_url',
  'link_target',
  'tracking_urls',
  'animation',
  'delay_seconds',
  'scroll_trigger',
  'scroll_position',
  'countdown_trigger',
  'countdown_seconds',
  'back_button_trigger',
  'exit_trigger',
  'position_x',
  'position_y',
  'device_sp',
  'device_tablet',
  'device_pc',
  'html',
  'javascript',
  'head_tag',
  'body_tag',
  'link_action',
] as const

/** 追従型 */
export const FOLLOW_POPUP_CONTENT_KEYS = [
  'position',
  'show_after_scroll',
  'show_close_button',
  'animation',
  'device_sp',
  'device_tablet',
  'device_pc',
  'html',
  'javascript',
  'css',
] as const

export type ExitPopupContentKey = (typeof EXIT_POPUP_CONTENT_KEYS)[number]
export type FollowPopupContentKey = (typeof FOLLOW_POPUP_CONTENT_KEYS)[number]

/** 一覧・編集画面に出す「本番との違い」: まだ本番反映していない／下書きに本番へ出していない変更がある／本番と同じ */
export type PopupPublishStatus = 'unpublished' | 'changed' | 'published'

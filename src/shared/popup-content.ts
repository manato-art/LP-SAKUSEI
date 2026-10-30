/**
 * ポップアップの編集画面で直して「保存」で送る項目（保存していない変更があるかもこの並びで見る）。
 * ここに無い項目（名前・割合・配信ON/OFF・種類）は、変えたらすぐ効く。
 * 2026-09-24〜10-31 は下書きと本番に分けていた（本人「下書き反映・本番反映の操作はだるい」でやめた・mock-server/store/popups.ts）。
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
  'free_position',
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

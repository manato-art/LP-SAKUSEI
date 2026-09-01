/**
 * スプリットテスト設定6種の既定選択肢（企画書 §9-5）。
 * 「共通コンポーネント1つを使い回し、各ページで違うのは選択肢データのみ」という構造をここで表現する。
 * 実際の選択肢は採取後に capture/clean/ の値で置き換える（採取前の暫定値・docs/pages に「推測」明記）。
 */
import type { SplitTestRule, SplitTestType } from './types.ts'

function rule(key: string, label: string): SplitTestRule {
  // 既定は全対象オン（＝このVersionを全対象へ配信）。実物の初期状態（トグル全点灯）に合わせる。
  return { key, label, ratio: 0, enabled: true }
}

export const SPLIT_TEST_DEFAULTS: Readonly<Record<SplitTestType, readonly SplitTestRule[]>> = {
  // 画面の並び（スマートフォン / タブレット / デスクトップ）に合わせる（トグルは位置で対応づける）
  devices: [rule('sp', 'スマートフォン'), rule('tablet', 'タブレット'), rule('pc', 'デスクトップ')],
  oses: [
    rule('ios', 'iOS'),
    rule('android', 'Android'),
    rule('windows', 'Windows'),
    rule('mac', 'macOS'),
    rule('other', 'その他'),
  ],
  carriers: [
    rule('docomo', 'docomo'),
    rule('au', 'au'),
    rule('softbank', 'SoftBank'),
    rule('rakuten', '楽天モバイル'),
    rule('other', 'その他'),
  ],
  hours: Array.from({ length: 24 }, (_, h) => rule(String(h), `${h}時台`)),
  periods: [rule('weekday', '平日'), rule('weekend', '土日'), rule('holiday', '祝日')],
  params: [rule('utm_source', 'utm_source'), rule('utm_medium', 'utm_medium'), rule('custom', 'カスタムパラメータ')],
}

export const SPLIT_TEST_TYPES: readonly SplitTestType[] = [
  'devices',
  'oses',
  'carriers',
  'hours',
  'periods',
  'params',
]

export function isSplitTestType(value: string): value is SplitTestType {
  return (SPLIT_TEST_TYPES as readonly string[]).includes(value)
}

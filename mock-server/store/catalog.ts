/**
 * カタログ = アカウントの新旧に依らず存在する「選択肢」データ。
 *
 * 企画書 §10-5 は「Media（媒体）ロスターだけは選択肢として固定保持」と明記する。
 * 同じ性質のもの（アカウント発行直後でも画面に出るベンダー側マスタ）を
 * ユーザーデータ（新規＝0件）と分離してここに置く。
 * → docs/decisions.md D-002 に判断根拠を記載。反転したい場合はこのファイルを空にすればよい。
 */
import type { Addon, Media, Permission, Seminar, Introduction } from './types.ts'

/** 企画書 §10-5「媒体ロスター（固定）」 */
export const MEDIA_ROSTER: readonly Media[] = [
  { id: 1, name: 'Facebook', icon_name: 'fab fa-facebook', ad_cooperation: true },
  { id: 2, name: 'Instagram', icon_name: 'fab fa-instagram', ad_cooperation: true },
  { id: 3, name: 'LINE', icon_name: 'fab fa-line', ad_cooperation: true },
  { id: 4, name: 'TikTok', icon_name: 'fab fa-tiktok', ad_cooperation: true },
  { id: 5, name: 'Google', icon_name: 'fab fa-google', ad_cooperation: true },
  { id: 6, name: 'Yahoo', icon_name: 'fab fa-yahoo', ad_cooperation: true },
  { id: 7, name: 'X', icon_name: 'fab fa-x-twitter', ad_cooperation: true },
  { id: 8, name: 'その他', icon_name: 'fas fa-ellipsis-h', ad_cooperation: false },
] as const

/** 審査機関マスタ（/inspections/authorities） */
export const INSPECTION_AUTHORITIES: readonly string[] = [
  'サンプル審査機関A',
  'サンプル審査機関B',
  'サンプル審査機関C',
] as const

/** ASP名マスタ（外部連携の選択肢） */
export const ASP_ROSTER: readonly string[] = [
  'サンプルASP-01',
  'サンプルASP-02',
  'サンプルASP-03',
] as const

export const ADDON_CATALOG: readonly Addon[] = [
  { id: 1, uid: 'ADDON_0001', name: '追加ドメイン', price: 5000, enabled: false },
  { id: 2, uid: 'ADDON_0002', name: '追加シート', price: 3000, enabled: false },
  { id: 3, uid: 'ADDON_0003', name: 'ヒートマップ拡張', price: 10000, enabled: false },
] as const

export const PERMISSION_CATALOG: readonly Permission[] = [
  { id: 1, key: 'ab_test.create', label: 'beyondページの作成', granted: true },
  { id: 2, key: 'ab_test.delete', label: 'beyondページの削除', granted: true },
  { id: 3, key: 'folder.manage', label: 'フォルダの管理', granted: true },
  { id: 4, key: 'team.invite', label: 'メンバーの招待', granted: true },
  { id: 5, key: 'report.view', label: 'レポートの閲覧', granted: true },
  { id: 6, key: 'plan.manage', label: 'プランの変更', granted: false },
] as const

export const SEMINAR_CATALOG: readonly Seminar[] = [
  { id: 1, uid: 'SEMINAR_0001', title: 'サンプルセミナー：LP改善の基礎', held_at: '2026-09-10T10:00:00+09:00', url: '/seminar/1' },
  { id: 2, uid: 'SEMINAR_0002', title: 'サンプルセミナー：A/Bテスト設計', held_at: '2026-09-24T10:00:00+09:00', url: '/seminar/2' },
] as const

export const INTRODUCTION_CATALOG: readonly Introduction[] = [
  { id: 1, uid: 'INTRO_0001', title: 'サンプル紹介記事001', body: 'これは合成データです。' },
] as const

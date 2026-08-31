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
/**
 * 媒体ロスター（企画書 §10-5「固定」）。
 * **2026-08-31 の実機観測で実際は約65種あることが判明**したため、実測値に差し替えた
 * （企画書の8種は誤り。docs/findings-live-observation.md 参照）。
 * icon_name は実物のアイコン資産名が未採取のため、採取後に差し替える暫定値。
 */
export const MEDIA_ROSTER: readonly Media[] = [
  { id: 1, name: 'AdAsia', icon_name: 'media-1', ad_cooperation: true },
  { id: 2, name: 'AdAsia DSP', icon_name: 'media-2', ad_cooperation: true },
  { id: 3, name: 'AdCorsa', icon_name: 'media-3', ad_cooperation: true },
  { id: 4, name: 'Adwords', icon_name: 'media-4', ad_cooperation: true },
  { id: 5, name: 'AkaNe', icon_name: 'media-5', ad_cooperation: true },
  { id: 6, name: 'Amebaインフィード', icon_name: 'media-6', ad_cooperation: true },
  { id: 7, name: 'Bypass', icon_name: 'media-7', ad_cooperation: true },
  { id: 8, name: 'CO3', icon_name: 'media-8', ad_cooperation: true },
  { id: 9, name: 'Cirqua', icon_name: 'media-9', ad_cooperation: true },
  { id: 10, name: 'Evory', icon_name: 'media-10', ad_cooperation: true },
  { id: 11, name: 'ExAD', icon_name: 'media-11', ad_cooperation: true },
  { id: 12, name: 'Googleディスプレイ広告', icon_name: 'media-12', ad_cooperation: true },
  { id: 13, name: 'Googleデマンドジェネレーション広告', icon_name: 'media-13', ad_cooperation: true },
  { id: 14, name: 'Google検索広告', icon_name: 'media-14', ad_cooperation: true },
  { id: 15, name: 'Gunosy Ads', icon_name: 'media-15', ad_cooperation: true },
  { id: 16, name: 'Hike', icon_name: 'media-16', ad_cooperation: true },
  { id: 17, name: 'Instagram', icon_name: 'media-17', ad_cooperation: true },
  { id: 18, name: 'Kurashiru Ads', icon_name: 'media-18', ad_cooperation: true },
  { id: 19, name: 'LINE広告', icon_name: 'media-19', ad_cooperation: true },
  { id: 20, name: 'Locari', icon_name: 'media-20', ad_cooperation: true },
  { id: 21, name: 'Logicad', icon_name: 'media-21', ad_cooperation: true },
  { id: 22, name: 'Lucra', icon_name: 'media-22', ad_cooperation: true },
  { id: 23, name: 'Meta(旧Facebook)', icon_name: 'media-23', ad_cooperation: true },
  { id: 24, name: 'Meta(旧Facebook)ページ(非広告)', icon_name: 'media-24', ad_cooperation: false },
  { id: 25, name: 'MS-SymbolLockup', icon_name: 'media-25', ad_cooperation: true },
  { id: 26, name: 'Microsoft広告', icon_name: 'media-26', ad_cooperation: true },
  { id: 27, name: 'Mintegral', icon_name: 'media-27', ad_cooperation: true },
  { id: 28, name: 'NOIN', icon_name: 'media-28', ad_cooperation: true },
  { id: 29, name: 'Oct-pass', icon_name: 'media-29', ad_cooperation: true },
  { id: 30, name: 'Pangle', icon_name: 'media-30', ad_cooperation: true },
  { id: 31, name: 'Pinterest', icon_name: 'media-31', ad_cooperation: true },
  { id: 32, name: 'Qufooit', icon_name: 'media-32', ad_cooperation: true },
  { id: 33, name: 'RED', icon_name: 'media-33', ad_cooperation: true },
  { id: 34, name: 'RETE', icon_name: 'media-34', ad_cooperation: true },
  { id: 35, name: 'ReeMo', icon_name: 'media-35', ad_cooperation: true },
  { id: 36, name: 'SEO', icon_name: 'media-36', ad_cooperation: false },
  { id: 37, name: 'SNS', icon_name: 'media-37', ad_cooperation: false },
  { id: 38, name: 'ScaleOut', icon_name: 'media-38', ad_cooperation: true },
  { id: 39, name: 'Simeji', icon_name: 'media-39', ad_cooperation: true },
  { id: 40, name: 'SmartNews', icon_name: 'media-40', ad_cooperation: true },
  { id: 41, name: 'TRILL', icon_name: 'media-41', ad_cooperation: true },
  { id: 42, name: 'Taboola', icon_name: 'media-42', ad_cooperation: true },
  { id: 43, name: 'TikTok', icon_name: 'media-43', ad_cooperation: true },
  { id: 44, name: 'TopBuzzVideo', icon_name: 'media-44', ad_cooperation: true },
  { id: 45, name: 'UNIQUEST', icon_name: 'media-45', ad_cooperation: true },
  { id: 46, name: 'UZOU', icon_name: 'media-46', ad_cooperation: true },
  { id: 47, name: 'X(旧Twitter)', icon_name: 'media-47', ad_cooperation: true },
  { id: 48, name: 'X(旧Twitter)(非広告)', icon_name: 'media-48', ad_cooperation: false },
  { id: 49, name: 'Yahoo!ディスプレイ広告(新)', icon_name: 'media-49', ad_cooperation: true },
  { id: 50, name: 'Yahoo!ディスプレイ広告(旧)', icon_name: 'media-50', ad_cooperation: true },
  { id: 51, name: 'Yahoo!検索広告', icon_name: 'media-51', ad_cooperation: true },
  { id: 52, name: 'YouTube', icon_name: 'media-52', ad_cooperation: true },
  { id: 53, name: 'Zucks', icon_name: 'media-53', ad_cooperation: true },
  { id: 54, name: 'ameba インフィード', icon_name: 'media-54', ad_cooperation: true },
  { id: 55, name: 'docomo Ad Network', icon_name: 'media-55', ad_cooperation: true },
  { id: 56, name: 'fam', icon_name: 'media-56', ad_cooperation: true },
  { id: 57, name: '∞log', icon_name: 'media-57', ad_cooperation: true },
  { id: 58, name: 'ly', icon_name: 'media-58', ad_cooperation: true },
  { id: 59, name: 'maio', icon_name: 'media-59', ad_cooperation: true },
  { id: 60, name: 'poets', icon_name: 'media-60', ad_cooperation: true },
  { id: 61, name: 'popIn', icon_name: 'media-61', ad_cooperation: true },
  { id: 62, name: 'アイモバイル', icon_name: 'media-62', ad_cooperation: true },
  { id: 63, name: 'アウトブレイン', icon_name: 'media-63', ad_cooperation: true },
  { id: 64, name: 'フルアウト', icon_name: 'media-64', ad_cooperation: true },
  { id: 65, name: '媒体/ポストバックなし', icon_name: 'media-65', ad_cooperation: false },
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

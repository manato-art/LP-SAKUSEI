/**
 * LP作成者で入ったときに、画面に出すもの・出さないもの（2026-10-15 本人指定）。
 *
 * 使える: ページ一覧・ページの作成・Versionタブ・離脱防止ポップ・中間ページ・切り替え・基本情報（自分が作ったページだけ）
 * 使えない: 削除・数字（レポート・ヒートマップ・ダッシュボード・CV速報）・ツール・全体の設定
 * サーバーでも同じ範囲で断っている（mock-server/lib/creator-access.ts）。ここは見た目の側。
 */

/** LP作成者が開ける画面（ハッシュのパス） */
const CREATOR_ROUTES: readonly RegExp[] = [
  /^\/folders$/,
  /^\/ab_tests\/[^/]+\/articles$/,
  /^\/folders\/[^/]+\/ab_tests\/[^/]+\/edit$/,
  /^\/ab_tests\/[^/]+\/articles\/exit_popups$/,
  /^\/ab_tests\/[^/]+\/articles\/split_test_settings\/[^/]+$/,
  /^\/folders\/[^/]+\/ab_tests\/[^/]+\/redirect_pages$/,
  // マイページ（LP作成者には名前・メールとログアウトだけを出す）
  /^\/settings\/account$/,
]

export function isCreatorRoute(path: string): boolean {
  return CREATOR_ROUTES.some((route) => route.test(path))
}

/** サイドバーから外す項目（表示の文字。アコーディオンの中の項目も含む） */
export const CREATOR_HIDDEN_SIDEBAR_LABELS: readonly string[] = [
  'ダッシュボード',
  'タスク',
  'CV速報',
  'ツール',
  '一括タグ',
  'マジック置換',
  'メディア',
  '審査',
  '外部連携',
  '広告媒体連携',
  'CV計測連携',
  'ドメイン',
  'レポート除外',
  // 画面の色・明るさは全員で共通（変えるとほかの人の画面も変わる）なので、LP作成者には触らせない
  'テーマ',
  'ダークモード',
  // マイページと同じ画面が開くだけなので1つにする
  '設定',
]

/** スマホの下のメニューのうち、LP作成者に出すもの */
export function creatorBottomNavHrefs(items: readonly { href: string }[]): string[] {
  return items.filter((item) => isCreatorRoute(item.href.replace(/^#/, ''))).map((item) => item.href)
}

/** スマホの「その他」のうち、LP作成者に出すもの */
export function creatorMoreItemLabels(items: readonly { label: string; href: string }[]): string[] {
  return items
    .filter((item) => isCreatorRoute(item.href.replace(/^#/, '')) && !CREATOR_HIDDEN_SIDEBAR_LABELS.includes(item.label))
    .map((item) => item.label)
}

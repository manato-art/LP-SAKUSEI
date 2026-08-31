/**
 * サイドバーのフォルダ一覧の行を落とす。
 *
 * 一覧に並ぶのは顧客のフォルダ名そのもの＝実データ。
 * fixtures を採っていない経路（フォルダグループ）から描かれる名前もあり、
 * 辞書方式では取りこぼす（実際に実フォルダ名が1件そのまま残っていた）。
 *
 * クローンの基準は「新規の空アカウント」で、既存データは再現対象外。
 * よって**行の中身は落とし、枠（要素とクラス）は残す**。
 * 枠まで消すとレイアウトが変わり、土台として使えなくなる。
 */

/** 実物のサイドバーに常にある固定ナビ。ここに載っている語だけがマイクロコピー。 */
export const SIDEBAR_NAV_LABELS: readonly string[] = [
  'ダッシュボード',
  'AI',
  'タスク',
  'ページ',
  'CV速報',
  'ツール',
  '外部連携',
  'ドメイン',
  '拡張機能',
  'レポート除外',
  'イベント・セミナー',
  'ランキング',
  'お気に入り',
]

const MENU_ITEM = /(<(\w+)\b[^>]*data-testid="list-menu-item"[^>]*>)([\s\S]*?)(<\/\2>)/g
const TAGS = /<[^>]*>/g

function isNavLabel(inner: string): boolean {
  const text = inner.replace(TAGS, '').replace(/\s+/g, ' ').trim()
  if (text === '') return true
  return SIDEBAR_NAV_LABELS.some((label) => text === label || text.startsWith(label))
}

/** 固定ナビ以外の行から中身を取り除く。 */
export function dropFolderRows(html: string): string {
  return html.replace(MENU_ITEM, (whole, open: string, _tag: string, inner: string, close: string) =>
    isNavLabel(inner) ? whole : `${open}${close}`,
  )
}

/**
 * Widgetライブラリの保存先（widget-library.ts から分離）。
 *
 * 「自分で作ったWidget」と「お気に入り」をブラウザ内に持つ。
 * 保存先はこのブラウザだけで、サーバーには送らない。
 */

/** 自作Widget（「＋ Widgetを作成」で作ったもの）を保存する localStorage キー。 */
export const CREATED_WIDGETS_KEY = 'lp-sakusei:created-widgets'
export interface CreatedWidget {
  id: string
  name: string
  html: string
  ts: number
}
/** localStorage から自作Widget一覧を読む（壊れていれば空）。 */
export function loadCreatedWidgets(): CreatedWidget[] {
  try {
    const raw = localStorage.getItem(CREATED_WIDGETS_KEY)
    if (raw === null || raw === '') return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as CreatedWidget[]) : []
  } catch {
    return []
  }
}
/** 自作Widgetを1件保存する（先頭に追加・最大100件）。 */
export function saveCreatedWidget(name: string, html: string): void {
  try {
    const list = loadCreatedWidgets()
    list.unshift({ id: `cw_${Date.now().toString(36)}`, name, html, ts: Date.now() })
    localStorage.setItem(CREATED_WIDGETS_KEY, JSON.stringify(list.slice(0, 100)))
  } catch {
    /* localStorage 不可でも作成自体は続行 */
  }
}
/** 自作Widgetを1件削除する。 */
export function deleteCreatedWidget(id: string): void {
  try {
    const list = loadCreatedWidgets().filter((w) => w.id !== id)
    localStorage.setItem(CREATED_WIDGETS_KEY, JSON.stringify(list))
  } catch {
    /* no-op */
  }
}
/* ── お気に入り（指示157）──────────────────────────────────
 * カード左下の★でWidgetをお気に入り登録し、「お気に入り」カテゴリーで再利用できる。
 * 同一Widgetは「すべて」でもカテゴリー別でも同じ名前なので、名前をキーにして状態を共有する。 */
export const FAVORITE_WIDGETS_KEY = 'lp-sakusei:favorite-widgets'
export interface FavoriteWidget {
  key: string
  name: string
  html: string
  ts: number
}
export function loadFavorites(): FavoriteWidget[] {
  try {
    const raw = localStorage.getItem(FAVORITE_WIDGETS_KEY)
    if (raw === null || raw === '') return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as FavoriteWidget[]) : []
  } catch {
    return []
  }
}
export function isFavorite(key: string): boolean {
  return loadFavorites().some((f) => f.key === key)
}
/** お気に入りを切り替える。登録したら true、解除したら false を返す。 */
export function toggleFavorite(key: string, name: string, html: string): boolean {
  try {
    const list = loadFavorites()
    const idx = list.findIndex((f) => f.key === key)
    if (idx >= 0) {
      list.splice(idx, 1)
      localStorage.setItem(FAVORITE_WIDGETS_KEY, JSON.stringify(list))
      return false
    }
    list.unshift({ key, name, html, ts: Date.now() })
    localStorage.setItem(FAVORITE_WIDGETS_KEY, JSON.stringify(list.slice(0, 200)))
    return true
  } catch {
    return isFavorite(key)
  }
}

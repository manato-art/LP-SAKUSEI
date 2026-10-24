/**
 * Widgetライブラリの「作成したWidget」と「お気に入り」の置き場所（widget-library.ts から分離）。
 *
 * 2026-10-24 本人「僕のアカウントで作ったウィジェットが他のアカウントで見れない」で、ブラウザ（localStorage）から
 * サーバー（/widget_library・mock-server/store/widget-library.ts）へ移した。本人の選択:
 * - 作成したWidget … 全員（管理者もLP作成者も）で全部を共有。消せるのは管理者だけ
 * - お気に入り … アカウントごと（どのパソコンから入っても同じ）
 *
 * 画面はサーバーの中身を手元に写して使う（一覧を描くたびに待たないため）。ライブラリを開いたときに refreshWidgetLibrary で読み直す。
 * ブラウザに残っている以前の分は、このブラウザで一度だけサーバーへ移す（以前の分は控えとして消さない）。
 */
import { request } from '../api.ts'

export interface CreatedWidget {
  id: string
  name: string
  html: string
  ts: number
  /**
   * ノーコード（型・部品）で作ったときの元の入力（2026-09-22）。
   * これがあれば、あとでコードを見ずにフォームのまま直せる。コードで作ったものには無い。
   */
  source?: unknown
  /** Widget作成で選んだカテゴリー・説明文（2026-09-24） */
  category?: string
  description?: string
}

export interface FavoriteWidget {
  key: string
  name: string
  html: string
  ts: number
}

interface LibraryResponse {
  created: CreatedWidget[]
  favorites: FavoriteWidget[]
}

/** 以前ブラウザに持っていた所（読むだけ・サーバーへ移す元） */
const OLD_CREATED_KEY = 'lp-sakusei:created-widgets'
const OLD_FAVORITES_KEY = 'lp-sakusei:favorite-widgets'
/** このブラウザの以前の分をサーバーへ移し終えた印 */
const MOVED_KEY = 'lp-sakusei:widget-library-moved'

let created: readonly CreatedWidget[] = []
let favorites: readonly FavoriteWidget[] = []

function readOld(key: string): unknown[] {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null || raw === '') return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** このブラウザに残っている以前の分を、一度だけサーバーへ移す。移せなかったら印を付けない（次に開いたときにまた移す） */
async function moveOldOnce(): Promise<void> {
  try {
    if (localStorage.getItem(MOVED_KEY) === '1') return
  } catch {
    return
  }
  const oldCreated = readOld(OLD_CREATED_KEY)
  const oldFavorites = readOld(OLD_FAVORITES_KEY)
  try {
    if (oldCreated.length > 0 || oldFavorites.length > 0) {
      await request('POST', '/widget_library/import', { created: oldCreated, favorites: oldFavorites })
    }
    localStorage.setItem(MOVED_KEY, '1')
  } catch (error) {
    console.error('[widget-library] ブラウザに残っていたWidgetをサーバーへ移せませんでした。次に開いたときにまた移します。', error)
  }
}

/** サーバーから読み直す（ライブラリを開いたとき・一覧を出すとき）。読めなければエラー（呼ぶ側が知らせる） */
export async function refreshWidgetLibrary(): Promise<void> {
  await moveOldOnce()
  const out = await request<LibraryResponse>('GET', '/widget_library')
  created = out.created
  favorites = out.favorites
}

/** 作成したWidget（全員の分・新しいものが先頭）。最後に読み直したときの中身 */
export function loadCreatedWidgets(): CreatedWidget[] {
  return [...created]
}

/**
 * 作成したWidgetを1件保存する（全員の一覧の先頭に入る）。保存できたかを返す。
 * 通らなかったとき（大きすぎる・つながらない）は false＝呼ぶ側が知らせる（作ったつもりで一覧に無い、を黙ってやらない）。
 */
export async function saveCreatedWidget(
  name: string,
  html: string,
  source?: unknown,
  meta: { readonly category?: string; readonly description?: string } = {},
): Promise<boolean> {
  const category = (meta.category ?? '').trim()
  const description = (meta.description ?? '').trim()
  try {
    const out = await request<{ widget: CreatedWidget }>('POST', '/widget_library/created', {
      name,
      html,
      ...(source === undefined ? {} : { source }),
      ...(category === '' ? {} : { category }),
      ...(description === '' ? {} : { description }),
    })
    created = [out.widget, ...created]
    return true
  } catch (error) {
    console.error('[widget-library] 作成したWidgetを保存できませんでした。', error)
    return false
  }
}

/** 作成したWidgetを1件消す（管理者だけ）。消せたかを返す */
export async function deleteCreatedWidget(id: string): Promise<boolean> {
  try {
    await request<void>('DELETE', `/widget_library/created/${encodeURIComponent(id)}`)
    created = created.filter((w) => w.id !== id)
    return true
  } catch (error) {
    console.error('[widget-library] 作成したWidgetを消せませんでした。', error)
    return false
  }
}

/* ── お気に入り（指示157・2026-10-24 からアカウントごとにサーバーへ）──────────
 * カード左下の★でWidgetをお気に入り登録し、「お気に入り」カテゴリーで再利用できる。
 * 同一Widgetは「すべて」でもカテゴリー別でも同じ名前なので、名前をキーにして状態を共有する。 */

/** 自分のお気に入り。最後に読み直したときの中身 */
export function loadFavorites(): FavoriteWidget[] {
  return [...favorites]
}

export function isFavorite(key: string): boolean {
  return favorites.some((f) => f.key === key)
}

/** お気に入りを切り替える。付けたら true、外したら false。通らなければエラー（呼ぶ側が知らせる） */
export async function toggleFavorite(key: string, name: string, html: string): Promise<boolean> {
  const out = await request<{ favorite: boolean; favorites: FavoriteWidget[] }>('POST', '/widget_library/favorites/toggle', {
    key,
    name,
    html,
  })
  favorites = out.favorites
  return out.favorite
}

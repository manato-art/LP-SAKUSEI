/**
 * 「作成したWidget」と「お気に入り」（2026-10-24 本人「僕のアカウントで作ったウィジェットが他のアカウントで見れない」）。
 *
 * 以前はどちらも作った人のブラウザ（localStorage）だけにあった。本人の選択:
 * - 作成したWidget … 全員（管理者もLP作成者も）で全部を共有。消せるのは管理者だけ（lib/creator-access.ts が LP作成者の DELETE を断る）
 * - お気に入り … アカウントごと（`admin:<メール>` / `creator:<uid>`）
 *
 * State とは別に `${DATA_DIR}/widget-library.json` へ保存する（creator-accounts.ts と同じ。state.json の写しに混ぜない）。
 * 埋め込みの画像（data URL）は呼ぶ側（routes/widget-library.ts）でファイルにしてから渡す。
 */
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface CreatedWidget {
  id: string
  name: string
  html: string
  ts: number
  /** 型・部品で作ったときの元の入力（あとでノーコードのまま直す） */
  source?: unknown
  category?: string
  description?: string
}

export interface FavoriteWidget {
  key: string
  name: string
  html: string
  ts: number
}

export type CreatedWidgetResult =
  | { ok: true; widget: CreatedWidget }
  | { ok: false; code: 'validation_failed'; message: string }

const CREATED_MAX = 500
const FAVORITES_MAX = 200
const NAME_MAX = 80
const HTML_MAX = 3_000_000
const META_MAX = 200

interface Library {
  created: readonly CreatedWidget[]
  favorites: Readonly<Record<string, readonly FavoriteWidget[]>>
}

const EMPTY: Library = { created: [], favorites: {} }

const DATA_DIR = process.env['DATA_DIR']
const FILE = DATA_DIR !== undefined && DATA_DIR !== '' ? join(DATA_DIR, 'widget-library.json') : null

let library: Library = EMPTY

function loadFromDisk(): void {
  if (FILE === null || !existsSync(FILE)) return
  try {
    const raw = JSON.parse(readFileSync(FILE, 'utf8')) as Partial<Library>
    library = {
      created: Array.isArray(raw.created) ? raw.created : [],
      favorites: raw.favorites !== null && typeof raw.favorites === 'object' ? raw.favorites : {},
    }
  } catch {
    console.error('[widget-library] ファイルの読み込みに失敗しました。作成したWidget・お気に入りは0件で始めます。')
  }
}

function saveToDisk(): void {
  if (FILE === null) return
  try {
    if (DATA_DIR !== undefined && DATA_DIR !== '' && !existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
    writeFileSync(FILE, JSON.stringify(library))
  } catch {
    console.error('[widget-library] ファイルの保存に失敗しました。')
  }
}

loadFromDisk()

const text = (value: unknown): string => (typeof value === 'string' ? value : '')
const shortText = (value: unknown): string | undefined => {
  const t = text(value).trim().slice(0, META_MAX)
  return t === '' ? undefined : t
}

export function listCreatedWidgets(): CreatedWidget[] {
  return [...library.created]
}

/** 入力を確かめて、保存する形にする（id・時刻は渡されたものを使う＝ブラウザから移すときは元の id を残す） */
function toCreatedWidget(input: Record<string, unknown>, id: string, ts: number): CreatedWidgetResult {
  const name = text(input['name']).trim()
  const html = text(input['html'])
  if (name === '') return { ok: false, code: 'validation_failed', message: '名前を入れてください。' }
  if (name.length > NAME_MAX) return { ok: false, code: 'validation_failed', message: `名前は${NAME_MAX}文字以内にしてください。` }
  if (html.trim() === '') return { ok: false, code: 'validation_failed', message: 'Widgetの中身が空です。' }
  if (html.length > HTML_MAX) return { ok: false, code: 'validation_failed', message: 'Widgetが大きすぎて保存できません。' }
  const category = shortText(input['category'])
  const description = shortText(input['description'])
  const source = input['source']
  return {
    ok: true,
    widget: {
      id,
      name,
      html,
      ts,
      ...(source === undefined || source === null ? {} : { source }),
      ...(category === undefined ? {} : { category }),
      ...(description === undefined ? {} : { description }),
    },
  }
}

const newId = (): string => `cw_${Date.now().toString(36)}${randomBytes(3).toString('hex')}`

export function addCreatedWidget(input: Record<string, unknown>): CreatedWidgetResult {
  const out = toCreatedWidget(input, newId(), Date.now())
  if (!out.ok) return out
  library = { ...library, created: [out.widget, ...library.created].slice(0, CREATED_MAX) }
  saveToDisk()
  return out
}

export function deleteCreatedWidget(id: string): boolean {
  if (!library.created.some((w) => w.id === id)) return false
  library = { ...library, created: library.created.filter((w) => w.id !== id) }
  saveToDisk()
  return true
}

export function listFavorites(account: string): FavoriteWidget[] {
  return [...(library.favorites[account] ?? [])]
}

/** お気に入りを切り替える。付けたら true、外したら false */
export function toggleFavorite(account: string, input: { key: string; name: string; html: string }): boolean {
  const list = library.favorites[account] ?? []
  const on = !list.some((f) => f.key === input.key)
  const next = on
    ? [{ key: input.key, name: input.name, html: input.html, ts: Date.now() }, ...list].slice(0, FAVORITES_MAX)
    : list.filter((f) => f.key !== input.key)
  library = { ...library, favorites: { ...library.favorites, [account]: next } }
  saveToDisk()
  return on
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/**
 * ブラウザに残っていた分をサーバーへ移す。作成したWidgetは全員の一覧へ（同じ id は入れない）、
 * お気に入りはそのアカウントへ（同じ key は入れない）。形の崩れたものは飛ばす。入れた数を返す
 */
export function importLocalLibrary(account: string, local: { created: unknown; favorites: unknown }): { created: number; favorites: number } {
  const known = new Set(library.created.map((w) => w.id))
  const created: CreatedWidget[] = []
  for (const item of Array.isArray(local.created) ? local.created : []) {
    if (!isRecord(item)) continue
    const id = text(item['id'])
    if (id === '' || known.has(id)) continue
    const ts = typeof item['ts'] === 'number' ? item['ts'] : Date.now()
    const out = toCreatedWidget(item, id, ts)
    if (!out.ok) continue
    known.add(id)
    created.push(out.widget)
  }
  const mine = library.favorites[account] ?? []
  const keys = new Set(mine.map((f) => f.key))
  const favorites: FavoriteWidget[] = []
  for (const item of Array.isArray(local.favorites) ? local.favorites : []) {
    if (!isRecord(item)) continue
    const key = text(item['key'])
    const html = text(item['html'])
    if (key === '' || html === '' || keys.has(key)) continue
    keys.add(key)
    favorites.push({ key, name: text(item['name']) || key, html, ts: typeof item['ts'] === 'number' ? item['ts'] : Date.now() })
  }
  if (created.length > 0 || favorites.length > 0) {
    library = {
      created: [...library.created, ...created].sort((a, b) => b.ts - a.ts).slice(0, CREATED_MAX),
      favorites: { ...library.favorites, [account]: [...mine, ...favorites].slice(0, FAVORITES_MAX) },
    }
    saveToDisk()
  }
  return { created: created.length, favorites: favorites.length }
}

/** テスト用: 空に戻す（ファイルには書かない） */
export function resetWidgetLibraryForTest(): void {
  library = EMPTY
}

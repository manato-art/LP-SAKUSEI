/**
 * 一覧応答契約（企画書 §10-6）。「触れるが効かない」を禁止するため、
 * ページング・ソート・フィルタ・検索・日付範囲は必ずここで実際に適用する。
 */
import { toDateKey } from '../store/metrics.ts'

export const DEFAULT_PER_PAGE = 20
export const DEFAULT_RANGE_DAYS = 7

export type QueryValue = string | undefined
export type Query = Record<string, unknown>

function firstString(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return undefined
}

export function str(query: Query, key: string): string | undefined {
  const raw = firstString(query[key])
  return raw === undefined || raw === '' ? undefined : raw
}

export function num(query: Query, key: string): number | undefined {
  const raw = str(query, key)
  if (raw === undefined) return undefined
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function bool(query: Query, key: string): boolean | undefined {
  const raw = str(query, key)
  if (raw === undefined) return undefined
  if (raw === 'true' || raw === '1') return true
  if (raw === 'false' || raw === '0') return false
  return undefined
}

export interface PageParams {
  perPage: number
  page: number
}

/** `per_page`(既定20) / `page` または `current_page` を受理（§10-6） */
export function pageParams(query: Query): PageParams {
  const perPage = num(query, 'per_page') ?? DEFAULT_PER_PAGE
  const page = num(query, 'page') ?? num(query, 'current_page') ?? 1
  return {
    perPage: perPage > 0 ? Math.floor(perPage) : DEFAULT_PER_PAGE,
    page: page > 0 ? Math.floor(page) : 1,
  }
}

export function paginate<T>(items: readonly T[], { perPage, page }: PageParams): T[] {
  const start = (page - 1) * perPage
  return items.slice(start, start + perPage)
}

export type SortDirection = 'asc' | 'desc'

export interface SortParams {
  key: string | undefined
  direction: SortDirection
}

/**
 * ソート規約はエンドポイントごとに違う（§10-6）:
 *   汎用一覧 / `/ab_tests/rankings` … `sort` & `sort_direction`
 *   `/teams/version-rankings`(workers) … `sort_by` & `sort_order`
 * 各エンドポイントは自分の規約だけを honor する。
 */
export function sortParams(query: Query, convention: 'sort' | 'sort_by' = 'sort'): SortParams {
  const key = convention === 'sort' ? str(query, 'sort') : str(query, 'sort_by')
  const rawDir =
    convention === 'sort' ? str(query, 'sort_direction') : str(query, 'sort_order')
  return { key, direction: rawDir === 'asc' ? 'asc' : rawDir === 'desc' ? 'desc' : 'desc' }
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : -1
  if (b === null || b === undefined) return 1
  return String(a).localeCompare(String(b), 'ja')
}

/** 任意オブジェクトからフィールドを安全に読む（interface は index signature を持たないため） */
function field(item: object, key: string): unknown {
  return (item as Record<string, unknown>)[key]
}

/** allowedKeys にあるキーだけでソートする（外部入力を信用しない・§12 入力バリデーション） */
export function sortItems<T extends object>(
  items: readonly T[],
  { key, direction }: SortParams,
  allowedKeys: readonly string[],
): T[] {
  if (key === undefined || !allowedKeys.includes(key)) return [...items]
  const sorted = [...items].sort((a, b) => compare(field(a, key), field(b, key)))
  return direction === 'asc' ? sorted : sorted.reverse()
}

/** `q` / `keyword` の部分一致（title/name/memo・§10-6） */
export function searchItems<T extends object>(
  items: readonly T[],
  query: Query,
  fields: readonly string[] = ['title', 'name', 'memo'],
): T[] {
  const needle = (str(query, 'q') ?? str(query, 'keyword'))?.toLowerCase()
  if (needle === undefined) return [...items]
  return items.filter((item) =>
    fields.some((name) => {
      const value = field(item, name)
      return typeof value === 'string' && value.toLowerCase().includes(needle)
    }),
  )
}

/**
 * フィルタ（§10-6）。クエリに来た項目だけ実際に絞り込む。
 * 例 filterItems(rows, query, { media_id: 'media_id', published: 'published' })
 */
export function filterItems<T extends object>(
  items: readonly T[],
  query: Query,
  mapping: Readonly<Record<string, string>>,
): T[] {
  return Object.entries(mapping).reduce<T[]>((acc, [queryKey, name]) => {
    const raw = str(query, queryKey)
    if (raw === undefined) return acc
    const asBool = bool(query, queryKey)
    return acc.filter((item) => {
      const value = field(item, name)
      if (typeof value === 'boolean' && asBool !== undefined) return value === asBool
      return String(value) === raw
    })
  }, [...items])
}

export interface DateRangeParams {
  startDate: string
  endDate: string
}

/** `start_date`/`end_date`。未指定は既定期間（過去7日・§10-6） */
export function dateRangeParams(query: Query, today: Date = new Date()): DateRangeParams {
  const end = str(query, 'end_date') ?? toDateKey(today)
  const fallbackStart = new Date(today)
  fallbackStart.setDate(fallbackStart.getDate() - (DEFAULT_RANGE_DAYS - 1))
  const start = str(query, 'start_date') ?? toDateKey(fallbackStart)
  return start <= end ? { startDate: start, endDate: end } : { startDate: end, endDate: start }
}

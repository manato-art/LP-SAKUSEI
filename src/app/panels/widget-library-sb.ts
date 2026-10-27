/**
 * Widget一覧の「SquadBeyond」（2026-10-26 本人「SquadBeyondのものを戻して、1個1個SB本体のLPに入れて動きを確かめて再現して」）。
 *
 * 中身は SB本体の Widget一覧（html_parts）から取ったまま（架空への置き換えはしない・画像は /uploads に写してある）。
 * LP に入れる形は SB本体と同じ（sb-custom-part で包み、CSS をその Widget の中だけに効くよう囲う・sb-widget-scope.ts）。
 * サーバーの /sb_widgets から分類を、/sb_widgets/:id からその分類の Widget を読む（読んだ分は覚えておく）。
 * 画面に出す部分は widget-library.ts（カードの形・プレビュー・追加は自作の見本と同じ仕組み）。
 */
import { request } from '../api.ts'

export interface SbCategory {
  readonly id: number
  readonly name: string
  readonly count: number
}

export interface SbPart {
  readonly id: number
  readonly name: string
  readonly html: string
  readonly css: string
}

/** 一度に出すカードの数（1つの分類に最大280件・全部を一度に出すと重い） */
export const SB_PAGE_SIZE = 24

/** pages 回ぶん出したときに出ている分（はじめの1回で24件・0回なら0件） */
export function visibleSbParts(parts: readonly SbPart[], pages: number): readonly SbPart[] {
  return parts.slice(0, SB_PAGE_SIZE * Math.max(0, pages))
}

/** 検索に合う分（その分類の全件から・大文字小文字を区別しない） */
export function matchingSbParts(parts: readonly SbPart[], query: string): readonly SbPart[] {
  const q = query.trim().toLowerCase()
  return q === '' ? parts : parts.filter((part) => part.name.toLowerCase().includes(q))
}

let categories: Promise<readonly SbCategory[]> | null = null
const partsById = new Map<number, Promise<readonly SbPart[]>>()

/** 分類（読めなかったら次に開いたときに読み直す） */
export function loadSbCategories(): Promise<readonly SbCategory[]> {
  categories ??= request<{ categories: SbCategory[] }>('GET', '/sb_widgets').then(
    (out) => out.categories,
    (error: unknown) => {
      categories = null
      throw error
    },
  )
  return categories
}

/** その分類の Widget（読めなかったら次に選んだときに読み直す） */
export function loadSbParts(id: number): Promise<readonly SbPart[]> {
  const cached = partsById.get(id)
  if (cached !== undefined) return cached
  const loading = request<{ parts: SbPart[] }>('GET', `/sb_widgets/${id}`).then(
    (out) => out.parts,
    (error: unknown) => {
      partsById.delete(id)
      throw error
    },
  )
  partsById.set(id, loading)
  return loading
}

/** 全部の分類から名前で探した結果（合う物の先頭60件と、合う数） */
export interface SbSearch {
  readonly parts: readonly SbPart[]
  readonly total: number
}

/** 取り込んだ見本を全部の分類から名前で探す（2026-10-27 指示㉕・サーバーが探す＝全部を読まない） */
export function searchSbParts(query: string): Promise<SbSearch> {
  return request<SbSearch>('GET', `/sb_widgets/search?q=${encodeURIComponent(query.trim())}`)
}

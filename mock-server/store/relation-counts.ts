/**
 * ページ一覧の行のアイコンと右パネルの件数（2026-09-24）。
 *
 * 以前は 中間ページ数が常に0（ファネルのステップと取り違えていた）、ポップアップは離脱防止だけを数え、
 * 行のアイコンは採取物の数字（Version 2 / ステップ 0 / ポップアップ 0 / 中間ページ 1 / CVタグ未設定）のままだった。
 *
 *   versions_count        … そのページの Version（アーカイブも含む・今までと同じ数え方）
 *   funnel_steps_count    … 追加したステップの数。最初のステップ（家アイコン）はページそのものなので数えない
 *                           （採取物でも「ステップ 0」が既定）。アーカイブしたステップは数えない
 *   exit_popups_count / follow_popups_count / popups_count … 離脱防止・追従型・その合計
 *   redirect_pages_count  … そのページの中間ページ
 *   has_conversion        … CVタグから成果が届いたことがあるか（タグを貼ったかどうかは、このシステムからは分からない）
 *   thumbnail_url         … 行の左に出す画像（2026-10-27 一覧の作り直し）。最初のステップの、いちばん配信割合の大きい Version の
 *                           最初の画像（ヘッダー画像があればそれ）。無い・アドレスでない（data:）なら null
 */
import type { State } from './types.ts'

export interface RelationCounts {
  id: number
  versions_count: number
  funnel_steps_count: number
  exit_popups_count: number
  follow_popups_count: number
  popups_count: number
  redirect_pages_count: number
  has_conversion: boolean
  ab_test_uid: string | null
  thumbnail_url: string | null
}

const HEADER_IMAGE = /<!--header-image:([^>]*?)-->/
const IMG_SRC = /<img\b[^>]*?\bsrc="([^"]+)"/i

/** 行の左に出す画像（無ければ null） */
function pageThumbnail(state: State, abTestId: number): string | null {
  const firstStep = state.articles
    .filter((a) => a.ab_test_id === abTestId && !a.archived)
    .reduce<State['articles'][number] | undefined>((first, a) => (first === undefined || a.id < first.id ? a : first), undefined)
  if (firstStep === undefined) return null
  const main = state.versions
    .filter((v) => v.article_id === firstStep.id && !v.archived)
    .reduce<State['versions'][number] | undefined>((best, v) => (best === undefined || v.distribution_ratio > best.distribution_ratio ? v : best), undefined)
  if (main === undefined) return null
  const src = (main.html.match(HEADER_IMAGE)?.[1] ?? main.html.match(IMG_SRC)?.[1] ?? '').trim().replace(/&amp;/g, '&')
  return /^(\/|https?:\/\/)/.test(src) ? src : null
}

export function relationCountsFor(state: State, id: number): RelationCounts {
  const abTest = state.abTests.find((t) => t.id === id)
  const articles = state.articles.filter((a) => a.ab_test_id === id)
  const articleIds = new Set(articles.map((a) => a.id))
  const exitPopups = state.exitPopups.filter((p) => p.ab_test_id === id).length
  const followPopups = state.followPopups.filter((p) => p.ab_test_id === id).length
  return {
    id,
    versions_count: state.versions.filter((v) => articleIds.has(v.article_id)).length,
    funnel_steps_count: Math.max(0, articles.filter((a) => !a.archived).length - 1),
    exit_popups_count: exitPopups,
    follow_popups_count: followPopups,
    popups_count: exitPopups + followPopups,
    redirect_pages_count: state.redirectPages.filter((p) => p.ab_test_id === id).length,
    has_conversion: abTest !== undefined && state.conversions.some((c) => c.ab_test_uid === abTest.uid),
    ab_test_uid: abTest?.uid ?? null,
    thumbnail_url: pageThumbnail(state, id),
  }
}

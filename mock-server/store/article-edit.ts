/**
 * ステップ（記事）の名前・色の変更と削除（2026-09-24）。
 * 以前はステップを作ることしかできず、間違えて作ったステップを直す・消すことができなかった。
 */
import { inheritArticleKey } from './article-history.ts'
import type { Article, State } from './types.ts'

export const STEP_NAME_MAX = 50
const COLOR_PATTERN = /^#[0-9a-f]{6}$/

/** 色は #rrggbb（小文字にそろえる）。空は「色なし」。それ以外は null（受け付けない） */
export function normalizeStepColor(value: string): string | null {
  const lower = value.trim().toLowerCase()
  if (lower === '') return ''
  return COLOR_PATTERN.test(lower) ? lower : null
}

export function updateArticle(
  state: State,
  uid: string,
  patch: { readonly memo?: string; readonly color?: string },
): { state: State; article: Article | null } {
  const target = state.articles.find((a) => a.uid === uid)
  if (target === undefined) return { state, article: null }
  const updated: Article = {
    ...target,
    ...(patch.memo === undefined ? {} : { memo: patch.memo }),
    ...(patch.color === undefined ? {} : { color: patch.color }),
    updated_timestamp: Date.now(),
  }
  // 名前を変えても、同じ記事として変更・復元履歴を引き継ぐ
  inheritArticleKey(target, updated)
  return {
    state: { ...state, articles: state.articles.map((a) => (a.uid === uid ? updated : a)) },
    article: updated,
  }
}

/**
 * ステップを消す。最初のステップ（配信URLで最初に開くページ）は消さない。
 * そのステップのVersionと、Versionに付いた計測・CV・タグ設定もまとめて消す（Versionの削除と同じ）。
 */
export function deleteArticle(
  state: State,
  uid: string,
): { state: State; deleted: boolean; reason?: 'notfound' | 'first-step' } {
  const target = state.articles.find((a) => a.uid === uid)
  if (target === undefined) return { state, deleted: false, reason: 'notfound' }
  const first = state.articles.find((a) => a.ab_test_id === target.ab_test_id)
  if (first?.uid === uid) return { state, deleted: false, reason: 'first-step' }
  const versionUids = new Set(state.versions.filter((v) => v.article_id === target.id).map((v) => v.uid))
  return {
    state: {
      ...state,
      articles: state.articles.filter((a) => a.uid !== uid),
      versions: state.versions.filter((v) => v.article_id !== target.id),
      conversions: state.conversions.filter((c) => !versionUids.has(c.version_uid)),
      metrics: state.metrics.filter((m) => !versionUids.has(m.entity_uid)),
      htmlTags: state.htmlTags.filter((t) => t.article_uid !== uid),
    },
    deleted: true,
  }
}

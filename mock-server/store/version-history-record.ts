/**
 * Versionの本文を書き換えた前後を「変更・復元履歴」へ積む（マジック置換で使う）。
 *
 * エディタのリンク置換（routes/panel-link-replace.ts）と同じ積み方にそろえる。
 * 履歴は記事ごとに持つので、Versionから記事をたどって積む。
 * 同じ内容が続けば appendArticleHistory 側で積まない。
 */
import { appendArticleHistory, articleKey, setArticleHistoryState } from './article-history.ts'
import type { State } from './types.ts'

const nowTs = (): number => Math.floor(Date.now() / 1000)

/** `htmls` を古い順に積む。Version や記事が見つからなければ何もしない（消えたものの履歴は作らない） */
export function recordVersionChange(state: State, versionUid: string, htmls: readonly string[]): void {
  const version = state.versions.find((v) => v.uid === versionUid)
  if (version === undefined) return
  const article = state.articles.find((a) => a.id === version.article_id)
  if (article === undefined) return
  const key = articleKey(article)
  for (const html of htmls) {
    setArticleHistoryState(
      (history) =>
        appendArticleHistory(history, {
          article_key: key,
          article_uid: article.uid,
          version_uid: version.uid,
          html,
          css: version.css,
          recorded_at: nowTs(),
        }).state,
    )
  }
}

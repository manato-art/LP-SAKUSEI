/**
 * 変更・復元履歴（右レール2番目 → パネル `バージョン復元`）のAPI。
 *
 *   GET  /articles/:uid/histories                → 履歴一覧（日時 + 現行版フラグ）
 *   POST /articles/:uid/histories                → 現在の本文をスナップショットとして積む
 *   POST /articles/:uid/histories/:id/restore    → その世代へ本文を戻す
 *
 * POST（記録）は実機の採取対象には無いが、履歴が2件以上になるには
 * 「いつ・どの本文を」記録するかをクライアントが伝える必要があるため置いている。
 * 実機は保存のたびにサーバー側で積んでいると思われるが、そこは未採取（未確認）。
 */
import { Router } from 'express'
import { updateVersion } from '../store/actions.ts'
import { getState, setState } from '../store/store.ts'
import {
  appendArticleHistory,
  articleKey,
  currentHistoryOf,
  formatHistoryTimestamp,
  getArticleHistoryState,
  historiesOf,
  pruneArticleHistories,
  setArticleHistoryState,
  type ArticleHistory,
} from '../store/article-history.ts'
import { applyEmptyState } from '../lib/mock-state.ts'
import { errorEnvelope } from '../lib/envelope.ts'
import { serializeVersion } from '../lib/serialize.ts'
import { optionalString } from '../lib/validate.ts'
import type { Article, State, Version } from '../store/types.ts'

export const historyRouter: Router = Router()

const nowTs = (): number => Math.floor(Date.now() / 1000)

/** 一覧の1行。`現行版` は最新の1件だけに付く（実機の観測どおり） */
function serializeHistory(entry: ArticleHistory, isCurrent: boolean): Record<string, unknown> {
  return {
    id: entry.id,
    article_uid: entry.article_uid,
    version_uid: entry.version_uid,
    recorded_at: entry.recorded_at,
    /** 実機の書式（ゼロ埋めなし）。表示側で組み立て直さないよう、ここで確定させる */
    recorded_at_label: formatHistoryTimestamp(entry.recorded_at),
    is_current: isCurrent,
  }
}

interface Resolved {
  article: Article
  key: string
  version: Version | undefined
}

/** `:uid` の記事と、履歴の対象Versionを解決する（`?version_uid=` が無ければ先頭Version） */
function resolve(state: State, uid: string, versionUid: string | undefined): Resolved | null {
  const article = state.articles.find((a) => a.uid === uid)
  if (article === undefined) return null
  const versions = state.versions.filter((v) => v.article_id === article.id)
  const version =
    versionUid === undefined || versionUid === ''
      ? versions[0]
      : versions.find((v) => v.uid === versionUid)
  return { article, key: articleKey(article), version }
}

function articleNotFound(res: Parameters<Parameters<Router['get']>[1]>[1]): void {
  res.status(404).json(errorEnvelope('not_found', '記事が見つかりません。'))
}

/**
 * 履歴が1件も無い記事には、いまのVersionの中身を `現行版` として1件だけ用意する。
 * 実機も開いた直後は `現行版` の1行だけが出ている状態だった。
 */
function ensureSeeded(key: string, article: Article, version: Version | undefined): void {
  if (version === undefined) return
  if (currentHistoryOf(getArticleHistoryState(), key) !== undefined) return
  setArticleHistoryState(
    (history) =>
      appendArticleHistory(history, {
        article_key: key,
        article_uid: article.uid,
        version_uid: version.uid,
        html: version.html,
        css: version.css,
        recorded_at: version.updated_at,
      }).state,
  )
}

/** 一覧。新しいものが上（実機のリストと同じ並び） */
historyRouter.get('/articles/:uid/histories', (req, res) => {
  const versionUid = typeof req.query['version_uid'] === 'string' ? req.query['version_uid'] : undefined
  const state = getState()
  pruneArticleHistories(state)
  const found = resolve(state, req.params.uid, versionUid)
  if (found === null) return articleNotFound(res)

  ensureSeeded(found.key, found.article, found.version)
  const entries = historiesOf(getArticleHistoryState(), found.key)
  const currentId = entries.at(-1)?.id ?? -1
  const rows = [...entries].reverse().map((e) => serializeHistory(e, e.id === currentId))
  res.json({ histories: applyEmptyState(req, rows) })
})

/** 現在の本文を記録する。直前と同じ内容なら積まない（`recorded:false`） */
historyRouter.post('/articles/:uid/histories', (req, res) => {
  const state = getState()
  pruneArticleHistories(state)
  const versionUid = optionalString(req.body, 'version_uid')
  const found = resolve(state, req.params.uid, versionUid === '' ? undefined : versionUid)
  if (found === null) return articleNotFound(res)
  if (found.version === undefined) {
    res.status(404).json(errorEnvelope('not_found', 'Versionが見つかりません。'))
    return
  }

  ensureSeeded(found.key, found.article, found.version)

  const version = found.version
  const html = optionalString(req.body, 'html')
  const css = optionalString(req.body, 'css')
  let created: ArticleHistory | null = null
  let recorded = false
  setArticleHistoryState((history) => {
    const out = appendArticleHistory(history, {
      article_key: found.key,
      article_uid: found.article.uid,
      version_uid: version.uid,
      html,
      css: css === '' ? version.css : css,
      recorded_at: nowTs(),
    })
    created = out.history
    recorded = out.recorded
    return out.state
  })
  if (created === null) {
    res.status(500).json(errorEnvelope('internal_server_error', '履歴を記録できませんでした。'))
    return
  }
  res.status(recorded ? 201 : 200).json({ history: serializeHistory(created, true), recorded })
})

/**
 * 復元。選んだ世代の本文をVersionへ書き戻し、その内容を新しい `現行版` として積む。
 * （戻した直後の状態も履歴に残るので、戻しすぎたらもう一度戻せる）
 */
historyRouter.post('/articles/:uid/histories/:id/restore', (req, res) => {
  const state = getState()
  pruneArticleHistories(state)
  const found = resolve(state, req.params.uid, undefined)
  if (found === null) return articleNotFound(res)

  const id = Number(req.params.id)
  const target = historiesOf(getArticleHistoryState(), found.key).find((e) => e.id === id)
  if (target === undefined) {
    res.status(404).json(errorEnvelope('not_found', '履歴が見つかりません。'))
    return
  }

  let updated: Version | null = null
  setState((s) => {
    const out = updateVersion(s, target.version_uid, { html: target.html, css: target.css })
    updated = out.version
    return out.state
  })
  if (updated === null) {
    res.status(404).json(errorEnvelope('not_found', 'Versionが見つかりません。'))
    return
  }

  let created: ArticleHistory | null = null
  setArticleHistoryState((history) => {
    const out = appendArticleHistory(history, {
      article_key: found.key,
      article_uid: found.article.uid,
      version_uid: target.version_uid,
      html: target.html,
      css: target.css,
      recorded_at: nowTs(),
    })
    created = out.history
    return out.state
  })

  const currentEntry = currentHistoryOf(getArticleHistoryState(), found.key) ?? created
  res.json({
    version: serializeVersion(updated),
    html: target.html,
    css: target.css,
    restored_from: target.id,
    history: currentEntry === null ? null : serializeHistory(currentEntry, true),
  })
})

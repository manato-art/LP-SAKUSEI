/**
 * リンク置換パネル（エディタ右レール4番目 `link_replace`）のAPI。
 *
 *   GET  /articles/:uid/link_replace   → 置換対象リンク / 中間ページ / 離脱防止ポップアップ
 *   POST /articles/:uid/link_replace   → 選んだリンクを置き換えて Version に保存する
 *
 * **実物のエンドポイントは未採取。** 採取できたのはパネルのDOMとCSSだけで、
 * 置換時に実サイトが何を叩くかは見ていない（HAR未採取）。
 * ここはクローンが「置換結果がリロードしても残る」状態を作るためのモック契約であり、
 * 実物のパス・ボディ形状と一致する保証は無い（docs/api/ に採取でき次第追記する）。
 *
 * 置換そのものは画面と同じ純粋関数（src/shared/link-html.ts）で行う。
 * 書き込みは既存の `updateVersion`（不変更新）だけを使い、State を破壊しない。
 */
import { Router } from 'express'
import { errorEnvelope } from '../lib/envelope.ts'
import { serializeVersion } from '../lib/serialize.ts'
import { optionalBoolean, optionalString } from '../lib/validate.ts'
import { updateVersion } from '../store/actions.ts'
import { appendArticleHistory, articleKey, setArticleHistoryState } from '../store/article-history.ts'
import { getState, setState } from '../store/store.ts'
import type { Article, ExitPopup, RedirectPage, State, Version } from '../store/types.ts'
import {
  extractLinksFromHtml,
  isAllowedLinkUrl,
  pickReplacementUrl,
  replaceLinksInHtml,
  replaceableIndexes,
  type LpLink,
  type ReplaceTargetType,
} from '../../src/shared/link-html.ts'

export const linkReplaceRouter: Router = Router()

const nowTs = (): number => Math.floor(Date.now() / 1000)

interface Resolved {
  article: Article
  version: Version | undefined
}

/** `:uid` の記事と、対象Versionを解決する（`version_uid` が無ければ先頭Version） */
function resolve(state: State, uid: string, versionUid: string): Resolved | null {
  const article = state.articles.find((a) => a.uid === uid)
  if (article === undefined) return null
  const versions = state.versions.filter((v) => v.article_id === article.id)
  const version = versionUid === '' ? versions[0] : versions.find((v) => v.uid === versionUid)
  return { article, version }
}

function serializeLink(link: LpLink): Record<string, unknown> {
  return {
    index: link.index,
    href: link.href,
    text: link.text,
    is_tracking: link.isTracking,
    is_new_tab: link.isNewTab,
  }
}

/** 置換先の候補として出す中間ページ（`中間ページリンク` を選んだときの選択肢） */
function serializeRedirectPage(page: RedirectPage): Record<string, unknown> {
  return { uid: page.uid, name: page.name, url: page.url, enabled: page.enabled }
}

/**
 * `離脱防止ポップアップリンク` タブの中身。
 * **実機ではこの機能が未契約で、タブの中身は一度も表示できていない**
 * （docs/findings-live-observation.md「ポップアップタブ ＝ 未契約のアップセル画面」）。
 * 行のDOMが採取できていないので、ここは件数と名前だけを返す最小の形にしてある。
 */
function serializeExitPopup(popup: ExitPopup): Record<string, unknown> {
  return { uid: popup.uid, name: popup.name, enabled: popup.enabled }
}

function readTargetType(body: unknown): ReplaceTargetType {
  return optionalString(body, 'target_type') === 'redirectPage' ? 'redirectPage' : 'free'
}

function readIndexes(body: unknown): number[] {
  const raw = (body as Record<string, unknown> | null)?.['indexes']
  if (!Array.isArray(raw)) return []
  return raw.filter((v): v is number => typeof v === 'number' && Number.isInteger(v))
}

linkReplaceRouter.get('/articles/:uid/link_replace', (req, res) => {
  const state = getState()
  const versionUid = typeof req.query['version_uid'] === 'string' ? req.query['version_uid'] : ''
  const found = resolve(state, req.params.uid, versionUid)
  if (found === null) {
    res.status(404).json(errorEnvelope('not_found', '記事が見つかりません。'))
    return
  }
  const abTestId = found.article.ab_test_id
  res.json({
    version_uid: found.version?.uid ?? '',
    links: found.version === undefined ? [] : extractLinksFromHtml(found.version.html).map(serializeLink),
    redirect_pages: state.redirectPages
      .filter((p) => p.ab_test_id === abTestId)
      .map(serializeRedirectPage),
    exit_popups: state.exitPopups.filter((p) => p.ab_test_id === abTestId).map(serializeExitPopup),
  })
})

linkReplaceRouter.post('/articles/:uid/link_replace', (req, res) => {
  const state = getState()
  const found = resolve(state, req.params.uid, optionalString(req.body, 'version_uid'))
  if (found === null) {
    res.status(404).json(errorEnvelope('not_found', '記事が見つかりません。'))
    return
  }
  const version = found.version
  if (version === undefined) {
    res.status(404).json(errorEnvelope('not_found', 'Versionが見つかりません。'))
    return
  }

  const targetType = readTargetType(req.body)
  const redirectPageUid = optionalString(req.body, 'redirect_page_uid')
  const redirectPage = state.redirectPages.find(
    (p) => p.uid === redirectPageUid && p.ab_test_id === found.article.ab_test_id,
  )
  if (targetType === 'redirectPage' && redirectPage === undefined) {
    res.status(422).json(errorEnvelope('validation_failed', '中間ページが見つかりません。'))
    return
  }

  const url = pickReplacementUrl({
    targetType,
    url: optionalString(req.body, 'url'),
    redirectPageUrl: redirectPage?.url ?? null,
  })
  if (url === null || !isAllowedLinkUrl(url)) {
    res.status(422).json(errorEnvelope('validation_failed', '置き換え先のURLが正しくありません。'))
    return
  }

  /**
   * 置換の土台。エディタが `html` を送ってきたらそちらを使う。
   * 保存前の編集が本文に載っている状態で置換されるため、
   * 保存済みのHTMLを土台にすると出現順がずれ、別のリンクを書き換えてしまう。
   */
  const requestedHtml = optionalString(req.body, 'html')
  const before = requestedHtml === '' ? version.html : requestedHtml

  const indexes = replaceableIndexes(before, readIndexes(req.body))
  if (indexes.length === 0) {
    res.status(422).json(errorEnvelope('validation_failed', '置き換えるリンクを選択してください。'))
    return
  }

  const after = replaceLinksInHtml(before, indexes, {
    href: url,
    tracking: optionalBoolean(req.body, 'tracking') ?? true,
    newTab: optionalBoolean(req.body, 'new_tab') ?? false,
  })

  let updated: Version | null = null
  setState((s) => {
    const out = updateVersion(s, version.uid, { html: after })
    updated = out.version
    return out.state
  })
  if (updated === null) {
    res.status(404).json(errorEnvelope('not_found', 'Versionが見つかりません。'))
    return
  }

  // 置換の前後を「変更・復元履歴」に積む（間違えたら戻せるようにする）
  recordBeforeAfter(found.article, version, before, after)

  res.json({
    version: serializeVersion(updated),
    html: after,
    replaced_count: indexes.length,
    links: extractLinksFromHtml(after).map(serializeLink),
  })
})

/** 置換前 → 置換後 の2世代を履歴へ積む（同じ内容なら積まれない） */
function recordBeforeAfter(
  article: Article,
  version: Version,
  before: string,
  after: string,
): void {
  const key = articleKey(article)
  for (const html of [before, after]) {
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

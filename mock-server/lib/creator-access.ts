/**
 * LP作成者のアカウントが使える API（2026-10-15 本人指定）。画面で隠すだけでなく、ここでも断る。
 *
 * 使える: ページ一覧・ページの作成・Versionタブ（編集・プレビュー・配信割合・切り替え予約）・
 *         離脱防止ポップ・中間ページ・切り替え（出し分け）・基本情報
 * 見られるのは自分が作ったページだけ（AbTest.created_by が自分）。ほかの人のページは「見つかりません」。
 * 使えない: 削除（ページ・Version・ポップアップなど全部）・数字（レポート・ヒートマップ・ダッシュボード・CV速報）・
 *           ツール・全体の設定・アカウントの管理。下の表に無いものは全部断る（足し忘れは「使えない」側に倒れる）。
 *
 * パスは API の入口（/api/v1 など）からの相対。
 */
import type { Request } from 'express'
import type { State } from '../store/types.ts'
import type { CreatorAccount } from '../store/creator-accounts.ts'

/** API の入口（app.ts）が覚えておく「このリクエストは LP作成者」の印（リクエストが終われば消える） */
const creatorsByRequest = new WeakMap<Request, CreatorAccount>()

export function markCreator(req: Request, account: CreatorAccount): void {
  creatorsByRequest.set(req, account)
}

/** このリクエストが LP作成者なら、そのアカウント（管理者・開発中は null） */
export function creatorOf(req: Request): CreatorAccount | null {
  return creatorsByRequest.get(req) ?? null
}

/** どのページの操作か、をたどる起点 */
type Scope =
  | 'global' // ページに結び付かない（一覧・作成・読むだけの共通の項目）
  | 'abTest' // /ab_tests/:uid/…
  | 'article' // /articles/:uid/…（ステップ）
  | 'version' // /versions/:uid/…
  | 'redirectPage' // /redirect_pages/:uid/…

interface Rule {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH'
  path: RegExp
  scope: Scope
}

const ID = '([^/]+)'
const rule = (method: Rule['method'], path: string, scope: Scope): Rule => ({
  method,
  path: new RegExp(`^${path.replace(/:id/g, ID)}/?$`),
  scope,
})

/** LP作成者に通すもの（DELETE は1つも無い＝削除は全部断る） */
export const CREATOR_RULES: readonly Rule[] = [
  // ── ページ一覧・作成（一覧は routes 側で自分のページだけに絞る）──
  rule('GET', '/folders', 'global'),
  rule('GET', '/folders/:id', 'global'),
  rule('GET', '/folders/:id/ab_tests', 'global'),
  rule('GET', '/folders/:id/ab_tests/relation_counts', 'global'),
  rule('GET', '/ab_tests', 'global'),
  rule('POST', '/ab_tests', 'global'),
  // 作成と基本情報で選ぶ項目・画面の色（読むだけ）
  rule('GET', '/medias', 'global'),
  rule('GET', '/teams/media', 'global'),
  rule('GET', '/affiliate_service_providers', 'global'),
  rule('GET', '/settings/theme', 'global'),

  // ── 基本情報・ページの複製 ──
  rule('GET', '/ab_tests/:id', 'abTest'),
  rule('PUT', '/ab_tests/:id', 'abTest'),
  rule('GET', '/ab_tests/:id/edit', 'abTest'),
  rule('POST', '/ab_tests/:id/duplicate', 'abTest'),

  // ── Versionタブ（エディタ）──
  rule('GET', '/ab_tests/:id/articles', 'abTest'),
  rule('POST', '/ab_tests/:id/articles', 'abTest'),
  rule('PATCH', '/articles/:id', 'article'),
  rule('GET', '/articles/:id/versions', 'article'),
  rule('POST', '/articles/:id/versions', 'article'),
  rule('GET', '/articles/:id/histories', 'article'),
  rule('POST', '/articles/:id/histories', 'article'),
  rule('GET', '/articles/:id/histories/:id', 'article'),
  rule('POST', '/articles/:id/histories/:id/restore', 'article'),
  rule('GET', '/articles/:id/html_tags', 'article'),
  rule('PUT', '/articles/:id/html_tags', 'article'),
  rule('GET', '/articles/:id/link_replace', 'article'),
  rule('POST', '/articles/:id/link_replace', 'article'),
  rule('GET', '/articles/:id/master_style_sheet', 'article'),
  rule('PUT', '/articles/:id/master_style_sheet', 'article'),
  rule('GET', '/articles/:id/previews', 'article'),
  rule('GET', '/articles/:id/scheduled_switches', 'article'),
  rule('POST', '/articles/:id/scheduled_switches', 'article'),
  rule('PUT', '/versions/:id', 'version'),
  rule('POST', '/versions/:id/archive', 'version'),
  rule('POST', '/versions/:id/unarchive', 'version'),
  rule('POST', '/versions/:id/duplicate', 'version'),
  rule('POST', '/versions/:id/duplicate_to', 'version'),
  rule('POST', '/versions/:id/publish', 'version'),
  rule('POST', '/versions/:id/preview_document', 'version'),
  // 貼り付けた中身の画像を EBIyon に写す（routes/remote-images.ts・2026-10-31）
  rule('POST', '/versions/:id/remote_images', 'version'),
  rule('PATCH', '/versions/:id/device_targets', 'version'),
  rule('PATCH', '/versions/:id/distribution', 'version'),
  rule('PATCH', '/versions/:id/targeting', 'version'),

  // ── 離脱防止ポップ（追従型も）──
  rule('GET', '/ab_tests/:id/exit_popups', 'abTest'),
  rule('POST', '/ab_tests/:id/exit_popups', 'abTest'),
  rule('PUT', '/ab_tests/:id/exit_popups/:id', 'abTest'),
  rule('POST', '/ab_tests/:id/exit_popups/:id/duplicate', 'abTest'),
  rule('GET', '/ab_tests/:id/follow_popups', 'abTest'),
  rule('POST', '/ab_tests/:id/follow_popups', 'abTest'),
  rule('PUT', '/ab_tests/:id/follow_popups/:id', 'abTest'),
  rule('POST', '/ab_tests/:id/follow_popups/:id/duplicate', 'abTest'),
  rule('GET', '/ab_tests/:id/popup_delivery', 'abTest'),
  rule('PUT', '/ab_tests/:id/popup_delivery/:id', 'abTest'),

  // ── 中間ページ ──
  rule('GET', '/ab_tests/:id/redirect_pages', 'abTest'),
  rule('PUT', '/ab_tests/:id/redirect_pages', 'abTest'),
  rule('POST', '/ab_tests/:id/redirect_pages/create', 'abTest'),
  rule('PATCH', '/redirect_pages/:id', 'redirectPage'),
  rule('POST', '/redirect_pages/:id/tags', 'redirectPage'),
  rule('PATCH', '/redirect_pages/:id/tags/:id', 'redirectPage'),

  // ── 切り替え（Versionの出し分け）──
  rule('GET', '/ab_tests/:id/split_test_settings/:id', 'abTest'),
  rule('PUT', '/ab_tests/:id/split_test_settings/:id', 'abTest'),
  rule('GET', '/ab_tests/:id/options/devide', 'abTest'),
  rule('PUT', '/ab_tests/:id/options/devide', 'abTest'),

  // ── 作成したWidget・お気に入り（2026-10-24 本人の選択「全員で全部を共有」。消すのは管理者だけ＝DELETE は通さない）──
  rule('GET', '/widget_library', 'global'),
  rule('POST', '/widget_library/created', 'global'),
  rule('POST', '/widget_library/favorites/toggle', 'global'),
  rule('POST', '/widget_library/import', 'global'),
  // SquadBeyond の Widget 一覧（読むだけ・2026-10-26）
  rule('GET', '/sb_widgets', 'global'),
  rule('GET', '/sb_widgets/:id', 'global'),
]

export type CreatorAccessResult =
  | { ok: true }
  | { ok: false; status: 403 | 404; code: 'forbidden' | 'not_found'; message: string }

export const CREATOR_FORBIDDEN_MESSAGE = 'LP作成者のアカウントでは使えません。'
const NOT_FOUND_MESSAGE = '見つかりません。'

/** その uid のページ（AbTest）の id。たどれなければ null */
function abTestIdOf(state: State, scope: Scope, uid: string): number | null {
  switch (scope) {
    case 'abTest':
      return state.abTests.find((t) => t.uid === uid)?.id ?? null
    case 'article':
      return state.articles.find((a) => a.uid === uid)?.ab_test_id ?? null
    case 'version': {
      const version = state.versions.find((v) => v.uid === uid)
      if (version === undefined) return null
      return state.articles.find((a) => a.id === version.article_id)?.ab_test_id ?? null
    }
    case 'redirectPage':
      return state.redirectPages.find((r) => r.uid === uid)?.ab_test_id ?? null
    case 'global':
      return null
  }
}

/** そのページを、この LP作成者が作ったか */
export function ownsAbTest(state: State, account: CreatorAccount, abTestId: number | null): boolean {
  if (abTestId === null) return false
  return state.abTests.find((t) => t.id === abTestId)?.created_by === account.uid
}

/** 同じことを uid で（一覧の絞り込みなどで使う） */
export function isOwnAbTestUid(state: State, account: CreatorAccount, abTestUid: string): boolean {
  return state.abTests.find((t) => t.uid === abTestUid)?.created_by === account.uid
}

/**
 * この LP作成者に、この API を通してよいか。
 * `body` は Version を別のページへ複製するとき（複製先も自分のページか）に見る。
 */
export function checkCreatorAccess(
  state: State,
  account: CreatorAccount,
  method: string,
  path: string,
  body: unknown,
): CreatorAccessResult {
  const forbidden: CreatorAccessResult = { ok: false, status: 403, code: 'forbidden', message: CREATOR_FORBIDDEN_MESSAGE }
  const notFound: CreatorAccessResult = { ok: false, status: 404, code: 'not_found', message: NOT_FOUND_MESSAGE }

  const matched = CREATOR_RULES.map((r) => ({ r, m: r.method === method ? r.path.exec(path) : null })).find(
    (x) => x.m !== null,
  )
  if (matched === undefined || matched.m === null) return forbidden
  const { r, m } = matched
  if (r.scope === 'global') return { ok: true }

  const uid = decodeURIComponent(m[1] ?? '')
  if (!ownsAbTest(state, account, abTestIdOf(state, r.scope, uid))) return notFound

  // Version を別のページへ複製するときは、複製先も自分のページに限る
  if (r.scope === 'version' && /\/duplicate_to\/?$/.test(path)) {
    const target = (body as { target_article_uid?: unknown } | null)?.target_article_uid
    const targetUid = typeof target === 'string' ? target : ''
    if (!ownsAbTest(state, account, abTestIdOf(state, 'article', targetUid))) return notFound
  }
  return { ok: true }
}

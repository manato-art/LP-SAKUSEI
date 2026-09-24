/**
 * 配信・プレビューで、どのポップアップを出すかを決める（delivery.ts から分離・2026-09-24 監査 26）。
 *
 * 出す候補: このLPのポップアップのうち、配信ON・本番反映済み（store/popups.ts）・出し分けがこの端末。
 * 配信するVersionの「このVersionで配信」が OFF なら、ポップアップ（離脱防止・表示直後・追従型）は1つも出さない。
 *
 * 離脱防止・表示直後は、1回の表示で種類ごとに1つだけ出す（以前は全部を入れていて、先にきっかけが来た物が出ていた）:
 *   1. 訪問回数（全て／初回のみ／2回目以降／3回目以降）が合わない物を外す
 *   2. 残りから割合の重みで1つ選ぶ。0% は選ばない。ただし残りがすべて 0% のときは均等に選ぶ
 *      （この直しより前に作ったポップアップは割合 0% のまま全員に出ていた。それを出なくしない）
 * 追従型には割合・訪問回数が無いので、候補を全部出す（今までどおり）。
 *
 * 訪問回数は LP ごとに Cookie で数える（このサーバーの配信ドメインの Cookie＝ファーストパーティ）:
 *   _sb_pv_{LPのuid} … 何回目の訪問か（400日＝ブラウザが許す一番長い期間）
 *   _sb_ps_{LPのuid} … 今の訪問の目印（ブラウザを閉じると消える）。これがある間に開き直しても数えない
 */
import type { Request, Response } from 'express'
import type { AbTest, ExitPopup, State, Version } from '../store/types.ts'
import { deliveredExitPopup, deliveredFollowPopup } from '../store/popups.ts'
import { buildFollowPopupSnippet, buildPopupSnippet, matchesDevice, type PopupDevice } from './delivery-popup-html.ts'

/** 訪問回数の設定（編集画面の「訪問回数」）に、何回目の訪問かが合うか。'all' は全員 */
export function matchesVisitCount(setting: string, count: number): boolean {
  if (setting === 'first') return count === 1
  if (setting === '2+') return count >= 2
  if (setting === '3+') return count >= 3
  return true
}

/** 同じ種類の候補から1つ選ぶ（割合の重み・0%は選ばない・すべて0%なら均等） */
function pickOne(group: readonly ExitPopup[], random: () => number): ExitPopup | undefined {
  if (group.length === 0) return undefined
  const weighted = group.filter((p) => p.ratio > 0)
  if (weighted.length === 0) return group[Math.min(group.length - 1, Math.floor(random() * group.length))]
  const total = weighted.reduce((sum, p) => sum + p.ratio, 0)
  let ticket = random() * total
  for (const popup of weighted) {
    ticket -= popup.ratio
    if (ticket < 0) return popup
  }
  return weighted[weighted.length - 1]
}

/**
 * 1回の表示に出す離脱防止・表示直後のポップアップ（種類ごとに1つまで・離脱防止が先）。
 * visitCount が null のとき（プレビュー）は訪問回数で外さない。
 */
export function pickPopupsForView(
  candidates: readonly ExitPopup[],
  visitCount: number | null,
  random: () => number = Math.random,
): ExitPopup[] {
  const pool = visitCount === null ? candidates : candidates.filter((p) => matchesVisitCount(p.visit_count, visitCount))
  const exit = pickOne(pool.filter((p) => p.popup_kind !== 'instant'), random)
  const instant = pickOne(pool.filter((p) => p.popup_kind === 'instant'), random)
  return [exit, instant].filter((p): p is ExitPopup => p !== undefined)
}

/** 400日（ブラウザが Cookie を持っていられる一番長い期間） */
const VISIT_MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000

function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const eq = part.indexOf('=')
    if (eq !== -1 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim()
  }
  return undefined
}

/** この表示が、このブラウザの何回目の訪問か（Cookie を読んで書く） */
export function countPopupVisit(req: Request, res: Response, abTestUid: string): number {
  const countName = `_sb_pv_${abTestUid}`
  const sessionName = `_sb_ps_${abTestUid}`
  const header = req.get('cookie')
  const known = Number.parseInt(readCookie(header, countName) ?? '', 10)
  const previous = Number.isFinite(known) && known > 0 ? known : 0
  const inSameVisit = readCookie(header, sessionName) === '1'
  const count = inSameVisit ? Math.max(previous, 1) : previous + 1
  res.cookie(countName, String(count), { maxAge: VISIT_MAX_AGE_MS, sameSite: 'lax', path: '/' })
  res.cookie(sessionName, '1', { sameSite: 'lax', path: '/' })
  return count
}

export interface ViewTarget {
  readonly state: State
  readonly abTest: AbTest
  readonly version: Version
  readonly device: PopupDevice
}

/** 配信・プレビューで出すポップアップのHTML（離脱防止・表示直後・追従型） */
export function renderPopupsForView(target: ViewTarget, visitCount: number | null): string {
  const { state, abTest, version, device } = target
  if (version.popup_delivery === false) return ''
  const exitCandidates = state.exitPopups
    .filter((p) => p.ab_test_id === abTest.id && p.enabled)
    .map(deliveredExitPopup)
    .filter((p): p is ExitPopup => p !== null && matchesDevice(p, device))
  const exitHtml = pickPopupsForView(exitCandidates, visitCount)
    .map((p) => buildPopupSnippet(p, device))
    .join('')
  const followHtml = state.followPopups
    .filter((p) => p.ab_test_id === abTest.id && p.enabled)
    .map(deliveredFollowPopup)
    .map((p) => (p === null ? '' : buildFollowPopupSnippet(p, device)))
    .join('')
  return exitHtml + followHtml
}

/**
 * 「下書きを確認」（プレビューURLに ?popup_draft={ポップアップのuid}）: そのポップアップの下書きだけを出す。
 * 未公開・配信OFF・「このVersionで配信」OFF・割合・訪問回数・出し分けに関係なく出す（確かめるための画面）。
 * 離脱防止・表示直後は右下の「ポップアップを表示」で何度でも出し直せる。
 */
export function renderDraftPopup(target: ViewTarget, popupUid: string): string {
  const { state, abTest, device } = target
  const everyDevice = { device_sp: true, device_tablet: true, device_pc: true }
  const exit = state.exitPopups.find((p) => p.uid === popupUid && p.ab_test_id === abTest.id)
  if (exit !== undefined) return buildPopupSnippet({ ...exit, ...everyDevice }, device, { previewButton: true })
  const follow = state.followPopups.find((p) => p.uid === popupUid && p.ab_test_id === abTest.id)
  if (follow !== undefined) return buildFollowPopupSnippet({ ...follow, ...everyDevice }, device)
  return ''
}

/**
 * プレビュー（/preview/:versionUid）に入れるポップアップのHTML。/preview の処理からはこれ1つだけを呼ぶ。
 *   bare（?bare=1・中身を直す画面の後ろに敷くLP）… 出さない
 *   draftUid（?popup_draft=・「下書きを確認」）… そのポップアップの下書きだけ（renderDraftPopup）
 *   それ以外 … 配信と同じ選び方（本番反映した物・このVersionで配信・割合）。訪問回数では外さない（数えない）
 */
export function renderPreviewPopups(
  target: ViewTarget | null,
  options: { readonly bare: boolean; readonly draftUid: string },
): string {
  if (target === null || options.bare) return ''
  return options.draftUid !== '' ? renderDraftPopup(target, options.draftUid) : renderPopupsForView(target, null)
}

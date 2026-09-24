/**
 * 離脱防止ポップアップ（表示直後も同じ入れ物）のCRUD（ab-tests.ts から分離）。
 *
 * パスは分ける前と同じ（`/ab_tests/:uid/exit_popups` など）。
 * ab-tests.ts が `use()` でこのルーターを同じパス空間へ合流させる。
 * 追従型は ab-tests-follow-popups.ts、「このVersionで配信」は ab-tests-popup-delivery.ts（どちらもここから合流）。
 *
 * 下書きと本番を分ける（2026-09-24・本人の決定）。詳しくは store/popups.ts:
 *   PUT  …/exit_popups/:popup_uid           下書き反映（配信には出ない）。名前・割合・配信ON/OFF はすぐ効く
 *   POST …/exit_popups/:popup_uid/publish   本番反映（今の下書きを本番に写す）
 *   POST …/exit_popups/:popup_uid/duplicate 複製（下書きを写した別のポップアップ・本番反映するまで配信しない）
 */
import { Router } from 'express'
import { getState, setState } from '../store/store.ts'
import { optionalNumber, optionalString, requireString } from '../lib/validate.ts'
import { applyEmptyState } from '../lib/mock-state.ts'
import { errorEnvelope } from '../lib/envelope.ts'
import { findAbTest, notFound } from './ab-tests-shared.ts'
import { externalizeDataUrls } from '../lib/uploads.ts'
import { freshUid } from '../store/actions-shared.ts'
import { makeUid } from '../store/ids.ts'
import { copyName, publishExitPopup, serializeExitPopup, withExitLive } from '../store/popups.ts'
import type { ExitPopup, State } from '../store/types.ts'
import { followPopupsRouter } from './ab-tests-follow-popups.ts'
import { popupDeliveryRouter } from './ab-tests-popup-delivery.ts'

export const abTestsPopupsRouter: Router = Router()
abTestsPopupsRouter.use(followPopupsRouter)
abTestsPopupsRouter.use(popupDeliveryRouter)

type PopupKind = 'exit' | 'instant'
type LinkAction = NonNullable<ExitPopup['link_action']>

const kindOf = (p: { popup_kind?: PopupKind }): PopupKind => p.popup_kind ?? 'exit'
const isLinkAction = (v: unknown): v is LinkAction => v === 'link' || v === 'close' || v === 'tel'

/**
 * 作るときの割合（2026-09-24）: そのLPで同じ種類の1つ目は100%、2つ目からは0%。
 * 配信は「種類ごとに1つを割合の重みで選ぶ・0%は出さない（すべて0%なら均等）」（delivery-popups.ts）。
 * 以前は必ず0%で作っていたのに全員に出ていた（画面の0%と食い違っていた）。
 */
function defaultRatio(state: State, abTestId: number, kind: PopupKind): number {
  return state.exitPopups.some((p) => p.ab_test_id === abTestId && kindOf(p) === kind) ? 0 : 100
}

function findPopupIndex(state: State, abTestId: number, popupUid: string): number {
  return state.exitPopups.findIndex((p) => p.uid === popupUid && p.ab_test_id === abTestId)
}

abTestsPopupsRouter.get('/ab_tests/:uid/exit_popups', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const popups = state.exitPopups.filter((p) => p.ab_test_id === abTest.id).map(serializeExitPopup)
  res.json({ exit_popups: applyEmptyState(req, popups) })
})

abTestsPopupsRouter.post('/ab_tests/:uid/exit_popups', (req, res) => {
  const name = requireString(req.body, 'name', { maxLength: 100 })
  if (!name.ok) {
    res.status(422).json(errorEnvelope('validation_failed', name.message))
    return
  }
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const body = req.body as Record<string, unknown>
  const popupKind: PopupKind = body.popup_kind === 'instant' ? 'instant' : 'exit'
  const created: ExitPopup = {
    id: state.nextId,
    // uid は増えるだけの通し番号から作る（件数＋1だと削除のあとに既存と重なる・2026-09-24）
    uid: freshUid(state.exitPopups, state.nextId, (n) => makeUid('exitPopup', n)),
    ab_test_id: abTest.id,
    name: name.value,
    ratio: typeof body.ratio === 'number' ? body.ratio : defaultRatio(state, abTest.id, popupKind),
    enabled: true,
    preset_id: optionalString(req.body, 'preset_id') || null,
    visit_count: optionalString(req.body, 'visit_count') || 'all',
    phone_number: optionalString(req.body, 'phone_number') || '',
    link_url: optionalString(req.body, 'link_url') || '',
    link_target: optionalString(req.body, 'link_target') || '_blank',
    tracking_urls: Array.isArray(body.tracking_urls)
      ? body.tracking_urls.filter((u): u is string => typeof u === 'string' && u !== '')
      : [],
    animation: optionalString(req.body, 'animation') || 'fade',
    delay_seconds: optionalNumber(req.body, 'delay_seconds') ?? 0,
    scroll_trigger: body.scroll_trigger === true,
    scroll_position: optionalNumber(req.body, 'scroll_position') ?? 50,
    countdown_trigger: body.countdown_trigger === true,
    countdown_seconds: optionalNumber(req.body, 'countdown_seconds') ?? 0,
    back_button_trigger: body.back_button_trigger === true,
    exit_trigger: body.exit_trigger !== false,
    position_x: optionalNumber(req.body, 'position_x') ?? 50,
    position_y: optionalNumber(req.body, 'position_y') ?? 50,
    device_sp: body.device_sp !== false,
    device_tablet: body.device_tablet !== false,
    device_pc: body.device_pc !== false,
    html: externalizeDataUrls(optionalString(req.body, 'html')).text || '<div class="popup-wrap"><p>ポップアップ</p></div>',
    javascript: optionalString(req.body, 'javascript') || '',
    head_tag: optionalString(req.body, 'head_tag') || '',
    body_tag: optionalString(req.body, 'body_tag') || '',
    // 指示176/172: 種別と触ったときの動作
    popup_kind: popupKind,
    link_action: isLinkAction(body.link_action) ? body.link_action : 'link',
    // 本番反映するまで配信しない（2026-09-24）
    live: null,
  }
  setState((s) => ({ ...s, exitPopups: [...s.exitPopups, created], nextId: s.nextId + 1 }))
  res.status(201).json({ exit_popup: serializeExitPopup(created) })
})

/** 下書き反映（と、すぐ効く名前・割合・配信ON/OFF） */
abTestsPopupsRouter.put('/ab_tests/:uid/exit_popups/:popup_uid', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const idx = findPopupIndex(state, abTest.id, req.params.popup_uid)
  if (idx === -1) {
    res.status(404).json(errorEnvelope('not_found', 'ポップアップが見つかりません。'))
    return
  }
  // 古いポップアップ（本番の項目が無い）は、書き換える前の中身を本番として残す（配信は変わらない）
  const existing = withExitLive(state.exitPopups[idx]!)
  const body = req.body as Record<string, unknown>
  const updated: ExitPopup = {
    ...existing,
    ...(typeof body.name === 'string' ? { name: body.name } : {}),
    ...(typeof body.ratio === 'number' ? { ratio: Math.max(0, Math.min(100, Math.round(body.ratio))) } : {}),
    ...(typeof body.enabled === 'boolean' ? { enabled: body.enabled } : {}),
    ...(typeof body.visit_count === 'string' ? { visit_count: body.visit_count } : {}),
    ...(typeof body.phone_number === 'string' ? { phone_number: body.phone_number } : {}),
    ...(typeof body.link_url === 'string' ? { link_url: body.link_url } : {}),
    ...(typeof body.link_target === 'string' ? { link_target: body.link_target } : {}),
    ...(Array.isArray(body.tracking_urls)
      ? { tracking_urls: body.tracking_urls.filter((u): u is string => typeof u === 'string' && u !== '') }
      : {}),
    ...(typeof body.animation === 'string' ? { animation: body.animation } : {}),
    ...(typeof body.delay_seconds === 'number' ? { delay_seconds: body.delay_seconds } : {}),
    ...(typeof body.scroll_trigger === 'boolean' ? { scroll_trigger: body.scroll_trigger } : {}),
    ...(typeof body.scroll_position === 'number' ? { scroll_position: body.scroll_position } : {}),
    ...(typeof body.countdown_trigger === 'boolean' ? { countdown_trigger: body.countdown_trigger } : {}),
    ...(typeof body.countdown_seconds === 'number' ? { countdown_seconds: body.countdown_seconds } : {}),
    ...(typeof body.back_button_trigger === 'boolean' ? { back_button_trigger: body.back_button_trigger } : {}),
    ...(typeof body.exit_trigger === 'boolean' ? { exit_trigger: body.exit_trigger } : {}),
    ...(typeof body.position_x === 'number' ? { position_x: body.position_x } : {}),
    ...(typeof body.position_y === 'number' ? { position_y: body.position_y } : {}),
    ...(typeof body.device_sp === 'boolean' ? { device_sp: body.device_sp } : {}),
    ...(typeof body.device_tablet === 'boolean' ? { device_tablet: body.device_tablet } : {}),
    ...(typeof body.device_pc === 'boolean' ? { device_pc: body.device_pc } : {}),
    ...(typeof body.html === 'string' ? { html: externalizeDataUrls(body.html).text } : {}),
    ...(typeof body.javascript === 'string' ? { javascript: body.javascript } : {}),
    ...(typeof body.head_tag === 'string' ? { head_tag: body.head_tag } : {}),
    ...(typeof body.body_tag === 'string' ? { body_tag: body.body_tag } : {}),
    ...(body.popup_kind === 'exit' || body.popup_kind === 'instant'
      ? { popup_kind: body.popup_kind as PopupKind }
      : {}),
    ...(isLinkAction(body.link_action) ? { link_action: body.link_action } : {}),
  }
  // 配信割合の自動バランス（Versionと同じ挙動）:
  // この beyondページの離脱防止ポップが「ちょうど2個」のとき、片方の割合を変えると
  // もう片方が `100 - 新値` に追従して合計100%を保つ。返り値に adjusted_siblings を含める。
  // 指示176: 種別（exit/instant）ごとに独立してバランスする（別タブのポップと混ざらない）
  const existingKind = kindOf(existing)
  const siblingPopups = state.exitPopups.filter(
    (p) => p.ab_test_id === abTest.id && kindOf(p) === existingKind,
  )
  const otherIdx = typeof body.ratio === 'number' && siblingPopups.length === 2
    ? state.exitPopups.findIndex(
        (p) => p.ab_test_id === abTest.id && kindOf(p) === existingKind && p.uid !== req.params.popup_uid,
      )
    : -1
  const other = otherIdx === -1 ? null : state.exitPopups[otherIdx]!
  const adjustedOther = other === null ? null : { ...other, ratio: Math.max(0, Math.min(100, 100 - updated.ratio)) }
  setState((s) => ({
    ...s,
    exitPopups: s.exitPopups.map((p, i) =>
      i === idx ? updated : i === otherIdx && adjustedOther !== null ? adjustedOther : p,
    ),
  }))
  res.json({
    exit_popup: serializeExitPopup(updated),
    adjusted_siblings: adjustedOther === null ? [] : [{ uid: adjustedOther.uid, ratio: adjustedOther.ratio }],
  })
})

/** 本番反映: 今の下書きを本番に写す（配信はこの本番だけを使う） */
abTestsPopupsRouter.post('/ab_tests/:uid/exit_popups/:popup_uid/publish', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const idx = findPopupIndex(state, abTest.id, req.params.popup_uid)
  if (idx === -1) {
    res.status(404).json(errorEnvelope('not_found', 'ポップアップが見つかりません。'))
    return
  }
  const published = publishExitPopup(state.exitPopups[idx]!)
  setState((s) => ({ ...s, exitPopups: s.exitPopups.map((p, i) => (i === idx ? published : p)) }))
  res.json({ exit_popup: serializeExitPopup(published) })
})

/**
 * 複製: 下書きの中身を写した別のポップアップを作る（名前は「〜のコピー」）。
 * 本番反映するまで配信しない。種類は body.popup_kind（追加画面のタブ）、無ければ元と同じ。
 */
abTestsPopupsRouter.post('/ab_tests/:uid/exit_popups/:popup_uid/duplicate', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const idx = findPopupIndex(state, abTest.id, req.params.popup_uid)
  if (idx === -1) {
    res.status(404).json(errorEnvelope('not_found', 'ポップアップが見つかりません。'))
    return
  }
  const source = state.exitPopups[idx]!
  const body = (req.body ?? {}) as Record<string, unknown>
  const popupKind: PopupKind =
    body.popup_kind === 'exit' || body.popup_kind === 'instant' ? body.popup_kind : kindOf(source)
  const created: ExitPopup = {
    ...source,
    id: state.nextId,
    uid: freshUid(state.exitPopups, state.nextId, (n) => makeUid('exitPopup', n)),
    name: copyName(source.name),
    ratio: defaultRatio(state, abTest.id, popupKind),
    tracking_urls: [...(source.tracking_urls ?? [])],
    popup_kind: popupKind,
    live: null,
  }
  setState((s) => ({ ...s, exitPopups: [...s.exitPopups, created], nextId: s.nextId + 1 }))
  res.status(201).json({ exit_popup: serializeExitPopup(created) })
})

abTestsPopupsRouter.delete('/ab_tests/:uid/exit_popups/:popup_uid', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const idx = findPopupIndex(state, abTest.id, req.params.popup_uid)
  if (idx === -1) {
    res.status(404).json(errorEnvelope('not_found', 'ポップアップが見つかりません。'))
    return
  }
  setState((s) => ({
    ...s,
    exitPopups: s.exitPopups.filter((_, i) => i !== idx),
  }))
  res.status(204).end()
})

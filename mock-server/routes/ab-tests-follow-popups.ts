/**
 * 追従型ポップアップ（指示85）のCRUD（ab-tests-popups.ts から分離・パスは同じ）。
 *
 * 作った・保存した中身が、そのまま配信に出る（配信ONのとき・2026-10-31 下書きと本番に分けるのをやめた・store/popups.ts）:
 *   PUT  …/follow_popups/:popup_uid           保存（すぐ配信に出る）
 *   POST …/follow_popups/:popup_uid/duplicate 複製
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
import { copyName } from '../store/popups.ts'
import { parseFreePosition } from '../../src/shared/follow-free-place.ts'
import type { FollowPopup, State } from '../store/types.ts'

export const followPopupsRouter: Router = Router()

/** 返す形（置いた場所が無いときも null で返す＝画面の「保存していない変更があるか」が、項目の有る無しで食い違わないように） */
function serializeFollowPopup(popup: FollowPopup): Omit<FollowPopup, 'free_position'> & { free_position: FollowPopup['free_position'] | null } {
  return { ...popup, free_position: popup.free_position ?? null }
}

type FollowPosition = FollowPopup['position']
const POSITIONS: readonly string[] = ['top', 'bottom', 'bottom-right', 'bottom-left']
const isPosition = (v: unknown): v is FollowPosition => typeof v === 'string' && POSITIONS.includes(v)

function findPopupIndex(state: State, abTestId: number, popupUid: string): number {
  return state.followPopups.findIndex((p) => p.uid === popupUid && p.ab_test_id === abTestId)
}

followPopupsRouter.get('/ab_tests/:uid/follow_popups', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'ページが見つかりません。')
  const popups = state.followPopups.filter((p) => p.ab_test_id === abTest.id).map(serializeFollowPopup)
  res.json({ follow_popups: applyEmptyState(req, popups) })
})

followPopupsRouter.post('/ab_tests/:uid/follow_popups', (req, res) => {
  const name = requireString(req.body, 'name', { maxLength: 100 })
  if (!name.ok) {
    res.status(422).json(errorEnvelope('validation_failed', name.message))
    return
  }
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'ページが見つかりません。')
  const body = req.body as Record<string, unknown>
  const created: FollowPopup = {
    id: state.nextId,
    // uid は増えるだけの通し番号から作る（件数＋1だと削除のあとに既存と重なる・2026-09-24）
    uid: freshUid(state.followPopups, state.nextId, (n) => makeUid('followPopup', n)),
    ab_test_id: abTest.id,
    name: name.value,
    enabled: true,
    preset_id: optionalString(req.body, 'preset_id') || null,
    position: isPosition(body.position) ? body.position : 'bottom',
    show_after_scroll: optionalNumber(req.body, 'show_after_scroll') ?? 0,
    show_close_button: body.show_close_button !== false,
    animation: optionalString(req.body, 'animation') || 'slideUp',
    device_sp: body.device_sp !== false,
    device_tablet: body.device_tablet !== false,
    device_pc: body.device_pc !== false,
    html: externalizeDataUrls(optionalString(req.body, 'html')).text || '<div class="follow-popup-wrap"><p>追尾バナー</p></div>',
    javascript: optionalString(req.body, 'javascript') || '',
    css: externalizeDataUrls(optionalString(req.body, 'css')).text || '',
  }
  setState((s) => ({ ...s, followPopups: [...s.followPopups, created], nextId: s.nextId + 1 }))
  res.status(201).json({ follow_popup: serializeFollowPopup(created) })
})

/** 保存（すぐ配信に出る） */
followPopupsRouter.put('/ab_tests/:uid/follow_popups/:popup_uid', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'ページが見つかりません。')
  const idx = findPopupIndex(state, abTest.id, req.params.popup_uid)
  if (idx === -1) {
    res.status(404).json(errorEnvelope('not_found', '追尾ポップアップが見つかりません。'))
    return
  }
  const body = req.body as Record<string, unknown>
  // つまんで置いた場所（null＝消して選んだ表示位置に戻す・follow-free-place.ts）
  const free = 'free_position' in body ? parseFreePosition(body.free_position) : null
  if (free !== null && !free.ok) {
    res.status(422).json(errorEnvelope('validation_failed', free.message))
    return
  }
  const { free_position: kept, ...existing } = state.followPopups[idx]!
  const freePosition = free === null ? kept : (free.value ?? undefined)
  const updated: FollowPopup = {
    ...existing,
    // 消したときは項目ごと外す
    ...(freePosition === undefined ? {} : { free_position: freePosition }),
    ...(typeof body.name === 'string' ? { name: body.name } : {}),
    ...(typeof body.enabled === 'boolean' ? { enabled: body.enabled } : {}),
    ...(isPosition(body.position) ? { position: body.position } : {}),
    ...(typeof body.show_after_scroll === 'number' ? { show_after_scroll: body.show_after_scroll } : {}),
    ...(typeof body.show_close_button === 'boolean' ? { show_close_button: body.show_close_button } : {}),
    ...(typeof body.animation === 'string' ? { animation: body.animation } : {}),
    ...(typeof body.device_sp === 'boolean' ? { device_sp: body.device_sp } : {}),
    ...(typeof body.device_tablet === 'boolean' ? { device_tablet: body.device_tablet } : {}),
    ...(typeof body.device_pc === 'boolean' ? { device_pc: body.device_pc } : {}),
    ...(typeof body.html === 'string' ? { html: externalizeDataUrls(body.html).text } : {}),
    ...(typeof body.javascript === 'string' ? { javascript: body.javascript } : {}),
    ...(typeof body.css === 'string' ? { css: externalizeDataUrls(body.css).text } : {}),
  }
  setState((s) => ({
    ...s,
    followPopups: s.followPopups.map((p, i) => (i === idx ? updated : p)),
  }))
  res.json({ follow_popup: serializeFollowPopup(updated) })
})

/** 複製: 保存した中身を写した別の追従型を作る（名前は「〜のコピー」・作ったらすぐ配信に出る） */
followPopupsRouter.post('/ab_tests/:uid/follow_popups/:popup_uid/duplicate', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'ページが見つかりません。')
  const idx = findPopupIndex(state, abTest.id, req.params.popup_uid)
  if (idx === -1) {
    res.status(404).json(errorEnvelope('not_found', '追尾ポップアップが見つかりません。'))
    return
  }
  const source = state.followPopups[idx]!
  const created: FollowPopup = {
    ...source,
    id: state.nextId,
    uid: freshUid(state.followPopups, state.nextId, (n) => makeUid('followPopup', n)),
    name: copyName(source.name),
  }
  setState((s) => ({ ...s, followPopups: [...s.followPopups, created], nextId: s.nextId + 1 }))
  res.status(201).json({ follow_popup: serializeFollowPopup(created) })
})

followPopupsRouter.delete('/ab_tests/:uid/follow_popups/:popup_uid', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'ページが見つかりません。')
  const idx = findPopupIndex(state, abTest.id, req.params.popup_uid)
  if (idx === -1) {
    res.status(404).json(errorEnvelope('not_found', '追尾ポップアップが見つかりません。'))
    return
  }
  setState((s) => ({
    ...s,
    followPopups: s.followPopups.filter((_, i) => i !== idx),
  }))
  res.status(204).end()
})

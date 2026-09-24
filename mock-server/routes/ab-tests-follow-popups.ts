/**
 * 追従型ポップアップ（指示85）のCRUD（ab-tests-popups.ts から分離・パスは同じ）。
 *
 * 下書きと本番を分ける（2026-09-24・本人の決定。詳しくは store/popups.ts）:
 *   PUT  …/follow_popups/:popup_uid           下書き反映（配信には出ない）。名前・配信ON/OFF はすぐ効く
 *   POST …/follow_popups/:popup_uid/publish   本番反映
 *   POST …/follow_popups/:popup_uid/duplicate 複製（本番反映するまで配信しない）
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
import { copyName, publishFollowPopup, serializeFollowPopup, withFollowLive } from '../store/popups.ts'
import type { FollowPopup, State } from '../store/types.ts'

export const followPopupsRouter: Router = Router()

type FollowPosition = FollowPopup['position']
const POSITIONS: readonly string[] = ['top', 'bottom', 'bottom-right', 'bottom-left']
const isPosition = (v: unknown): v is FollowPosition => typeof v === 'string' && POSITIONS.includes(v)

function findPopupIndex(state: State, abTestId: number, popupUid: string): number {
  return state.followPopups.findIndex((p) => p.uid === popupUid && p.ab_test_id === abTestId)
}

followPopupsRouter.get('/ab_tests/:uid/follow_popups', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
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
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
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
    // 本番反映するまで配信しない（2026-09-24）
    live: null,
  }
  setState((s) => ({ ...s, followPopups: [...s.followPopups, created], nextId: s.nextId + 1 }))
  res.status(201).json({ follow_popup: serializeFollowPopup(created) })
})

/** 下書き反映（と、すぐ効く名前・配信ON/OFF） */
followPopupsRouter.put('/ab_tests/:uid/follow_popups/:popup_uid', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const idx = findPopupIndex(state, abTest.id, req.params.popup_uid)
  if (idx === -1) {
    res.status(404).json(errorEnvelope('not_found', '追尾ポップアップが見つかりません。'))
    return
  }
  // 古いポップアップ（本番の項目が無い）は、書き換える前の中身を本番として残す（配信は変わらない）
  const existing = withFollowLive(state.followPopups[idx]!)
  const body = req.body as Record<string, unknown>
  const updated: FollowPopup = {
    ...existing,
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

/** 本番反映: 今の下書きを本番に写す */
followPopupsRouter.post('/ab_tests/:uid/follow_popups/:popup_uid/publish', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const idx = findPopupIndex(state, abTest.id, req.params.popup_uid)
  if (idx === -1) {
    res.status(404).json(errorEnvelope('not_found', '追尾ポップアップが見つかりません。'))
    return
  }
  const published = publishFollowPopup(state.followPopups[idx]!)
  setState((s) => ({ ...s, followPopups: s.followPopups.map((p, i) => (i === idx ? published : p)) }))
  res.json({ follow_popup: serializeFollowPopup(published) })
})

/** 複製: 下書きの中身を写した別の追従型を作る（名前は「〜のコピー」・本番反映するまで配信しない） */
followPopupsRouter.post('/ab_tests/:uid/follow_popups/:popup_uid/duplicate', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
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
    live: null,
  }
  setState((s) => ({ ...s, followPopups: [...s.followPopups, created], nextId: s.nextId + 1 }))
  res.status(201).json({ follow_popup: serializeFollowPopup(created) })
})

followPopupsRouter.delete('/ab_tests/:uid/follow_popups/:popup_uid', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
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

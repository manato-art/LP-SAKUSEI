/**
 * 離脱防止ポップアップ / 追尾型ポップアップのCRUD（ab-tests.ts から分離）。
 *
 * パスは分ける前と同じ（`/ab_tests/:uid/exit_popups` など）。
 * ab-tests.ts が `use()` でこのルーターを同じパス空間へ合流させる。
 */
import { Router } from 'express'
import { getState, setState } from '../store/store.ts'
import { optionalNumber, optionalString, requireString } from '../lib/validate.ts'
import { applyEmptyState } from '../lib/mock-state.ts'
import { errorEnvelope } from '../lib/envelope.ts'
import { findAbTest, notFound } from './ab-tests-shared.ts'
import { externalizeDataUrls } from '../lib/uploads.ts'

export const abTestsPopupsRouter: Router = Router()

// ── 離脱ポップアップ（§10-3）──
abTestsPopupsRouter.get('/ab_tests/:uid/exit_popups', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const popups = state.exitPopups.filter((p) => p.ab_test_id === abTest.id)
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
  const created = {
    id: state.nextId,
    uid: `EXITPOPUP_${String(state.exitPopups.length + 1).padStart(4, '0')}`,
    ab_test_id: abTest.id,
    name: name.value,
    ratio: typeof body.ratio === 'number' ? body.ratio : 0,
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
    popup_kind: (body.popup_kind === 'instant' ? 'instant' : 'exit') as 'exit' | 'instant',
    link_action: (body.link_action === 'close' ? 'close' : 'link') as 'link' | 'close',
  }
  setState((s) => ({ ...s, exitPopups: [...s.exitPopups, created], nextId: s.nextId + 1 }))
  res.status(201).json({ exit_popup: created })
})

abTestsPopupsRouter.put('/ab_tests/:uid/exit_popups/:popup_uid', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const idx = state.exitPopups.findIndex(
    (p) => p.uid === req.params.popup_uid && p.ab_test_id === abTest.id,
  )
  if (idx === -1) {
    res.status(404).json(errorEnvelope('not_found', 'ポップアップが見つかりません。'))
    return
  }
  const existing = state.exitPopups[idx]!
  const body = req.body as Record<string, unknown>
  const updated = {
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
      ? { popup_kind: body.popup_kind as 'exit' | 'instant' }
      : {}),
    ...(body.link_action === 'link' || body.link_action === 'close'
      ? { link_action: body.link_action as 'link' | 'close' }
      : {}),
  }
  // 配信割合の自動バランス（Versionと同じ挙動）:
  // この beyondページの離脱防止ポップが「ちょうど2個」のとき、片方の割合を変えると
  // もう片方が `100 - 新値` に追従して合計100%を保つ。返り値に adjusted_siblings を含める。
  // 指示176: 種別（exit/instant）ごとに独立してバランスする（別タブのポップと混ざらない）
  const kindOf = (p: { popup_kind?: 'exit' | 'instant' }): 'exit' | 'instant' => p.popup_kind ?? 'exit'
  const existingKind = kindOf(existing)
  const adjustedSiblings: { uid: string; ratio: number }[] = []
  const siblingPopups = state.exitPopups.filter(
    (p) => p.ab_test_id === abTest.id && kindOf(p) === existingKind,
  )
  if (typeof body.ratio === 'number' && siblingPopups.length === 2) {
    const otherIdx = state.exitPopups.findIndex(
      (p) => p.ab_test_id === abTest.id && kindOf(p) === existingKind && p.uid !== req.params.popup_uid,
    )
    if (otherIdx !== -1) {
      const other = state.exitPopups[otherIdx]!
      const otherRatio = Math.max(0, Math.min(100, 100 - updated.ratio))
      const adjustedOther = { ...other, ratio: otherRatio }
      adjustedSiblings.push({ uid: adjustedOther.uid, ratio: otherRatio })
      setState((s) => ({
        ...s,
        exitPopups: s.exitPopups.map((p, i) =>
          i === idx ? updated : i === otherIdx ? adjustedOther : p,
        ),
      }))
      res.json({ exit_popup: updated, adjusted_siblings: adjustedSiblings })
      return
    }
  }
  setState((s) => ({
    ...s,
    exitPopups: s.exitPopups.map((p, i) => (i === idx ? updated : p)),
  }))
  res.json({ exit_popup: updated, adjusted_siblings: adjustedSiblings })
})

abTestsPopupsRouter.delete('/ab_tests/:uid/exit_popups/:popup_uid', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const idx = state.exitPopups.findIndex(
    (p) => p.uid === req.params.popup_uid && p.ab_test_id === abTest.id,
  )
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

// ── 追尾型ポップアップ（指示85）──
abTestsPopupsRouter.get('/ab_tests/:uid/follow_popups', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const popups = state.followPopups.filter((p) => p.ab_test_id === abTest.id)
  res.json({ follow_popups: applyEmptyState(req, popups) })
})

abTestsPopupsRouter.post('/ab_tests/:uid/follow_popups', (req, res) => {
  const name = requireString(req.body, 'name', { maxLength: 100 })
  if (!name.ok) {
    res.status(422).json(errorEnvelope('validation_failed', name.message))
    return
  }
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const body = req.body as Record<string, unknown>
  const created = {
    id: state.nextId,
    uid: `FOLLOWPOPUP_${String(state.followPopups.length + 1).padStart(4, '0')}`,
    ab_test_id: abTest.id,
    name: name.value,
    enabled: true,
    preset_id: optionalString(req.body, 'preset_id') || null,
    position: (['top', 'bottom', 'bottom-right', 'bottom-left'].includes(String(body.position)) ? String(body.position) : 'bottom') as 'top' | 'bottom' | 'bottom-right' | 'bottom-left',
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
  res.status(201).json({ follow_popup: created })
})

abTestsPopupsRouter.put('/ab_tests/:uid/follow_popups/:popup_uid', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const idx = state.followPopups.findIndex(
    (p) => p.uid === req.params.popup_uid && p.ab_test_id === abTest.id,
  )
  if (idx === -1) {
    res.status(404).json(errorEnvelope('not_found', '追尾ポップアップが見つかりません。'))
    return
  }
  const existing = state.followPopups[idx]!
  const body = req.body as Record<string, unknown>
  const updated = {
    ...existing,
    ...(typeof body.name === 'string' ? { name: body.name } : {}),
    ...(typeof body.enabled === 'boolean' ? { enabled: body.enabled } : {}),
    ...(typeof body.position === 'string' && ['top', 'bottom', 'bottom-right', 'bottom-left'].includes(body.position) ? { position: body.position as 'top' | 'bottom' | 'bottom-right' | 'bottom-left' } : {}),
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
  res.json({ follow_popup: updated })
})

abTestsPopupsRouter.delete('/ab_tests/:uid/follow_popups/:popup_uid', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const idx = state.followPopups.findIndex(
    (p) => p.uid === req.params.popup_uid && p.ab_test_id === abTest.id,
  )
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

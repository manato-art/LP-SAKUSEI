/**
 * ドメイン画面のAPI（一覧・独自ドメインの登録・「確認する」）。
 *
 *   GET  /teams/domains             … 一覧
 *   POST /teams/domains             … 独自ドメインを登録（ホスト名だけ・確認中から始まる）
 *   POST /teams/domains/:uid/check  … DNSとこのシステムへの届き方を確かめ、状態とSSLを更新する
 *
 * 以前はどのドメインも「確認中」「SSL OFF」から変わらなかった。
 * クイックドメインは発行した時点でアクティブ（routes/folders.ts）。独自ドメインは「確認する」で実際に確かめる。
 * DNSは読むだけで、設定は一切変えない（lib/domain-check.ts）。
 */
import { Router } from 'express'
import { applyEmptyState } from '../lib/mock-state.ts'
import { errorEnvelope } from '../lib/envelope.ts'
import { checkDomainReachability } from '../lib/domain-check.ts'
import { currentTeamId } from '../store/current-team.ts'
import { makeUid } from '../store/ids.ts'
import { freshUid } from '../store/actions-shared.ts'
import { getState, setState } from '../store/store.ts'
import type { Domain } from '../store/types.ts'
import { validateDomainInput } from '../../src/shared/domain-input.ts'

export const domainsRouter: Router = Router()

/**
 * 画面に返す形。クイックドメインは発行した時点で使えるので、
 * この仕組みより前に「確認中」で保存されたもの（まだ確認していないもの）もアクティブとして返す（保存データは書き換えない）。
 */
function serializeDomain(d: Domain): Domain {
  const checkedAt = d.checked_at ?? null
  const status = d.kind === 'quick' && checkedAt === null ? 'active' : d.status
  return { ...d, status, checked_at: checkedAt, check_message: d.check_message ?? '' }
}

domainsRouter.get('/teams/domains', (req, res) => {
  res.json({ domains: applyEmptyState(req, getState().domains.map(serializeDomain)) })
})

domainsRouter.post('/teams/domains', (req, res) => {
  const raw = (req.body as Record<string, unknown> | undefined)?.['host']
  const input = validateDomainInput(typeof raw === 'string' ? raw : '')
  if (!input.ok) {
    res.status(422).json(errorEnvelope('validation_failed', input.message))
    return
  }
  const state = getState()
  const taken = state.domains.some((d) => d.host === input.host) || state.folders.some((f) => f.domain === input.host)
  if (taken) {
    res.status(409).json(errorEnvelope('conflict', 'このドメインは既に登録されています。'))
    return
  }
  let created: Domain | null = null
  setState((s) => {
    if (s.domains.some((d) => d.host === input.host)) return s
    const id = s.nextId
    const domain: Domain = {
      id,
      uid: freshUid(s.domains, id, (n) => makeUid('domain', n)),
      team_id: currentTeamId(s),
      host: input.host,
      status: 'pending',
      ssl: false,
      kind: 'custom',
      checked_at: null,
      check_message: '',
    }
    created = domain
    return { ...s, domains: [...s.domains, domain], nextId: id + 1 }
  })
  if (created === null) {
    res.status(409).json(errorEnvelope('conflict', 'このドメインは既に登録されています。'))
    return
  }
  res.status(201).json({ domain: serializeDomain(created) })
})

domainsRouter.post('/teams/domains/:uid/check', (req, res) => {
  const domain = getState().domains.find((d) => d.uid === req.params.uid)
  if (domain === undefined) {
    res.status(404).json(errorEnvelope('not_found', 'ドメインが見つかりません。'))
    return
  }
  void checkDomainReachability(domain.host).then((result) => {
    const checkedAt = Math.floor(Date.now() / 1000)
    let updated: Domain | null = null
    setState((s) => ({
      ...s,
      domains: s.domains.map((d) => {
        if (d.uid !== domain.uid) return d
        const next: Domain = {
          ...d,
          status: result.status,
          ssl: result.ssl,
          checked_at: checkedAt,
          check_message: result.message,
        }
        updated = next
        return next
      }),
    }))
    if (updated === null) {
      res.status(404).json(errorEnvelope('not_found', 'ドメインが見つかりません。'))
      return
    }
    res.json({ domain: serializeDomain(updated) })
  })
})

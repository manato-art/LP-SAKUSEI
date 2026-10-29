/**
 * 基本情報の「住所の頭の名前」（delivery_label）を、そのページの住所に直す（2026-10-30）。
 *
 * 空なら土台そのもの（c1page.com）、名前を入れれば `<名前>.<土台>`。同じ名前をほかのLPで使ってもよい
 * （住所はページごとに持つので、ほかの商材のLPを奪うことはない）。
 * 住所を持つのは 2026-10-30 からあとに作った・複製したLPだけ。前からあるLPは今までどおりフォルダのドメインで出すので、ここでは変えない。
 */
import { pageDomainFromLabel, pageDomainLabelError } from '../../src/shared/page-delivery-domain.ts'
import type { ValidationResult } from '../lib/validate.ts'
import type { AbTest, State } from './types.ts'

export function resolveDeliveryLabel(state: State, abTest: AbTest, raw: unknown): ValidationResult<string> {
  if (typeof raw !== 'string') return { ok: false, message: '住所の名前は文字で指定してください。' }
  if ((abTest.delivery_domain ?? '') === '' || state.quickDomainBase === '') {
    return { ok: false, message: 'このページの住所はフォルダのドメインで決まります（前からあるページなので、ここでは変えられません）。' }
  }
  const label = raw.trim().toLowerCase()
  const labelError = pageDomainLabelError(label)
  if (labelError !== null) return { ok: false, message: labelError }
  return { ok: true, value: pageDomainFromLabel(label, state.quickDomainBase) }
}

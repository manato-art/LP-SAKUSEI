/**
 * そのページの配信URLと、出せないときの案内（一覧・詳細・基本情報・スマホ・編集ページで同じ決まり）。
 *
 *   - 本番URLを発行する前のページ（2026-10-30〜）は出さない（src/shared/page-issue.ts）。案内は「まだ発行していません」
 *   - 2026-10-30 からあとのLPはページ自身の住所、前からあるLPはフォルダのドメイン（src/shared/page-delivery-domain.ts）
 *   - フォルダのドメインが未設定なら出さない（実物どおり・案内はフォルダの設定へ）
 */
import { effectiveDeliveryDomain } from '../../shared/page-delivery-domain.ts'
import { isIssued } from '../../shared/page-issue.ts'
import { DELIVERY_DOMAIN_UNSET_NOTE, deliveryUrlFor } from './basic-info-form.ts'

/** 発行前のページの案内 */
export const NOT_ISSUED_NOTE =
  'まだ本番URLを発行していません。LPの編集ページの上にある「本番URLを発行」を押すと出ます（管理者だけ）。'

export interface PageForUrl {
  uid: string
  delivery_domain?: string
  issued?: boolean
}

/** 配信URL。出せないときは null（理由は pageDeliveryNote） */
export function pageDeliveryUrl(page: PageForUrl, folderDomain: string | undefined, origin: string): string | null {
  if (!isIssued(page)) return null
  return deliveryUrlFor(effectiveDeliveryDomain(page.delivery_domain, folderDomain), origin, page.uid)
}

/** 配信URLを出せない理由 */
export function pageDeliveryNote(page: PageForUrl): string {
  return isIssued(page) ? DELIVERY_DOMAIN_UNSET_NOTE : NOT_ISSUED_NOTE
}

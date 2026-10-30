/**
 * 本番URLを発行済みのページを消すときの、2回目の警告（2026-10-30 本人「発行済のページを削除しようとした際は、
 * ほんとにいいですか？って警告を出して」）。
 *
 * いつもの「ページを削除」の確認（folders-page-menu.ts）のあとに、発行済みのページだけもう1回聞く。
 * 発行前のページはまだ誰も本番URLで見られないので、いつもの確認だけにする。前からあるページは発行済み扱い。
 */
import type { ConfirmOptions } from '../dialog.ts'
import { isIssued } from '../../shared/page-issue.ts'
import { AD_STATUS_LABELS } from './folders-shared.ts'

export interface PageForDelete {
  title: string
  issued?: boolean
  ad_status: string
  last_visit_date?: string | null
}

/** 2回目の警告の中身。発行前のページなら null（聞かない） */
export function issuedDeleteWarning(page: PageForDelete, deliveryUrl: string): ConfirmOptions | null {
  if (!isIssued(page)) return null
  const facts = [
    `いまの札: ${AD_STATUS_LABELS[page.ad_status] ?? page.ad_status}`,
    ...(page.last_visit_date === undefined || page.last_visit_date === null
      ? []
      : [`最後に人が見に来た日: ${page.last_visit_date}`]),
  ]
  return {
    title: '本当に削除しますか？',
    message: `「${page.title}」は本番URLを発行済みです。削除すると ${deliveryUrl} を開いた人にページが出なくなります。`,
    detail: `${facts.join('／')}。元に戻せません。`,
    submitLabel: '削除する',
    cancelLabel: 'やめる',
    danger: true,
  }
}

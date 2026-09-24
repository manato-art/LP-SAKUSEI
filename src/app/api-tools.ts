/**
 * ツール・設定まわりで足したAPI（api.ts が長くなりすぎたので分けた）。
 * 通信の仕方（エラーの投げ方）は api.ts の request と同じ。
 */
import { request } from './api.ts'

/** 外部連携 > Meta: 連携済みの広告アカウント1件 */
export interface LinkedMetaAccount {
  account_id: string
  name: string
  /** 今トークンで見えているか */
  visible: boolean
  /** Meta の account_status（1=有効）。見えていなければ null */
  account_status: number | null
  currency: string
  /** 連携した日（JST） */
  linked_date: string
  /** そのアカウントを「広告アカウント」単位で紐付けたページの数 */
  page_count: number
}

export interface LinkedMetaAccountsResponse {
  configured: boolean
  accounts: LinkedMetaAccount[]
  /** トークンで見えていて、まだ連携していないもの（入力欄の候補） */
  candidates: { account_id: string; name: string }[]
  error?: string
}

export const toolsApi = {
  linkedMetaAccounts: () => request<LinkedMetaAccountsResponse>('GET', '/teams/ad_accounts/meta'),
  linkMetaAccount: (accountId: string) =>
    request<{ account: LinkedMetaAccount }>('POST', '/teams/ad_accounts/meta', { account_id: accountId }),
  unlinkMetaAccount: (accountId: string) =>
    request<void>('DELETE', `/teams/ad_accounts/meta/${encodeURIComponent(accountId)}`),
}

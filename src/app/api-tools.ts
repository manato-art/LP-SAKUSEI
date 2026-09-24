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

/** アクセス管理（ログインの入口を通れるメールアドレス）1件 */
export interface AllowedEmailEntry {
  id: number
  email: string
  created_at: number
}

/** チームメンバー1人 */
export interface TeamMember {
  id: number
  uid: string
  name: string
  email: string
  /** admin / team-owner / member / viewer。ログインの仕組み上、操作は制限しない（目印） */
  role: string
  team_id: number
}

export const accountApi = {
  /** ログアウト。ログインしていたならログインの入口（redirect）が返る */
  logout: async (): Promise<{ ok: boolean; redirect?: string }> => {
    const res = await fetch('/__auth/logout', { method: 'POST' })
    if (!res.ok) throw new Error(`ログアウトに失敗しました (${res.status})`)
    return (await res.json()) as { ok: boolean; redirect?: string }
  },
  allowedEmails: () =>
    request<{ allowed_emails: AllowedEmailEntry[]; admin_path: string }>('GET', '/allowed_emails'),
  addAllowedEmail: (email: string) =>
    request<{ allowed_email: AllowedEmailEntry }>('POST', '/allowed_emails', { email }),
  /** 最後の1件は400で断られる（理由のメッセージが投げられる） */
  deleteAllowedEmail: (id: number) => request<{ ok: boolean }>('DELETE', `/allowed_emails/${id}`),
  members: () => request<{ members: TeamMember[] }>('GET', '/teams/members'),
  addMember: (input: { name: string; email: string; role: string; allow_login: boolean }) =>
    request<{ member: TeamMember; allowed_email_added: boolean }>('POST', '/teams/members', input),
  updateMemberRole: (uid: string, role: string) =>
    request<{ member: TeamMember }>('PUT', `/teams/members/${encodeURIComponent(uid)}`, { role }),
  deleteMember: (uid: string) => request<void>('DELETE', `/teams/members/${encodeURIComponent(uid)}`),
}

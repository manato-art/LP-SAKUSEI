/**
 * LP作成者のアカウント（2026-10-15 本人指定）。
 *
 * - 管理者（今ログインできる5人）はこれまでどおり「アクセス管理のメール＋共通のパスワード」で入る
 * - LP作成者は、管理者がマイページで1人ずつ足す。パスワードは管理者が決めて入力する（本人の選択）
 * - パスワードはそのまま持たない（scrypt の値だけを持つ）。一覧や API の応答にも出さない
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createCreatorAccount,
  deleteCreatorAccount,
  findCreatorByEmail,
  listCreatorAccounts,
  resetCreatorAccountsForTest,
  sessionStampOf,
  updateCreatorAccount,
  verifyCreatorPassword,
} from '../mock-server/store/creator-accounts.ts'
import { addAllowedEmail } from '../mock-server/store/allowed-emails.ts'

const PASSWORD = 'creator-pass-01'

beforeEach(() => {
  resetCreatorAccountsForTest()
})

describe('LP作成者のアカウントを足す', () => {
  it('メール・名前・パスワードで足せる（メールは小文字にそろえる）', () => {
    const out = createCreatorAccount({ email: ' Writer@Example.com ', name: '佐藤', password: PASSWORD })
    expect(out.ok).toBe(true)
    expect(listCreatorAccounts().map((a) => [a.email, a.name])).toEqual([['writer@example.com', '佐藤']])
  })

  it('一覧にパスワードやその値を出さない', () => {
    createCreatorAccount({ email: 'writer@example.com', name: '佐藤', password: PASSWORD })
    const json = JSON.stringify(listCreatorAccounts())
    expect(json).not.toContain(PASSWORD)
    expect(json).not.toContain('password')
    expect(json).not.toContain('hash')
  })

  it('同じメールは2つ作れない', () => {
    createCreatorAccount({ email: 'writer@example.com', name: '佐藤', password: PASSWORD })
    const again = createCreatorAccount({ email: 'WRITER@example.com', name: '別人', password: PASSWORD })
    expect(again.ok).toBe(false)
  })

  it('管理者のメール（アクセス管理に入っているメール）では作れない（同じメールで管理者にも入れてしまう）', () => {
    addAllowedEmail('admin-only@example.com')
    const out = createCreatorAccount({ email: 'admin-only@example.com', name: '管理', password: PASSWORD })
    expect(out.ok).toBe(false)
  })

  it('メールの形でないもの・8文字未満のパスワードは断る', () => {
    expect(createCreatorAccount({ email: 'not-an-email', name: 'a', password: PASSWORD }).ok).toBe(false)
    expect(createCreatorAccount({ email: 'writer@example.com', name: 'a', password: 'short' }).ok).toBe(false)
  })
})

describe('パスワードの確かめ', () => {
  it('正しいパスワードなら本人のアカウント、違えば null', () => {
    createCreatorAccount({ email: 'writer@example.com', name: '佐藤', password: PASSWORD })
    expect(verifyCreatorPassword('WRITER@example.com', PASSWORD)?.email).toBe('writer@example.com')
    expect(verifyCreatorPassword('writer@example.com', 'wrong-password')).toBeNull()
    expect(verifyCreatorPassword('nobody@example.com', PASSWORD)).toBeNull()
  })

  it('管理者がパスワードを変えたら、古いパスワードでは入れず、ログイン中の印も変わる', () => {
    const created = createCreatorAccount({ email: 'writer@example.com', name: '佐藤', password: PASSWORD })
    if (!created.ok) throw new Error(created.message)
    const before = findCreatorByEmail('writer@example.com')
    if (before === null) throw new Error('アカウントがありません')
    const stampBefore = sessionStampOf(before)

    const out = updateCreatorAccount(created.account.uid, { password: 'new-password-02' })
    expect(out.ok).toBe(true)

    expect(verifyCreatorPassword('writer@example.com', PASSWORD)).toBeNull()
    expect(verifyCreatorPassword('writer@example.com', 'new-password-02')).not.toBeNull()
    const after = findCreatorByEmail('writer@example.com')
    if (after === null) throw new Error('アカウントがありません')
    expect(sessionStampOf(after)).not.toBe(stampBefore)
  })

  it('消したアカウントでは入れない', () => {
    const created = createCreatorAccount({ email: 'writer@example.com', name: '佐藤', password: PASSWORD })
    if (!created.ok) throw new Error(created.message)
    expect(deleteCreatorAccount(created.account.uid)).toBe(true)
    expect(verifyCreatorPassword('writer@example.com', PASSWORD)).toBeNull()
    expect(listCreatorAccounts()).toEqual([])
  })
})

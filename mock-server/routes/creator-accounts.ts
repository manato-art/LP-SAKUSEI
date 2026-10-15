/**
 * マイページ > LP作成者（2026-10-15 本人指定）。管理者だけが使う。
 * LP作成者のアカウントでは lib/creator-access.ts がここを通さない。
 *
 *   GET    /creator_accounts        … 一覧（パスワードもその値も返さない）
 *   POST   /creator_accounts        … 足す（メール・名前・パスワード＝管理者が決めて入力する）
 *   PUT    /creator_accounts/:uid   … 名前・パスワードを変える（パスワードを変えると、その人のログインは切れる）
 *   DELETE /creator_accounts/:uid   … 消す（その人が作ったページは残る。管理者からは今までどおり見える）
 */
import { Router } from 'express'
import type { Response } from 'express'
import { errorEnvelope } from '../lib/envelope.ts'
import {
  createCreatorAccount,
  deleteCreatorAccount,
  listCreatorAccounts,
  updateCreatorAccount,
  type CreatorAccountResult,
} from '../store/creator-accounts.ts'

export const creatorAccountsRouter: Router = Router()

const text = (body: unknown, key: string): string | undefined => {
  const value = (body as Record<string, unknown> | null)?.[key]
  return typeof value === 'string' ? value : undefined
}

const STATUS = { validation_failed: 422, conflict: 409, not_found: 404 } as const

function reply(res: Response, out: CreatorAccountResult, okStatus: number): void {
  if (out.ok) {
    res.status(okStatus).json({ creator_account: out.account })
    return
  }
  res.status(STATUS[out.code]).json(errorEnvelope(out.code, out.message))
}

creatorAccountsRouter.get('/creator_accounts', (_req, res) => {
  res.json({ creator_accounts: listCreatorAccounts() })
})

creatorAccountsRouter.post('/creator_accounts', (req, res) => {
  reply(
    res,
    createCreatorAccount({
      email: text(req.body, 'email') ?? '',
      name: text(req.body, 'name') ?? '',
      password: text(req.body, 'password') ?? '',
    }),
    201,
  )
})

creatorAccountsRouter.put('/creator_accounts/:uid', (req, res) => {
  const name = text(req.body, 'name')
  const password = text(req.body, 'password')
  reply(
    res,
    updateCreatorAccount(req.params.uid, {
      ...(name === undefined ? {} : { name }),
      ...(password === undefined || password === '' ? {} : { password }),
    }),
    200,
  )
})

creatorAccountsRouter.delete('/creator_accounts/:uid', (req, res) => {
  if (!deleteCreatorAccount(req.params.uid)) {
    res.status(404).json(errorEnvelope('not_found', 'LP作成者が見つかりません。'))
    return
  }
  res.status(204).end()
})

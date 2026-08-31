/**
 * 認証（モック認証・企画書 §10-4）とユーザー設定。
 * Devise系は任意入力でログイン成功扱い。実トークン発行・メール送信はしない（§3-2）。
 */
import { Router } from 'express'
import { getState, setState } from '../store/store.ts'
import { errorEnvelope } from '../lib/envelope.ts'
import { optionalString, requireString } from '../lib/validate.ts'

export const usersRouter: Router = Router()

/** メール形式の最低限の検証（§12 境界バリデーション） */
function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

usersRouter.post('/users/sign_up', (req, res) => {
  const email = requireString(req.body, 'email')
  if (!email.ok) {
    res.status(422).json(errorEnvelope('validation_failed', email.message))
    return
  }
  if (!isEmailLike(email.value)) {
    res.status(422).json(errorEnvelope('validation_failed', 'メールアドレスの形式が正しくありません。'))
    return
  }
  const password = requireString(req.body, 'password')
  if (!password.ok) {
    res.status(422).json(errorEnvelope('validation_failed', password.message))
    return
  }
  if (password.value.length < 8) {
    res.status(422).json(errorEnvelope('validation_failed', 'パスワードは8文字以上で入力してください。'))
    return
  }
  res.json({ ok: true, next: '/users/confirmation' })
})

usersRouter.post('/users/confirmation', (_req, res) => {
  res.json({ ok: true, next: '/users/confirmation/code/new' })
})

usersRouter.post('/users/confirmation/code', (req, res) => {
  const code = optionalString(req.body, 'code')
  if (code.length !== 6) {
    res.status(422).json(errorEnvelope('validation_failed', '認証コードは6桁で入力してください。'))
    return
  }
  res.json({ ok: true, next: '/dashboard' })
})

usersRouter.post('/users/forgot_password', (req, res) => {
  const email = requireString(req.body, 'email')
  if (!email.ok || !isEmailLike(email.value)) {
    res.status(422).json(errorEnvelope('validation_failed', 'メールアドレスの形式が正しくありません。'))
    return
  }
  res.json({ ok: true })
})

usersRouter.put('/users/password', (req, res) => {
  const password = requireString(req.body, 'password')
  if (!password.ok || password.value.length < 8) {
    res.status(422).json(errorEnvelope('validation_failed', 'パスワードは8文字以上で入力してください。'))
    return
  }
  res.json({ ok: true, next: '/dashboard' })
})

usersRouter.post('/users/sign_in', (_req, res) => {
  res.json({ ok: true, next: '/dashboard' })
})

usersRouter.get('/users/me', (_req, res) => {
  const state = getState()
  res.json({ user: state.users[0] ?? null })
})

usersRouter.put('/users/me', (req, res) => {
  const name = optionalString(req.body, 'name')
  setState((state) => ({
    ...state,
    users: state.users.map((u, i) => (i === 0 && name !== '' ? { ...u, name } : u)),
  }))
  res.json({ user: getState().users[0] ?? null })
})

usersRouter.get('/users/public_api_key', (_req, res) => {
  res.json({ public_api_key: getState().users[0]?.public_api_key ?? null })
})

/** 公開APIキーの発行。実キーではなく合成値（§3-1・§12 シークレット非ハードコード） */
usersRouter.post('/users/public_api_key', (_req, res) => {
  const generated = `pk_sample_${String(getState().nextId).padStart(8, '0')}`
  setState((state) => ({
    ...state,
    users: state.users.map((u, i) => (i === 0 ? { ...u, public_api_key: generated } : u)),
    nextId: state.nextId + 1,
  }))
  res.json({ public_api_key: generated })
})

/** テナント切替（§10-3 /users/teams） */
usersRouter.get('/users/teams', (_req, res) => {
  const state = getState()
  res.json({ teams: state.teams, current_team_id: state.users[0]?.current_team_id ?? null })
})

/**
 * LP作成者のログイン中の印と、入口（メールゲート）の印（2026-10-15）。
 *
 * どちらも「中身.署名」の形の Cookie 値。署名の鍵は ADMIN_PASSWORD から作る
 * （共通のパスワードを変えると、管理者と同じく全員ログインし直しになる）。
 *
 * - 入口の印: 入口で入れたメールを持つ。パスワードの画面で「誰のパスワードを確かめるか」に使う。
 *   以前の印（メールを持たない固定の値）は admin-auth.ts が引き続き受け付ける＝管理者のログインは変わらない。
 * - LP作成者の印: アカウントの uid・パスワードから作った値・期限を持つ。
 *   パスワードを変える／アカウントを消すと、その場で使えなくなる。
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { ADMIN_PASSWORD } from '../config.ts'
import { findCreatorByUid, sessionStampOf, type CreatorAccount } from '../store/creator-accounts.ts'

export const CREATOR_SESSION_COOKIE = 'creator_session'

/** 30日（管理者のログインと同じ長さ） */
export const CREATOR_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

const KEY = createHmac('sha256', `ebiyon-signing:${ADMIN_PASSWORD}`).update('creator-and-gate').digest()

function sign(kind: 'gate' | 'creator', payload: string): string {
  return createHmac('sha256', KEY).update(`${kind}:${payload}`).digest('base64url')
}

function verified(kind: 'gate' | 'creator', token: string): string | null {
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const payload = token.slice(0, dot)
  const expected = Buffer.from(sign(kind, payload))
  const actual = Buffer.from(token.slice(dot + 1))
  return actual.length === expected.length && timingSafeEqual(actual, expected) ? payload : null
}

/** 入口の印（入れたメールを持つ） */
export function emailGateToken(email: string): string {
  const payload = Buffer.from(email.trim().toLowerCase()).toString('base64url')
  return `${payload}.${sign('gate', payload)}`
}

/** 入口の印から、入れたメールを読む。印が無い・書き換えられていれば null */
export function gateEmailOf(token: string | undefined): string | null {
  if (token === undefined) return null
  const payload = verified('gate', token)
  if (payload === null) return null
  return Buffer.from(payload, 'base64url').toString('utf8')
}

/** LP作成者のログイン中の印 */
export function creatorSessionToken(account: CreatorAccount, now: number = Date.now()): string {
  const expiresAt = Math.floor(now / 1000) + CREATOR_SESSION_MAX_AGE_SECONDS
  const payload = `${account.uid}.${sessionStampOf(account)}.${expiresAt}`
  return `${payload}.${sign('creator', payload)}`
}

/** ログイン中の印から、今もあるアカウントを読む。期限切れ・パスワード変更・削除のあとは null */
export function creatorOfSession(token: string | undefined, now: number = Date.now()): CreatorAccount | null {
  if (token === undefined) return null
  const payload = verified('creator', token)
  if (payload === null) return null
  const [uid, stamp, expiresAt] = payload.split('.')
  if (uid === undefined || stamp === undefined || expiresAt === undefined) return null
  if (Number(expiresAt) * 1000 < now) return null
  const account = findCreatorByUid(uid)
  if (account === null || sessionStampOf(account) !== stamp) return null
  return account
}

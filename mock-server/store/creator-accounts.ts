/**
 * LP作成者のアカウント（2026-10-15 本人指定）。
 *
 * - 管理者（アクセス管理のメール＋共通のパスワード）とは別に、LP作成者を1人ずつ持つ。
 *   LP作成者は「自分が作ったページ」の LP づくり（Versionタブ・離脱防止ポップ・中間ページ・切り替え・基本情報）だけ使える
 *   （どこまで使えるかは lib/creator-access.ts）。
 * - パスワードは管理者がマイページで決めて入力する（本人の選択）。そのままは持たず、scrypt の値だけを持つ。
 *   一覧・API の応答にはパスワードもその値も出さない。
 * - State とは別に `${DATA_DIR}/creator-accounts.json` へ保存する（state.json は写しを取ることがあるので、
 *   パスワードの値を混ぜない。State のリセットで消えないようにする意味もある・allowed-emails.ts と同じ）。
 */
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { hasAllowedEmail } from './allowed-emails.ts'

/** 画面と API に出してよい形（パスワードの値を含まない） */
export interface CreatorAccountView {
  uid: string
  email: string
  name: string
  created_at: number
}

/** 保存する形 */
export interface CreatorAccount extends CreatorAccountView {
  /** `scrypt:<salt hex>:<hash hex>` */
  password_hash: string
}

export type CreatorAccountResult =
  | { ok: true; account: CreatorAccountView }
  | { ok: false; code: 'validation_failed' | 'conflict' | 'not_found'; message: string }

const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 200
const MAX_NAME_LENGTH = 50

const DATA_DIR = process.env['DATA_DIR']
const FILE = DATA_DIR !== undefined && DATA_DIR !== '' ? join(DATA_DIR, 'creator-accounts.json') : null

let accounts: readonly CreatorAccount[] = []

function loadFromDisk(): void {
  if (FILE === null || !existsSync(FILE)) return
  try {
    const raw = JSON.parse(readFileSync(FILE, 'utf8')) as { accounts?: CreatorAccount[] }
    accounts = Array.isArray(raw.accounts) ? raw.accounts : []
  } catch {
    console.error('[creator-accounts] ファイルの読み込みに失敗しました。LP作成者は0人で始めます。')
  }
}

function saveToDisk(): void {
  if (FILE === null) return
  try {
    if (DATA_DIR !== undefined && DATA_DIR !== '' && !existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
    writeFileSync(FILE, JSON.stringify({ accounts }, null, 2))
  } catch {
    console.error('[creator-accounts] ファイルの保存に失敗しました。')
  }
}

loadFromDisk()

const normalizeEmail = (email: string): string => email.trim().toLowerCase()
const isEmailLike = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254

function hashPassword(password: string): string {
  const salt = randomBytes(16)
  return `scrypt:${salt.toString('hex')}:${scryptSync(password, salt, 32).toString('hex')}`
}

function passwordMatches(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split(':')
  if (scheme !== 'scrypt' || saltHex === undefined || hashHex === undefined) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `パスワードは${MIN_PASSWORD_LENGTH}文字以上にしてください。`
  if (password.length > MAX_PASSWORD_LENGTH) return `パスワードは${MAX_PASSWORD_LENGTH}文字以内にしてください。`
  return null
}

const toView = ({ uid, email, name, created_at }: CreatorAccount): CreatorAccountView => ({ uid, email, name, created_at })

export function listCreatorAccounts(): CreatorAccountView[] {
  return accounts.map(toView)
}

export function findCreatorByEmail(email: string): CreatorAccount | null {
  const normalized = normalizeEmail(email)
  return accounts.find((a) => a.email === normalized) ?? null
}

export function findCreatorByUid(uid: string): CreatorAccount | null {
  return accounts.find((a) => a.uid === uid) ?? null
}

export function isCreatorEmail(email: string): boolean {
  return findCreatorByEmail(email) !== null
}

export function createCreatorAccount(input: { email: string; name: string; password: string }): CreatorAccountResult {
  const email = normalizeEmail(input.email)
  const name = input.name.trim()
  if (!isEmailLike(email)) return { ok: false, code: 'validation_failed', message: 'メールアドレスの形で入力してください。' }
  if (name === '') return { ok: false, code: 'validation_failed', message: '名前を入力してください。' }
  if (name.length > MAX_NAME_LENGTH) {
    return { ok: false, code: 'validation_failed', message: `名前は${MAX_NAME_LENGTH}文字以内にしてください。` }
  }
  const problem = passwordProblem(input.password)
  if (problem !== null) return { ok: false, code: 'validation_failed', message: problem }
  if (findCreatorByEmail(email) !== null) {
    return { ok: false, code: 'conflict', message: 'このメールアドレスのLP作成者はもういます。' }
  }
  // 管理者のメールで作ると、同じメールで共通のパスワードからも入れてしまう
  if (hasAllowedEmail(email)) {
    return { ok: false, code: 'conflict', message: 'このメールアドレスは管理者として登録されています（アクセス管理）。' }
  }
  const account: CreatorAccount = {
    uid: `creator_${randomBytes(9).toString('base64url')}`,
    email,
    name,
    created_at: Date.now(),
    password_hash: hashPassword(input.password),
  }
  accounts = [...accounts, account]
  saveToDisk()
  return { ok: true, account: toView(account) }
}

export function updateCreatorAccount(uid: string, patch: { name?: string; password?: string }): CreatorAccountResult {
  const current = findCreatorByUid(uid)
  if (current === null) return { ok: false, code: 'not_found', message: 'LP作成者が見つかりません。' }
  const name = patch.name === undefined ? current.name : patch.name.trim()
  if (name === '') return { ok: false, code: 'validation_failed', message: '名前を入力してください。' }
  if (name.length > MAX_NAME_LENGTH) {
    return { ok: false, code: 'validation_failed', message: `名前は${MAX_NAME_LENGTH}文字以内にしてください。` }
  }
  if (patch.password !== undefined) {
    const problem = passwordProblem(patch.password)
    if (problem !== null) return { ok: false, code: 'validation_failed', message: problem }
  }
  const next: CreatorAccount = {
    ...current,
    name,
    password_hash: patch.password === undefined ? current.password_hash : hashPassword(patch.password),
  }
  accounts = accounts.map((a) => (a.uid === uid ? next : a))
  saveToDisk()
  return { ok: true, account: toView(next) }
}

export function deleteCreatorAccount(uid: string): boolean {
  if (findCreatorByUid(uid) === null) return false
  accounts = accounts.filter((a) => a.uid !== uid)
  saveToDisk()
  return true
}

/** メールとパスワードが合えば、そのアカウント。合わなければ null */
export function verifyCreatorPassword(email: string, password: string): CreatorAccount | null {
  const account = findCreatorByEmail(email)
  if (account === null) return null
  return passwordMatches(password, account.password_hash) ? account : null
}

/**
 * ログイン中の印に入れる短い値。パスワードを変えると変わる＝前のログインは使えなくなる。
 * パスワードの値そのものは出さない（その値から作った別の値）。
 */
export function sessionStampOf(account: CreatorAccount): string {
  return createHash('sha256').update(`creator-stamp:${account.password_hash}`).digest('base64url').slice(0, 16)
}

/** テスト用: 0人に戻す（ファイルには書かない） */
export function resetCreatorAccountsForTest(): void {
  accounts = []
}

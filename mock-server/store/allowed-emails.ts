/**
 * 許可メールアドレスの管理（メールゲート用）。
 *
 * State とは別に `${DATA_DIR}/allowed-emails.json` へ永続化する。
 * - 理由: State のリセット（`?reset=1`）で許可リストまで消えるのは運用上困る。
 * - DATA_DIR 未設定（ローカル開発）ではインメモリのみ（再起動で消えるが問題ない）。
 *
 * ## メールゲートの仕組み
 * ルート（`/`）にメール入力フォームを出し、許可リストに入っているメールなら
 * ログイン画面（`ADMIN_PATH`）へ進めるCookieを付与する。許可リストが空のときは
 * 従来どおり404を返す（下位互換）。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface AllowedEmail {
  id: number
  email: string
  created_at: number
}

const DATA_DIR = process.env['DATA_DIR']
const FILE = DATA_DIR !== undefined && DATA_DIR !== '' ? join(DATA_DIR, 'allowed-emails.json') : null

let emails: AllowedEmail[] = []
let nextId = 1

/** 起動時にディスクから読む（ファイルが無ければ空） */
function loadFromDisk(): void {
  if (FILE === null || !existsSync(FILE)) return
  try {
    const raw = JSON.parse(readFileSync(FILE, 'utf8')) as { emails: AllowedEmail[]; nextId: number }
    emails = raw.emails
    nextId = raw.nextId
  } catch {
    // 壊れていたら空で始める（握りつぶさない＝ログは出す）
    console.error('[allowed-emails] ファイルの読み込みに失敗しました。空で開始します。')
  }
}

function saveToDisk(): void {
  if (FILE === null) return
  try {
    if (DATA_DIR !== undefined && DATA_DIR !== '' && !existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true })
    }
    writeFileSync(FILE, JSON.stringify({ emails, nextId }, null, 2))
  } catch {
    console.error('[allowed-emails] ファイルの保存に失敗しました。')
  }
}

// 起動時に読み込む
loadFromDisk()

// ── 公開API ──

export function getAllowedEmails(): readonly AllowedEmail[] {
  return emails
}

export function hasAllowedEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase()
  return emails.some((e) => e.email.toLowerCase() === normalized)
}

export function isEmailGateEnabled(): boolean {
  return emails.length > 0
}

export function addAllowedEmail(email: string): AllowedEmail {
  const normalized = email.trim().toLowerCase()
  const existing = emails.find((e) => e.email.toLowerCase() === normalized)
  if (existing !== undefined) return existing

  const entry: AllowedEmail = { id: nextId, email: normalized, created_at: Date.now() }
  nextId += 1
  emails = [...emails, entry]
  saveToDisk()
  return entry
}

export function removeAllowedEmail(id: number): boolean {
  const before = emails.length
  emails = emails.filter((e) => e.id !== id)
  if (emails.length === before) return false
  saveToDisk()
  return true
}

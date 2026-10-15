/**
 * 今ログインしている人（管理者 / LP作成者・2026-10-15）。
 *
 * 画面は「LP作成者なら出さない」を決めるのにだけ使う。使える範囲はサーバーが決めて断っている
 * （mock-server/lib/creator-access.ts）ので、ここが読めないときは管理者として描く（画面の見た目だけの話）。
 */
export type Role = 'admin' | 'creator'

export interface SessionInfo {
  role: Role
  email?: string
  name?: string
}

let current: SessionInfo = { role: 'admin' }

/** `/__auth/me` の応答を読む（形が違えば管理者） */
export function parseSession(raw: unknown): SessionInfo {
  const value = (raw ?? {}) as { role?: unknown; email?: unknown; name?: unknown }
  if (value.role !== 'creator') return { role: 'admin' }
  return {
    role: 'creator',
    ...(typeof value.email === 'string' ? { email: value.email } : {}),
    ...(typeof value.name === 'string' ? { name: value.name } : {}),
  }
}

/** 最初の画面を描く前に1回だけ呼ぶ */
export async function loadSession(): Promise<SessionInfo> {
  try {
    const res = await fetch('/__auth/me', { credentials: 'same-origin' })
    current = parseSession(res.ok ? await res.json() : null)
  } catch {
    current = { role: 'admin' }
  }
  return current
}

export function sessionInfo(): SessionInfo {
  return current
}

export function isCreator(): boolean {
  return current.role === 'creator'
}

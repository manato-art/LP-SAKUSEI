/**
 * 全状態を「触って」出すためのモック制御（企画書 §10-8）。
 * `?mock_state=empty|loading|error|success` を任意エンドポイントに付けて
 * 空配列 / 意図的遅延 / エラー封筒 / 正常 を返し分ける。既定は success。
 * フロントにデバッグ用の状態切替UIは出さない（URL直叩き or 開発用パネルのみ）。
 */
import type { NextFunction, Request, Response } from 'express'
import { errorEnvelope } from './envelope.ts'

export const MOCK_STATES = ['success', 'empty', 'loading', 'error'] as const
export type MockState = (typeof MOCK_STATES)[number]

/** loading 時の意図的遅延（§10-8 例2s） */
export const LOADING_DELAY_MS = 2000

export function readMockState(req: Request): MockState {
  const raw = req.query['mock_state']
  const value = typeof raw === 'string' ? raw : undefined
  return MOCK_STATES.includes(value as MockState) ? (value as MockState) : 'success'
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * loading と error はこのミドルウェアで完結させる。
 * empty はレスポンス形状がエンドポイントごとに違うため、各ハンドラが
 * `applyEmptyState(req, items)` を呼んで空配列に差し替える。
 * リクエストに状態を書き込まない（毎回クエリから純粋に読む）。
 */
export async function mockStateMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const state = readMockState(req)
  if (state === 'loading') {
    await delay(LOADING_DELAY_MS)
    next()
    return
  }
  if (state === 'error') {
    res.status(500).json(errorEnvelope('internal_server_error', 'サーバーエラーが発生しました。'))
    return
  }
  next()
}

export function isEmptyState(req: Request): boolean {
  return readMockState(req) === 'empty'
}

/** empty 状態なら空配列に差し替える（一覧系ハンドラ共通） */
export function applyEmptyState<T>(req: Request, items: readonly T[]): readonly T[] {
  return isEmptyState(req) ? [] : items
}

/**
 * チャットワーク連携（タスクの実行結果を通知するため）。
 *
 * 【Slackとの違い】チャットワークは OAuth の往復ではなく **APIトークン1本**で使う。
 * 本人がチャットワークの設定画面で発行したトークンを環境変数に入れてもらう。
 * 認可画面を挟まないぶん手順は短いが、トークンそのものを預かる形になる。
 *
 * 【秘密情報の扱い】トークンは環境変数 `CHATWORK_API_TOKEN` からのみ読む。
 * コードにもStateにも書かず、レスポンスにも含めない（Meta・Slackと同じ作法）。
 *
 * 【API】https://developer.chatwork.com で確認（2026-09-09）:
 *   ベースURL   https://api.chatwork.com/v2
 *   認証ヘッダ   x-chatworktoken
 *   部屋一覧     GET  /rooms            → [{ room_id, name, type, ... }]
 *   投稿        POST /rooms/{id}/messages  body=... （form形式）
 */
import { getState } from './store/store.ts'

const BASE_URL = 'https://api.chatwork.com/v2'

export class ChatworkError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message)
    this.name = 'ChatworkError'
  }
}

/**
 * トークンを読む。**環境変数が最優先**で、無ければ画面から入れた値を使う。
 * 空なら未設定として扱う。
 */
export function chatworkToken(): string | null {
  const token = process.env['CHATWORK_API_TOKEN'] ?? getState().integrations.chatworkApiToken
  return token === '' ? null : token
}

export interface ChatworkRoom {
  id: number
  name: string
  /** my（マイチャット）/ direct（ダイレクト）/ group（グループ） */
  type: string
}

async function callApi(token: string, path: string): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'x-chatworktoken': token },
  })
  if (!res.ok) {
    // 401はトークン、それ以外は権限や障害。どれか分からないと直せないので状態を出す。
    throw new ChatworkError(
      res.status === 401
        ? 'チャットワークのAPIトークンが正しくありません。'
        : `チャットワークへの接続に失敗しました（HTTP ${res.status}）。`,
      res.status === 401 ? 'unauthorized' : 'http_error',
    )
  }
  return res.json().catch(() => null)
}

/** 送り先に選べる部屋の一覧 */
export async function listRooms(token: string): Promise<ChatworkRoom[]> {
  const json = await callApi(token, '/rooms')
  if (!Array.isArray(json)) {
    throw new ChatworkError('部屋の一覧を取得できませんでした。', 'bad_response')
  }
  return json
    .map((r) => r as { room_id?: unknown; name?: unknown; type?: unknown })
    .filter(
      (r): r is { room_id: number; name: string; type: string } =>
        typeof r.room_id === 'number' && typeof r.name === 'string',
    )
    .map((r) => ({ id: r.room_id, name: r.name, type: String(r.type ?? '') }))
}

/** 部屋にメッセージを送る */
export async function postMessage(token: string, roomId: number, body: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/rooms/${roomId}/messages`, {
    method: 'POST',
    headers: {
      'x-chatworktoken': token,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ body }).toString(),
  })
  if (!res.ok) {
    throw new ChatworkError(
      `メッセージを送れませんでした（HTTP ${res.status}）。`,
      res.status === 401 ? 'unauthorized' : 'http_error',
    )
  }
}

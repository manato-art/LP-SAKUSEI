/**
 * Slack連携（タスクの実行結果を通知するため）。
 *
 * 【秘密情報の扱い】Client ID / Client Secret は **環境変数からのみ** 読む。
 * コードにもStateにも書かない。取得したアクセストークンもレスポンスに含めない。
 * 未設定ならこの機能は無効で、画面には「取得手順」を出す（推測で動かさない）。
 *
 * 【流れ】実物（実物の管理画面）と同じ Slack OAuth v2:
 *   1. 「Slackと連携する」→ slack.com/oauth/v2/authorize へ
 *   2. 許可すると `redirect_uri` に code が返る
 *   3. code をトークンに交換して保存
 *   4. チャンネル一覧を出し、送り先を選べるようにする
 *
 * 実物のURLには `state` が付いていなかったが、こちらは付ける。
 * 無いと、他サイトから認可リクエストを差し込まれても見分けが付かない。
 */
import { randomBytes } from 'node:crypto'
import { getState } from './store/store.ts'

/** 実物が要求していたのと同じ権限（2026-09-09 に確認） */
export const SLACK_SCOPES = [
  'channels:join',
  'channels:read',
  'chat:write',
  'groups:read',
  'im:read',
  'mpim:read',
] as const
export const SLACK_USER_SCOPES = ['groups:write.invites'] as const

export interface SlackCredentials {
  clientId: string
  clientSecret: string
}

/**
 * 資格情報を読む。**環境変数が最優先**で、無ければ画面から入れた値を使う。
 * 片方でも欠けていたら未設定として扱う（半端な状態で認可へ飛ばさない）。
 */
export function slackCredentials(): SlackCredentials | null {
  const saved = getState().integrations
  const clientId = process.env['SLACK_CLIENT_ID'] ?? saved.slackClientId
  const clientSecret = process.env['SLACK_CLIENT_SECRET'] ?? saved.slackClientSecret
  if (clientId === '' || clientSecret === '') return null
  return { clientId, clientSecret }
}

/**
 * 認可画面へ送るURL。
 * @param redirectUri Slackアプリに登録したものと**完全に一致**している必要がある
 */
export function authorizeUrl(
  credentials: SlackCredentials,
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: credentials.clientId,
    scope: SLACK_SCOPES.join(','),
    user_scope: SLACK_USER_SCOPES.join(','),
    redirect_uri: redirectUri,
    state,
  })
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`
}

/** CSRF用の使い捨ての値 */
export function newState(): string {
  return randomBytes(16).toString('hex')
}

export interface SlackConnection {
  teamName: string
  accessToken: string
}

export class SlackError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message)
    this.name = 'SlackError'
  }
}

/** 認可コードをアクセストークンに交換する */
export async function exchangeCode(
  credentials: SlackCredentials,
  code: string,
  redirectUri: string,
): Promise<SlackConnection> {
  const res = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      code,
      redirect_uri: redirectUri,
    }).toString(),
  })
  const json = (await res.json().catch(() => null)) as {
    ok?: boolean
    error?: string
    access_token?: string
    team?: { name?: string }
  } | null
  if (json === null || json.ok !== true || typeof json.access_token !== 'string') {
    // Slackのエラーコードはそのまま出す。何が足りないか分からないと直せない。
    throw new SlackError(
      `Slackとの連携に失敗しました（${json?.error ?? 'unknown_error'}）`,
      json?.error ?? 'unknown_error',
    )
  }
  return { teamName: json.team?.name ?? '', accessToken: json.access_token }
}

export interface SlackChannel {
  id: string
  name: string
}

/** 送り先に選べるチャンネルの一覧 */
export async function listChannels(accessToken: string): Promise<SlackChannel[]> {
  const params = new URLSearchParams({
    types: 'public_channel,private_channel',
    exclude_archived: 'true',
    limit: '200',
  })
  const res = await fetch(`https://slack.com/api/conversations.list?${params.toString()}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  const json = (await res.json().catch(() => null)) as {
    ok?: boolean
    error?: string
    channels?: { id?: string; name?: string }[]
  } | null
  if (json === null || json.ok !== true) {
    throw new SlackError(
      `チャンネル一覧を取得できませんでした（${json?.error ?? 'unknown_error'}）`,
      json?.error ?? 'unknown_error',
    )
  }
  return (json.channels ?? [])
    .filter((c): c is { id: string; name: string } =>
      typeof c.id === 'string' && typeof c.name === 'string')
    .map((c) => ({ id: c.id, name: c.name }))
}

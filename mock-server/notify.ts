/**
 * タスクの実行結果を通知する。
 *
 * 送り先は Slack・チャットワーク・LINE。どれも「その場のトークンで1回投げる」だけで、
 * 送れなかったら理由を返す（黙って握りつぶさない）。
 *
 * LINEだけ送り先IDを空にできる（＝公式アカウントと友だちの全員へ）。詳しくは line.ts。
 */
import { chatworkToken, postMessage as postChatwork } from './chatwork.ts'
import { lineToken, postLine } from './line.ts'
import { getState } from './store/store.ts'

export type NotifyService = 'slack' | 'chatwork' | 'line'

/** 送り先IDを決めなくても送れるか（LINEは空＝友だち全員へ） */
export function allowsEmptyDestination(service: NotifyService): boolean {
  return service === 'line'
}

export class NotifyError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message)
    this.name = 'NotifyError'
  }
}

/** Slackのチャンネルへ投稿する */
async function postSlack(channelId: string, text: string): Promise<void> {
  const slack = getState().slack
  if (slack === null) {
    throw new NotifyError('Slackと連携していません。', 'not_connected')
  }
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${slack.accessToken}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ channel: channelId, text }),
  })
  const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
  if (json?.ok !== true) {
    // not_in_channel なら「チャンネルにBotを入れてください」と分かるよう、そのまま返す
    throw new NotifyError(
      `Slackへ送れませんでした（${json?.error ?? 'unknown_error'}）`,
      json?.error ?? 'unknown_error',
    )
  }
}

/**
 * サービスごとの言い分（LineError / ChatworkError）を NotifyError に包み直す。
 *
 * 画面は NotifyError しか見ていないので、包まないと「通知を送れませんでした」だけになり、
 * トークンが悪いのか宛先が悪いのか送信上限なのかが分からなくなる。
 */
function asNotifyError(error: unknown): NotifyError {
  if (error instanceof NotifyError) return error
  const code = (error as { code?: unknown })?.code
  return new NotifyError(
    error instanceof Error ? error.message : '通知を送れませんでした。',
    typeof code === 'string' ? code : 'send_failed',
  )
}

/** 選ばれた送り先へ1通送る */
export async function sendNotification(
  service: NotifyService,
  destinationId: string,
  text: string,
): Promise<void> {
  if (service === 'slack') {
    await postSlack(destinationId, text)
    return
  }
  if (service === 'line') {
    const token = lineToken()
    if (token === null) {
      throw new NotifyError('LINEのチャネルアクセストークンが設定されていません。', 'not_configured')
    }
    try {
      await postLine(token, destinationId, text)
    } catch (error) {
      throw asNotifyError(error)
    }
    return
  }
  const token = chatworkToken()
  if (token === null) {
    throw new NotifyError('チャットワークのAPIトークンが設定されていません。', 'not_configured')
  }
  const roomId = Number(destinationId)
  if (!Number.isFinite(roomId)) {
    throw new NotifyError('送り先の部屋が正しくありません。', 'bad_destination')
  }
  try {
    await postChatwork(token, roomId, text)
  } catch (error) {
    throw asNotifyError(error)
  }
}

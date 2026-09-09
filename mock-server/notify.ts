/**
 * タスクの実行結果を通知する。
 *
 * 送り先は Slack か チャットワーク。どちらも「その場のトークンで1回投げる」だけで、
 * 送れなかったら理由を返す（黙って握りつぶさない）。
 */
import { chatworkToken, postMessage as postChatwork } from './chatwork.ts'
import { getState } from './store/store.ts'

export type NotifyService = 'slack' | 'chatwork'

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
  const token = chatworkToken()
  if (token === null) {
    throw new NotifyError('チャットワークのAPIトークンが設定されていません。', 'not_configured')
  }
  const roomId = Number(destinationId)
  if (!Number.isFinite(roomId)) {
    throw new NotifyError('送り先の部屋が正しくありません。', 'bad_destination')
  }
  await postChatwork(token, roomId, text)
}

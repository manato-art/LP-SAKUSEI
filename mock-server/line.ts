/**
 * LINEへのお知らせ（2026-09-15・本人の依頼）。
 *
 * 【LINE Notify は使えない】2025-03-31でサービスが終わっている。
 * 今つながる道は**LINE公式アカウントの Messaging API** だけで、
 * チャネルアクセストークン1本で送る（Slackのような認可の往復は無い）。
 *
 * 【秘密情報の扱い】トークンは環境変数 `LINE_CHANNEL_ACCESS_TOKEN` を最優先で読む。
 * コードにもレスポンスにも書かない（Meta・Slack・チャットワークと同じ作法）。
 *
 * 【API】https://developers.line.biz/ja/docs/messaging-api/sending-messages/ （2026-09-15確認）
 *   宛先あり  POST https://api.line.me/v2/bot/message/push       body = { to, messages }
 *   宛先なし  POST https://api.line.me/v2/bot/message/broadcast  body = { messages } ＝友だち全員へ
 *   認証     Authorization: Bearer {チャネルアクセストークン}
 *   本文     テキスト1通あたり5000文字まで
 *
 * 宛先を空にできるようにしてあるのは、自分のユーザーIDを知るにはWebhookを立てるか
 * 開発者画面を見る必要があり、そこで詰まって使えないより、
 * 「自分だけが友だちの公式アカウントへ全員送り」が実用的なため。
 */
import { getState } from './store/store.ts'

const BASE_URL = 'https://api.line.me/v2/bot/message'

/** テキスト1通の上限。超えるとLINEは丸ごと弾く（届かない）ので、こちらで切る。 */
export const LINE_TEXT_LIMIT = 5000

export class LineError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message)
    this.name = 'LineError'
  }
}

/**
 * トークンを読む。**環境変数が最優先**で、無ければ画面から入れた値を使う。
 * 空なら未設定として扱う。
 */
export function lineToken(): string | null {
  const token =
    process.env['LINE_CHANNEL_ACCESS_TOKEN'] ?? getState().integrations.lineChannelAccessToken
  return token === '' ? null : token
}

/** 上限を超える本文は、切ったことが分かる形で短くする */
function fit(text: string): string {
  return text.length <= LINE_TEXT_LIMIT ? text : `${text.slice(0, LINE_TEXT_LIMIT - 1)}…`
}

/**
 * LINEへ1通送る。
 * `destinationId` が空なら、その公式アカウントと友だちの全員へ送る。
 */
export async function postLine(
  token: string,
  destinationId: string,
  text: string,
): Promise<void> {
  const to = destinationId.trim()
  const messages = [{ type: 'text', text: fit(text) }]
  const res = await fetch(`${BASE_URL}/${to === '' ? 'broadcast' : 'push'}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(to === '' ? { messages } : { to, messages }),
  })
  if (res.ok) return

  // 何が悪いのか（トークン・宛先・送信上限）はLINEの言い分にしか書いていないので、そのまま出す
  const json = (await res.json().catch(() => null)) as { message?: unknown } | null
  const detail = typeof json?.message === 'string' ? json.message : `HTTP ${res.status}`
  throw new LineError(
    `LINEへ送れませんでした（${detail}）`,
    res.status === 401 || res.status === 403 ? 'unauthorized' : 'http_error',
  )
}

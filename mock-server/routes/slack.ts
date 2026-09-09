/**
 * Slack連携のルート。
 *
 *   GET  /api/v1/slack/status    … 未設定 / 未連携 / 連携済み のどれか
 *   GET  /api/v1/slack/channels  … 送り先に選べるチャンネル
 *   GET  /oauth/slack/start      … 認可画面へ送る
 *   GET  /oauth/slack/callback   … 認可コードをトークンに交換して保存
 *   DELETE /api/v1/slack         … 連携を解除
 *
 * アクセストークンはレスポンスに**一切含めない**。
 * 画面が必要とするのは「繋がっているか」と「チャンネル一覧」だけ。
 */
import { Router } from 'express'
import type { Request } from 'express'
import { getState, setState } from '../store/store.ts'
import { errorEnvelope } from '../lib/envelope.ts'
import {
  SlackError,
  authorizeUrl,
  exchangeCode,
  listChannels,
  newState,
  slackCredentials,
} from '../slack.ts'

export const slackRouter: Router = Router()

/** 認可の往復で使う state。使い捨てで、使ったら消す。 */
const pendingStates = new Set<string>()

/**
 * このサーバーの公開URL。Slackアプリに登録する戻り先と一致させる必要がある。
 * Railway等のプロキシ配下では `req.protocol` が http になるので、
 * 転送ヘッダを見て組み立てる（計測ビーコンで同じ問題を踏んでいる）。
 */
function publicOrigin(req: Request): string {
  const host = req.get('host') ?? ''
  const forwarded = req.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)
  const proto = forwarded !== undefined && forwarded !== '' ? forwarded : isLocal ? req.protocol : 'https'
  return `${proto}://${host}`
}

function redirectUriOf(req: Request): string {
  return `${publicOrigin(req)}/oauth/slack/callback`
}

slackRouter.get('/slack/status', (req, res) => {
  const credentials = slackCredentials()
  const slack = getState().slack
  res.json({
    // 環境変数が入っているか（入るまでは画面に取得手順を出す）
    configured: credentials !== null,
    connected: slack !== null,
    team_name: slack?.teamName ?? null,
    /** Slackアプリに登録してもらう戻り先。画面の手順にそのまま出す */
    redirect_uri: redirectUriOf(req),
  })
})

slackRouter.get('/slack/channels', (_req, res) => {
  const slack = getState().slack
  if (slack === null) {
    res.status(409).json(errorEnvelope('not_connected', 'Slackと連携していません。'))
    return
  }
  void listChannels(slack.accessToken).then(
    (channels) => res.json({ channels }),
    (error: unknown) => {
      const known = error instanceof SlackError
      res
        .status(502)
        .json(
          errorEnvelope(
            known ? error.code : 'slack_error',
            known ? error.message : 'チャンネル一覧を取得できませんでした。',
          ),
        )
    },
  )
})

slackRouter.delete('/slack', (_req, res) => {
  setState((s) => ({ ...s, slack: null }))
  res.status(204).end()
})

/**
 * 認可画面へ送る。
 * `/api/v1` の外に置く（Slackから戻ってくる先はブラウザの遷移なので、
 * APIの認証ミドルウェアではなくページとして扱う）。
 */
export const slackOauthRouter: Router = Router()

slackOauthRouter.get('/oauth/slack/start', (req, res) => {
  const credentials = slackCredentials()
  if (credentials === null) {
    res.status(503).type('html').send(
      resultPage(false, 'Slackアプリがまだ設定されていません。', [
        'SLACK_CLIENT_ID と SLACK_CLIENT_SECRET を環境変数に入れてから、もう一度お試しください。',
      ]),
    )
    return
  }
  const state = newState()
  pendingStates.add(state)
  // 使われないまま残り続けないよう、10分で捨てる
  setTimeout(() => pendingStates.delete(state), 10 * 60 * 1000).unref?.()
  res.redirect(authorizeUrl(credentials, redirectUriOf(req), state))
})

slackOauthRouter.get('/oauth/slack/callback', (req, res) => {
  const credentials = slackCredentials()
  const code = typeof req.query['code'] === 'string' ? req.query['code'] : ''
  const state = typeof req.query['state'] === 'string' ? req.query['state'] : ''

  if (credentials === null) {
    res.status(503).type('html').send(resultPage(false, 'Slackアプリが設定されていません。', []))
    return
  }
  // state が合わないものは受けない。他サイトから認可を差し込まれても見分けが付かなくなる。
  if (state === '' || !pendingStates.has(state)) {
    res
      .status(400)
      .type('html')
      .send(
        resultPage(false, '連携を確認できませんでした。', [
          'この画面を開いたまま時間が経つと無効になります。もう一度やり直してください。',
        ]),
      )
    return
  }
  pendingStates.delete(state)

  if (code === '') {
    res.status(400).type('html').send(resultPage(false, '連携がキャンセルされました。', []))
    return
  }

  void exchangeCode(credentials, code, redirectUriOf(req)).then(
    (connection) => {
      setState((s) => ({ ...s, slack: connection }))
      res.type('html').send(
        resultPage(true, `${connection.teamName} と連携しました。`, [
          'このタブを閉じて、タスクの作成画面に戻ってください。',
          '「実行結果のSlack通知」から送り先のチャンネルを選べます。',
        ]),
      )
    },
    (error: unknown) => {
      const message = error instanceof SlackError ? error.message : '連携に失敗しました。'
      res.status(502).type('html').send(resultPage(false, message, []))
    },
  )
})

/** 連携の結果を出す小さなページ（Slackから戻ってきた先で表示する） */
function resultPage(ok: boolean, title: string, lines: readonly string[]): string {
  const body = lines.map((l) => `<p>${escapeText(l)}</p>`).join('')
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Slack連携</title><style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f6f9;
 font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif;color:#1f2937}
.card{background:#fff;border:1px solid #e6e9f0;border-radius:12px;padding:28px 32px;max-width:520px;
 box-shadow:0 1px 3px rgba(16,24,40,.06)}
h1{font-size:17px;margin:0 0 12px;color:${ok ? '#12A150' : '#D0021B'}}
p{font-size:13px;line-height:1.9;margin:0 0 8px}
</style></head><body><div class="card"><h1>${escapeText(title)}</h1>${body}</div></body></html>`
}

function escapeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

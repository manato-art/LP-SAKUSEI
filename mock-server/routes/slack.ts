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
import { isAdminAuthenticated, render404Page } from '../lib/admin-auth.ts'
import { SERVE_DIST } from '../config.ts'
import { ChatworkError, chatworkToken, listRooms } from '../chatwork.ts'
import { NotifyError, sendNotification } from '../notify.ts'
import { buildTaskReport } from '../task-report.ts'
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

/** チャットワークの状態（トークンが入っているか） */
slackRouter.get('/chatwork/status', (_req, res) => {
  res.json({ configured: chatworkToken() !== null })
})

/** 送り先に選べる部屋 */
slackRouter.get('/chatwork/rooms', (_req, res) => {
  const token = chatworkToken()
  if (token === null) {
    res
      .status(409)
      .json(errorEnvelope('not_configured', 'チャットワークのAPIトークンが設定されていません。'))
    return
  }
  void listRooms(token).then(
    (rooms) => res.json({ rooms }),
    (error: unknown) => {
      const known = error instanceof ChatworkError
      res
        .status(502)
        .json(
          errorEnvelope(
            known ? error.code : 'chatwork_error',
            known ? error.message : '部屋の一覧を取得できませんでした。',
          ),
        )
    },
  )
})

/**
 * 画面から入れる資格情報。
 *
 * 返すのは「入っているか」と「環境変数で入っているか」だけ。
 * 値そのものは**一切返さない**（画面に出す必要が無く、出せば漏れる経路になる）。
 */
slackRouter.get('/integrations', (_req, res) => {
  const saved = getState().integrations
  const byEnv = (name: string): boolean => (process.env[name] ?? '') !== ''
  res.json({
    slack: {
      configured: slackCredentials() !== null,
      // 環境変数で入っている項目は画面から変えられない（変えても効かないため）
      from_env: byEnv('SLACK_CLIENT_ID') && byEnv('SLACK_CLIENT_SECRET'),
      has_saved: saved.slackClientId !== '' && saved.slackClientSecret !== '',
    },
    chatwork: {
      configured: chatworkToken() !== null,
      from_env: byEnv('CHATWORK_API_TOKEN'),
      has_saved: saved.chatworkApiToken !== '',
    },
  })
})

slackRouter.put('/integrations', (req, res) => {
  const body = req.body as Record<string, unknown>
  const read = (key: string): string | null => {
    const v = body[key]
    return typeof v === 'string' ? v.trim() : null
  }
  const next = { ...getState().integrations }
  const slackId = read('slack_client_id')
  const slackSecret = read('slack_client_secret')
  const chatwork = read('chatwork_api_token')

  // Slackは2つ揃って初めて意味がある。片方だけ入れられても認可へ飛べない。
  if ((slackId === null) !== (slackSecret === null)) {
    res
      .status(422)
      .json(
        errorEnvelope('validation_failed', 'Client ID と Client Secret は両方入れてください。'),
      )
    return
  }
  if (slackId !== null && slackSecret !== null) {
    if (slackId === '' || slackSecret === '') {
      res
        .status(422)
        .json(errorEnvelope('validation_failed', 'Client ID と Client Secret を入れてください。'))
      return
    }
    next.slackClientId = slackId
    next.slackClientSecret = slackSecret
  }
  if (chatwork !== null) {
    if (chatwork === '') {
      res.status(422).json(errorEnvelope('validation_failed', 'APIトークンを入れてください。'))
      return
    }
    next.chatworkApiToken = chatwork
  }

  setState((s) => ({ ...s, integrations: next }))
  res.status(204).end()
})

/** 入れた資格情報を消す（`service` は slack / chatwork） */
slackRouter.delete('/integrations/:service', (req, res) => {
  const service = req.params.service
  if (service !== 'slack' && service !== 'chatwork') {
    res.status(404).json(errorEnvelope('not_found', '対象が見つかりません。'))
    return
  }
  setState((s) => ({
    ...s,
    integrations:
      service === 'slack'
        ? { ...s.integrations, slackClientId: '', slackClientSecret: '' }
        : { ...s.integrations, chatworkApiToken: '' },
    // Slackの資格情報を消したら、それで取ったトークンも無効になる
    slack: service === 'slack' ? null : s.slack,
  }))
  res.status(204).end()
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

/**
 * 認可の往復は**ログインしている人だけ**に許す。
 *
 * ここは API 認証の外（Slackからブラウザ遷移で戻ってくるため）に置いている。
 * 素通しにすると、第三者が自分のワークスペースで認可を通して
 * **通知先を丸ごと奪える**（以後のレポートが相手のSlackへ流れる）。
 * 戻りは本人のブラウザなので、管理者のCookieは付いてくる。
 */
slackOauthRouter.use('/oauth/slack', (req, res, next) => {
  // 開発（Vite経由）は認証自体が無効なので素通し。本番だけ効かせる。
  if (SERVE_DIST === undefined || isAdminAuthenticated(req)) {
    next()
    return
  }
  res.status(404).type('html').send(render404Page())
})

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

/**
 * 通知の試し送り。
 *
 * 設定できたかどうかは、実際に1通届いて初めて分かる。
 * 「設定済み」と表示するだけで済ませると、当日になって届かないことに気づく。
 */
slackRouter.post('/notify/test', (req, res) => {
  const body = req.body as Record<string, unknown>
  const service = body['service']
  const destinationId = typeof body['destination_id'] === 'string' ? body['destination_id'] : ''
  if (service !== 'slack' && service !== 'chatwork') {
    res.status(422).json(errorEnvelope('validation_failed', '通知先を選んでください。'))
    return
  }
  if (destinationId === '') {
    res.status(422).json(errorEnvelope('validation_failed', '送り先を選んでください。'))
    return
  }
  const text = [
    '[通知テスト]',
    'この内容が届いていれば、タスクの通知先として使えます。',
    '',
    buildTaskReport('通知テスト', 'today'),
  ].join('\n')

  void sendNotification(service, destinationId, text).then(
    () => res.json({ ok: true }),
    (error: unknown) => {
      const known = error instanceof NotifyError
      res
        .status(502)
        .json(
          errorEnvelope(
            known ? error.code : 'notify_failed',
            known ? error.message : '通知を送れませんでした。',
          ),
        )
    },
  )
})

/** タスクをその場で1回実行して通知を送る（単発タスクの「作成直後に実行」） */
slackRouter.post('/notify/run', (req, res) => {
  const body = req.body as Record<string, unknown>
  const service = body['service']
  const destinationId = typeof body['destination_id'] === 'string' ? body['destination_id'] : ''
  const name = typeof body['name'] === 'string' && body['name'] !== '' ? body['name'] : 'タスク'
  const span = body['span']
  if (service !== 'slack' && service !== 'chatwork') {
    res.status(422).json(errorEnvelope('validation_failed', '通知先を選んでください。'))
    return
  }
  if (destinationId === '') {
    res.status(422).json(errorEnvelope('validation_failed', '送り先を選んでください。'))
    return
  }
  if (span !== 'today' && span !== 'yesterday' && span !== 'last7days') {
    res.status(422).json(errorEnvelope('validation_failed', 'レポート内容が正しくありません。'))
    return
  }
  void sendNotification(service, destinationId, buildTaskReport(name, span)).then(
    () => res.json({ ok: true }),
    (error: unknown) => {
      const known = error instanceof NotifyError
      res
        .status(502)
        .json(
          errorEnvelope(
            known ? error.code : 'notify_failed',
            known ? error.message : '通知を送れませんでした。',
          ),
        )
    },
  )
})

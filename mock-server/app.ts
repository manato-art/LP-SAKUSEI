/**
 * モックサーバーのExpressアプリ（企画書 §10-1）。
 * 3系統（api / workers / report）を localhost の同一モックにパスプレフィックスで集約する。
 * 本番ドメインはコード中に一切登場させない（§3-2・§13-F）。
 */
import express, { type Express, type NextFunction, type Request, type Response } from 'express'
import { PREFIX } from './config.ts'
import { mockStateMiddleware } from './lib/mock-state.ts'
import { errorEnvelope } from './lib/envelope.ts'
import { resetState } from './store/store.ts'
import { captureSinkRouter } from './capture-sink.ts'
import { versionSettingsRouter } from './routes/panel-version-settings.ts'
import { tagSettingsRouter } from './routes/panel-tag-settings.ts'
import { historyRouter } from './routes/panel-history.ts'
import { resetArticleHistories } from './store/article-history.ts'
import { abTestsRouter } from './routes/ab-tests.ts'
import { conversionsRouter } from './routes/conversions.ts'
import { dashboardRouter } from './routes/dashboard.ts'
import { foldersRouter } from './routes/folders.ts'
import { miscRouter } from './routes/misc.ts'
import { reportRouter } from './routes/report.ts'
import { sbAiRouter } from './routes/sb-ai.ts'
import { settingsRouter } from './routes/settings.ts'
import { tasksRouter } from './routes/tasks.ts'
import { teamsRouter } from './routes/teams.ts'
import { usersRouter } from './routes/users.ts'
import { versionsRouter } from './routes/versions.ts'

/** `?reset=1` で新規アカウント発行直後（空）へ戻す（§10-9） */
function resetAll(): void {
  resetState()
  // 履歴は State の外に持っているので、リセット時に明示的に消す
  resetArticleHistories()
}

function resetMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (req.query['reset'] === '1') resetAll()
  next()
}

export function createApp(): Express {
  const app = express()
  app.use(express.json({ limit: '64mb' })) // 採取DOMは数MBになりうる
  app.use(express.urlencoded({ extended: true }))
  app.use(resetMiddleware)
  app.use(mockStateMiddleware)

  // ── 採取シンク（隔離ディレクトリへ直接書き出す・§5-1[1]）──
  app.use(captureSinkRouter)

  // ── 運用エンドポイント ──
  app.get('/__mock/health', (_req, res) => {
    res.json({ ok: true })
  })
  app.post('/__mock/reset', (_req, res) => {
    resetAll()
    res.json({ ok: true })
  })

  const apiRouters = [
    dashboardRouter,
    foldersRouter,
    abTestsRouter,
    versionsRouter,
    conversionsRouter,
    tasksRouter,
    teamsRouter,
    usersRouter,
    settingsRouter,
    sbAiRouter,
    miscRouter,
    // エディタの各パネル（担当ごとに別ファイルに分けて実装したもの）
    versionSettingsRouter,
    tagSettingsRouter,
    historyRouter,
  ]

  // [A] メインREST API（実物は v1 / v2 が混在するため両方に同じルーターを載せる）
  app.use(PREFIX.api, ...apiRouters)
  app.use(PREFIX.apiV2, ...apiRouters)
  // [W] 重い集計系（同一モックに集約）
  app.use(PREFIX.workers, ...apiRouters)
  // [R] ランキング別ドメインのローカルミラー
  app.use(PREFIX.report, reportRouter)

  // 未定義API は 404 を明示的に返す（spinner固定・未定義404を作らない・§13-B）
  app.use('/api', (_req, res) => {
    res.status(404).json(errorEnvelope('not_found', 'エンドポイントが見つかりません。'))
  })

  // エラーハンドラ（握りつぶさない・§12）
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[mock] unhandled error:', err.message)
    res.status(500).json(errorEnvelope('internal_server_error', 'サーバーエラーが発生しました。'))
  })

  return app
}

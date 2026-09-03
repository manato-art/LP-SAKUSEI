/**
 * モックサーバーのExpressアプリ（企画書 §10-1）。
 * 3系統（api / workers / report）を localhost の同一モックにパスプレフィックスで集約する。
 * 本番ドメインはコード中に一切登場させない（§3-2・§13-F）。
 */
import express, { type Express, type NextFunction, type Request, type Response } from 'express'
import { join, resolve, sep } from 'node:path'
import { PREFIX, SERVE_DIST } from './config.ts'
import { mockStateMiddleware } from './lib/mock-state.ts'
import { errorEnvelope } from './lib/envelope.ts'
import { resetState } from './store/store.ts'
import { captureSinkRouter } from './capture-sink.ts'
import { seedWidgetAssets, widgetAssetsRouter } from './widget-assets.ts'
import { versionSettingsRouter } from './routes/panel-version-settings.ts'
import { tagSettingsRouter } from './routes/panel-tag-settings.ts'
import { historyRouter } from './routes/panel-history.ts'
import { linkReplaceRouter } from './routes/panel-link-replace.ts'
import { basicInfoRouter } from './routes/panel-basic-info.ts'
import { resetArticleHistories } from './store/article-history.ts'
import { abTestsRouter } from './routes/ab-tests.ts'
import { conversionsRouter } from './routes/conversions.ts'
import { dashboardRouter } from './routes/dashboard.ts'
import { foldersRouter } from './routes/folders.ts'
import { metaRouter } from './routes/meta.ts'
import { miscRouter } from './routes/misc.ts'
import { reportRouter } from './routes/report.ts'
import { sbAiRouter } from './routes/sb-ai.ts'
import { settingsRouter } from './routes/settings.ts'
import { tasksRouter } from './routes/tasks.ts'
import { teamsRouter } from './routes/teams.ts'
import { usersRouter } from './routes/users.ts'
import { versionsRouter } from './routes/versions.ts'
import { deliveryRouter } from './routes/delivery.ts'
import { adminAuthRouter, isAdminAuthenticated, renderLoginPage } from './lib/admin-auth.ts'

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
  // ヘルスチェックは**ボディパーサより前**に置く。Railway のヘルス probe は
  // 接続をすぐ閉じることがあり、express.json を通すと "request aborted" で
  // 500 になりチェックが通らずデプロイが INITIALIZING で止まる（実際に踏んだ）。
  app.get('/__mock/health', (_req, res) => {
    res.json({ ok: true })
  })
  app.use(express.json({ limit: '256mb' })) // LP本文に画像(base64)が含まれると数十MBになりうる
  app.use(express.urlencoded({ extended: true }))
  app.use(resetMiddleware)
  app.use(mockStateMiddleware)

  // ── 採取シンク（隔離ディレクトリへ直接書き出す・§5-1[1]）──
  // 本番配信モードでは載せない。公開サーバーに書き込み口を残さないため。
  if (SERVE_DIST === undefined) {
    app.use(captureSinkRouter)
  }

  // ── 運用エンドポイント ──（health は上部・ボディパーサ前に登録済み）
  // 最近のエラーを保持する（デバッグ用・最大20件）
  const recentErrors: { time: string; method: string; url: string; message: string; type?: string; stack?: string }[] = []

  // 診断エンドポイント: 最近のサーバーエラーを返す（SPAのcatch-allより前に登録する）
  app.get('/__mock/errors', (_req, res) => {
    res.json({ errors: recentErrors, count: recentErrors.length })
  })

  app.post('/__mock/reset', (_req, res) => {
    resetAll()
    res.json({ ok: true })
  })

  // 管理SPAのパスワード保護（ログイン/確認/ログアウト）。認証不要（これ自体が認証の入口）。
  app.use(adminAuthRouter)

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
    metaRouter,
    miscRouter,
    // エディタの各パネル（担当ごとに別ファイルに分けて実装したもの）
    versionSettingsRouter,
    tagSettingsRouter,
    historyRouter,
    linkReplaceRouter,
    basicInfoRouter,
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

  // 配信ページ（配信URLの実体・実パス）。SPAのシェルは出さず、ここで完結してSSR応答する。
  // 認証（管理SPAのパスワード保護）は掛けない＝エンドユーザーが見るページなので素通し。
  // API群より後・SPAのcatch-allより前（dev/本番どちらでも有効にするので SERVE_DIST 判定の外）。
  app.use(deliveryRouter)

  // ── 本番: ビルドしたフロントを配信する（開発時は Vite が担当するので無効）──
  if (SERVE_DIST !== undefined) {
    const distDir = resolve(SERVE_DIST)
    // Widget資産(13MB)は永続Volumeから配信する（イメージへ焼くとデプロイが昇格しないため）。
    // 起動時に一度だけ dist → Volume へ種蒔きし、以後は Volume を dist より先に見る。
    seedWidgetAssets(distDir)
    const widgetRouter = widgetAssetsRouter()
    if (widgetRouter !== null) app.use(widgetRouter)

    // 管理SPA本体（index.html）はパスワード保護する。CSS/JS/画像等の静的アセットは
    // 素通し（下の express.static がそのまま配る）＝ログイン画面自体の描画にも使うため。
    // index.html は毎回取り直す（no-cache）＝古いJSに固定されない。
    const serveIndexOrLogin = (req: Request, res: Response): void => {
      res.setHeader('Cache-Control', 'no-cache') // SPAのindex.html／ログイン画面は常に最新を配る
      if (isAdminAuthenticated(req)) {
        res.sendFile(join(distDir, 'index.html'))
        return
      }
      res.type('html').send(renderLoginPage())
    }
    // `/` と `/index.html` は明示ルートで先取りする（後段の express.static がファイル名一致で
    // 直接配ってしまい、ログイン画面を素通りしてしまうのを防ぐ）。
    app.get(['/', '/index.html'], serveIndexOrLogin)

    // ハッシュ付きアセット（/assets/index-XXXX.js 等）はファイル名が変わるので長期キャッシュ可。
    // index: false＝ディレクトリ相当のリクエストで index.html を暗黙に配らせない
    // （上のゲートを必ず通す）。
    app.use(
      express.static(distDir, {
        index: false,
        setHeaders: (res, filePath) => {
          if (filePath.includes(`${sep}assets${sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
          }
        },
      }),
    )
    // ハッシュルーティングなので、API/静的アセット以外の全パスは index.html（またはログイン画面）を返す。
    // Express 5 は文字列ワイルドカード '*' を廃止したので、末尾ミドルウェアで受ける。
    // API系プレフィックスは上で処理済みなのでここには来ない。
    app.use((req, res, next) => {
      if (req.method !== 'GET') {
        next()
        return
      }
      serveIndexOrLogin(req, res)
    })
  }

  // エラーハンドラ（握りつぶさない・§12）
  app.use((err: Error & { type?: string; status?: number }, _req: Request, res: Response, _next: NextFunction) => {
    const entry = {
      time: new Date().toISOString(),
      method: _req.method,
      url: _req.originalUrl,
      message: err.message,
      type: err.type,
      stack: err.stack,
    }
    recentErrors.push(entry)
    if (recentErrors.length > 20) recentErrors.shift()
    console.error('[mock] unhandled error:', _req.method, _req.originalUrl, err.message, err.type, err.stack)
    // body-parser のエラーは適切なステータスを返す（413=too large, 400=malformed JSON）
    const status = err.status ?? 500
    const message = status === 413
      ? 'リクエストが大きすぎます。'
      : status === 400
        ? `リクエストの解析に失敗しました: ${err.message}`
        : 'サーバーエラーが発生しました。'
    res.status(status).json(errorEnvelope('internal_server_error', message))
  })

  return app
}

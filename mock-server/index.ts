/**
 * モックサーバー起動（企画書 §10-1・§10-7・§10-9）。
 * `npm run mock` で追加設定なしに起動する（§13-H）。
 */
// ★最初に読む: store など import 時に env を読むモジュールより前に .env を反映する。
import './load-env.ts'
import { createServer } from 'node:http'
import { createApp } from './app.ts'
import { MOCK_PORT, PREFIX } from './config.ts'
import { attachCable } from './ws/cable.ts'
import { startTaskRunner } from './task-runner.ts'
import { flushArticleHistoryNow, startArticleHistoryPersistence } from './store/article-history-file.ts'
import { getState } from './store/store.ts'
import { seedSbWidgetMedia } from './lib/sb-widget-media.ts'
import { flushPersistNow } from './store/persistence.ts'
import { startPersistAlerts } from './persist-alert.ts'
import { pgMeasureDb } from './store/measure-db.ts'
import { startMeasurementStore } from './store/measure-startup.ts'

// 変更・復元履歴を読み戻し、以後はファイルにも書く（DATA_DIR があるときだけ。デプロイで消えていた）
startArticleHistoryPersistence(getState())

// SquadBeyond の Widget が使う画像など（SBの置き場から写したもの）を /uploads に置く（2026-10-26・あるものは書き直さない）
const placedSbMedia = seedSbWidgetMedia()
if (placedSbMedia > 0) console.log(`[mock] 取り込んだ見本の画像などを /uploads に ${placedSbMedia}個 置きました`)

const app = createApp()
const server = createServer(app)
attachCable(server)

// 数字の保存に失敗した・直った・重くなってきたを、異常のお知らせと同じ送り先へ知らせる（2026-10-29）
startPersistAlerts()

// 数字の記録をしまうデータベース（DATABASE_URL があるときだけ・2026-10-29 本人「OK進めて」）。
// 受け付けを始める前・定期タスクより前に、写す／読み戻す（読み戻すあいだに数字が増えたり、見張りが空の数字で判定したりしないように）。
// MEASURE_SOURCE=db で数字はデータベースが正になる（それまでは試しの期間＝state.json が正で、データベースへも写す）
const databaseUrl = process.env['DATABASE_URL']
if (databaseUrl !== undefined && databaseUrl !== '') {
  await startMeasurementStore(pgMeasureDb(databaseUrl), process.env['MEASURE_SOURCE'] === 'db' ? 'db' : 'json')
}

// 定期タスクの見張り。サーバーが動いている間だけ回る。
// テスト（app を直に使う）では回らないので、実行時刻に左右されない。
startTaskRunner()

// Railway は更新（デプロイ）のたびに SIGTERM で止める。保存待ちの数字（0.4秒ぶん）と変更履歴（1.5秒ぶん）を
// 書いてから終わる（以前は待たずに終わっていて、止める直前の分が消えることがあった・2026-10-29）。
// データベースへの書き込みは終わるまで待つ（Railway は RAILWAY_DEPLOYMENT_DRAINING_SECONDS の間だけ待ってくれる）
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    console.log(`[mock] ${signal} を受けたので、保存待ちを書いてから終わります`)
    flushArticleHistoryNow()
    flushPersistNow()
      .catch((error: unknown) => {
        console.error('[mock] 止める前の保存に失敗しました:', (error as Error).message)
      })
      .finally(() => process.exit(0))
  })
}

server.listen(MOCK_PORT, () => {
  console.log(`[mock] http://localhost:${MOCK_PORT}`)
  console.log(`[mock]   API      ${PREFIX.api}/*`)
  console.log(`[mock]   workers  ${PREFIX.workers}/*`)
  console.log(`[mock]   report   ${PREFIX.report}/*`)
  console.log(`[mock]   cable    ws://localhost:${MOCK_PORT}${PREFIX.cable}`)
  console.log('[mock] 既定シード: 新規アカウント（空）。リセットは POST /__mock/reset または ?reset=1')
})

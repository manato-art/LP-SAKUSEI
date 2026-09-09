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

const app = createApp()
const server = createServer(app)
attachCable(server)

// 定期タスクの見張り。サーバーが動いている間だけ回る。
// テスト（app を直に使う）では回らないので、実行時刻に左右されない。
startTaskRunner()

server.listen(MOCK_PORT, () => {
  console.log(`[mock] http://localhost:${MOCK_PORT}`)
  console.log(`[mock]   API      ${PREFIX.api}/*`)
  console.log(`[mock]   workers  ${PREFIX.workers}/*`)
  console.log(`[mock]   report   ${PREFIX.report}/*`)
  console.log(`[mock]   cable    ws://localhost:${MOCK_PORT}${PREFIX.cable}`)
  console.log('[mock] 既定シード: 新規アカウント（空）。リセットは POST /__mock/reset または ?reset=1')
})

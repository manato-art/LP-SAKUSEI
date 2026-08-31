/**
 * モックサーバー起動（企画書 §10-1・§10-7・§10-9）。
 * `npm run mock` で追加設定なしに起動する（§13-H）。
 */
import { createServer } from 'node:http'
import { createApp } from './app.ts'
import { MOCK_PORT, PREFIX } from './config.ts'
import { attachCable } from './ws/cable.ts'

const app = createApp()
const server = createServer(app)
attachCable(server)

server.listen(MOCK_PORT, () => {
  console.log(`[mock] http://localhost:${MOCK_PORT}`)
  console.log(`[mock]   API      ${PREFIX.api}/*`)
  console.log(`[mock]   workers  ${PREFIX.workers}/*`)
  console.log(`[mock]   report   ${PREFIX.report}/*`)
  console.log(`[mock]   cable    ws://localhost:${MOCK_PORT}${PREFIX.cable}`)
  console.log('[mock] 既定シード: 新規アカウント（空）。リセットは POST /__mock/reset または ?reset=1')
})

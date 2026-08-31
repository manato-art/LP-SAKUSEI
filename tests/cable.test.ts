/**
 * ActionCable モックの検証（企画書 §9-3・§10-7）。
 * 封筒の形と、「公開中Versionがあるときだけ合成CVが流れる」挙動を確認する。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import { WebSocket } from 'ws'
import { createApp } from '../mock-server/app.ts'
import { attachCable } from '../mock-server/ws/cable.ts'
import { resetState } from '../mock-server/store/store.ts'
import { postJson } from './helpers/server.ts'

const CONVERSIONS_CHANNEL = JSON.stringify({ channel: 'ConversionsChannel' })

let server: Server
let cable: { close: () => void }
let baseUrl: string
let wsUrl: string
const openSockets: WebSocket[] = []

beforeAll(async () => {
  server = createServer(createApp())
  cable = attachCable(server)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('ポート取得に失敗しました')
  baseUrl = `http://127.0.0.1:${address.port}/api/v1`
  wsUrl = `ws://127.0.0.1:${address.port}/cable`
})

afterAll(async () => {
  for (const socket of openSockets) socket.terminate()
  cable.close()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

beforeEach(() => {
  resetState()
})

interface Frame {
  type?: string
  identifier?: string
  message?: { conversion?: Record<string, unknown> }
}

/**
 * 受信フレームをバッファする接続。
 * welcome は接続直後にサーバーから送られるため、open後にリスナを張ると取りこぼす。
 */
interface CableClient {
  socket: WebSocket
  frames: Frame[]
}

function connect(): Promise<CableClient> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl)
    const frames: Frame[] = []
    openSockets.push(socket)
    socket.on('message', (raw) => {
      try {
        frames.push(JSON.parse(String(raw)) as Frame)
      } catch {
        frames.push({})
      }
    })
    socket.once('open', () => resolve({ socket, frames }))
    socket.once('error', reject)
  })
}

/** 条件に合うフレームが（既に届いた分も含めて）現れるまで待つ */
async function waitForFrame(
  client: CableClient,
  predicate: (frame: Frame) => boolean,
  timeoutMs: number,
): Promise<Frame> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const found = client.frames.find(predicate)
    if (found !== undefined) return found
    if (Date.now() > deadline) {
      throw new Error(`${timeoutMs}ms 以内に該当フレームが来ませんでした`)
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
}

describe('ActionCable の封筒（§10-7）', () => {
  it('接続直後に welcome が来る', async () => {
    const client = await connect()
    const frame = await waitForFrame(client, (f) => f.type === 'welcome', 2000)
    expect(frame).toEqual({ type: 'welcome' })
    client.socket.close()
  })

  it('subscribe に confirm_subscription で応答する', async () => {
    const client = await connect()
    await waitForFrame(client, (f) => f.type === 'welcome', 2000)
    client.socket.send(JSON.stringify({ command: 'subscribe', identifier: CONVERSIONS_CHANNEL }))
    const frame = await waitForFrame(client, (f) => f.type === 'confirm_subscription', 2000)
    expect(frame.identifier).toBe(CONVERSIONS_CHANNEL)
    client.socket.close()
  })

  it('定期 ping が来る', async () => {
    const client = await connect()
    const frame = await waitForFrame(client, (f) => f.type === 'ping', 6000)
    expect(typeof (frame as { message?: unknown }).message).toBe('number')
    client.socket.close()
  }, 8000)

  it('不正なフレームを受け取っても落ちない', async () => {
    const client = await connect()
    await waitForFrame(client, (f) => f.type === 'welcome', 2000)
    client.socket.send('これはJSONではない')
    // 落ちていなければ ping が届き続ける
    const frame = await waitForFrame(client, (f) => f.type === 'ping', 6000)
    expect(frame.type).toBe('ping')
    client.socket.close()
  }, 8000)
})

describe('CV速報の発火条件（§1-4・§10-9）', () => {
  it('公開中Versionがあると合成CVが流れ、ストアにも積まれる', async () => {
    const created = await postJson<{ version: { uid: string } }>(`${baseUrl}/ab_tests`, {
      title: 'サンプル施策001',
      media_id: 1,
    })
    await postJson(`${baseUrl}/versions/${created.json.version.uid}/publish`)

    const client = await connect()
    await waitForFrame(client, (f) => f.type === 'welcome', 2000)
    client.socket.send(JSON.stringify({ command: 'subscribe', identifier: CONVERSIONS_CHANNEL }))

    const frame = await waitForFrame(client, (f) => f.message?.conversion !== undefined, 12000)
    const conversion = frame.message?.conversion ?? {}
    expect(frame.identifier).toBe(CONVERSIONS_CHANNEL)
    // §10-7 のpayload形状
    expect(Object.keys(conversion).sort()).toEqual(
      ['ab_test_title', 'ab_test_uid', 'amount', 'media', 'occurred_at', 'uid', 'version_name'].sort(),
    )
    expect(conversion['ab_test_title']).toBe('サンプル施策001')
    expect(typeof conversion['amount']).toBe('number')
    client.socket.close()

    // GET /conversions にも反映されている（初期GET + WS pushの二段・§10-7）
    const list = await fetch(`${baseUrl}/conversions`)
    const body = (await list.json()) as { conversions: unknown[] }
    expect(body.conversions.length).toBeGreaterThan(0)
  }, 20000)
})

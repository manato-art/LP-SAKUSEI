/**
 * ActionCable(`/cable`)モック（企画書 §10-7）。Rails ActionCable の封筒を忠実に模倣する。
 * 本番WSには一切接続しない（§3-2）。
 *
 * CVは**実測のみ**を流す。以前は3-8秒おきに架空のCVを合成してストアにも積んでいたが、
 * 数字を実務で使う前提になったため廃止した（偽のCV/CVR/CPAが混ざるのを防ぐ）。
 * 発火経路は計測タグ由来の1本だけ: `POST /lp/:uid/__track` の event:'cv'。
 */
import { WebSocketServer, type WebSocket } from 'ws'
import type { Server } from 'node:http'
import { CABLE_PING_MS, PREFIX } from '../config.ts'

const CONVERSIONS_CHANNEL = JSON.stringify({ channel: 'ConversionsChannel' })

/** 現在接続中のクライアント（CV速報のpush先）。サーバー起動中だけ非null。 */
let activeClients: Set<CableClient> | null = null

/** CV速報チャンネルへ流す1件の形（採取した実ペイロードの封筒に合わせる） */
export interface ConversionPush {
  uid: string
  ab_test_uid: string
  ab_test_title: string
  version_name: string
  media: { name: string; icon_name: string } | null
  amount: number
  occurred_at: string
}

/**
 * 実測CVをCV速報チャンネルへpushする。合成CVを廃止したため、これが唯一の発火経路。
 * WSが動いていなければ黙って何もしない（計測自体はHTTP側で完了している）。
 */
export function broadcastConversion(conversion: ConversionPush): void {
  if (activeClients === null) return
  const payload = { identifier: CONVERSIONS_CHANNEL, message: { conversion } }
  for (const client of activeClients) {
    if (client.subscriptions.has(CONVERSIONS_CHANNEL)) send(client.socket, payload)
  }
}

interface CableClient {
  socket: WebSocket
  subscriptions: Set<string>
}

function send(socket: WebSocket, payload: unknown): void {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(payload))
}

export interface CableHandle {
  wss: WebSocketServer
  /** ping / CV push のタイマーを止め、全接続を閉じる。停止し忘れるとプロセスが終了しない。 */
  close: () => void
}

export function attachCable(server: Server): CableHandle {
  const wss = new WebSocketServer({ server, path: PREFIX.cable })
  const clients = new Set<CableClient>()

  wss.on('connection', (socket) => {
    const client: CableClient = { socket, subscriptions: new Set() }
    clients.add(client)

    // 接続直後
    send(socket, { type: 'welcome' })

    socket.on('message', (raw) => {
      let parsed: { command?: string; identifier?: string }
      try {
        parsed = JSON.parse(String(raw)) as { command?: string; identifier?: string }
      } catch {
        // 不正なフレームは無視する（本家も同様に落ちない）
        return
      }
      if (parsed.command === 'subscribe' && typeof parsed.identifier === 'string') {
        client.subscriptions.add(parsed.identifier)
        send(socket, { type: 'confirm_subscription', identifier: parsed.identifier })
      }
      if (parsed.command === 'unsubscribe' && typeof parsed.identifier === 'string') {
        client.subscriptions.delete(parsed.identifier)
      }
    })

    socket.on('close', () => clients.delete(client))
    socket.on('error', () => clients.delete(client))
  })

  // 定期ping（§10-7）
  const pingTimer = setInterval(() => {
    for (const client of clients) {
      send(client.socket, { type: 'ping', message: Math.floor(Date.now() / 1000) })
    }
  }, CABLE_PING_MS)

  // CV速報push: 合成CV（3-8秒おきの架空CV）は廃止した。
  // 数字を実務で使う前提になったため、CVは計測タグ由来の実測だけを流す
  // （`POST /lp/:uid/__track` の event:'cv' → recordConversion → broadcastConversion）。
  // 流入が無ければCV速報は静かなままになるが、それが正しい状態。
  activeClients = clients

  const close = (): void => {
    clearInterval(pingTimer)
    for (const client of clients) client.socket.terminate()
    clients.clear()
    activeClients = null
    wss.close()
  }

  // HTTPサーバーが閉じたらタイマーも必ず止める（止めないとプロセスが終了しない）
  server.on('close', close)
  wss.on('close', () => {
    clearInterval(pingTimer)
    activeClients = null
  })

  return { wss, close }
}

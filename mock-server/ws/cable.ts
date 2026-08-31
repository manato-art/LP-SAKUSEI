/**
 * ActionCable(`/cable`)モック（企画書 §10-7）。Rails ActionCable の封筒を忠実に模倣する。
 * 本番WSには一切接続しない（§3-2）。CVは合成で3-8秒おきにpushし、ストアにも積む（§10-9）。
 */
import { WebSocketServer, type WebSocket } from 'ws'
import type { Server } from 'node:http'
import { CABLE_PING_MS, CV_PUSH_MAX_MS, CV_PUSH_MIN_MS, PREFIX } from '../config.ts'
import { recordConversion } from '../store/actions.ts'
import { getState, setState } from '../store/store.ts'
import { createRng } from '../store/rng.ts'
import { AVERAGE_UNIT_PRICE } from '../store/metrics.ts'

const CONVERSIONS_CHANNEL = JSON.stringify({ channel: 'ConversionsChannel' })

interface CableClient {
  socket: WebSocket
  subscriptions: Set<string>
}

/** CV金額のばらつき（合成） */
const AMOUNT_RANGE: readonly [number, number] = [
  Math.round(AVERAGE_UNIT_PRICE * 0.5),
  Math.round(AVERAGE_UNIT_PRICE * 1.5),
]

function send(socket: WebSocket, payload: unknown): void {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(payload))
}

/**
 * push対象の公開中Versionを1つ選ぶ。
 * 公開中Versionが無い＝まだ配信していない新規アカウントなので、CVは発生しない（§1-4）。
 */
function pickPublishedTarget(tick: number): {
  abTestUid: string
  abTestTitle: string
  versionUid: string
  versionName: string
  mediaId: number | null
} | null {
  const state = getState()
  const published = state.versions.filter((v) => v.status === '公開中')
  if (published.length === 0) return null
  const rng = createRng(tick)
  const version = rng.pick(published)
  const article = state.articles.find((a) => a.id === version.article_id)
  const abTest = state.abTests.find((t) => t.id === article?.ab_test_id)
  if (abTest === undefined) return null
  return {
    abTestUid: abTest.uid,
    abTestTitle: abTest.title,
    versionUid: version.uid,
    versionName: version.name,
    mediaId: abTest.media_id,
  }
}

export function attachCable(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: PREFIX.cable })
  const clients = new Set<CableClient>()
  let tick = 0

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

  // CV速報push（3-8秒ランダム・§10-7）
  const scheduleCv = (): NodeJS.Timeout => {
    const rng = createRng(tick + 1)
    const wait = CV_PUSH_MIN_MS + Math.floor(rng.next() * (CV_PUSH_MAX_MS - CV_PUSH_MIN_MS))
    return setTimeout(() => {
      tick += 1
      const target = pickPublishedTarget(tick)
      if (target !== null) {
        const rng2 = createRng(tick * 7919)
        const amount = rng2.int(AMOUNT_RANGE[0], AMOUNT_RANGE[1])
        let conversion = null
        setState((state) => {
          const out = recordConversion(state, {
            ab_test_uid: target.abTestUid,
            version_uid: target.versionUid,
            media_id: target.mediaId,
            amount,
          })
          conversion = out.conversion
          return out.state
        })
        const media = getState().media.find((m) => m.id === target.mediaId)
        const payload = {
          identifier: CONVERSIONS_CHANNEL,
          message: {
            conversion: {
              uid: (conversion as { uid?: string } | null)?.uid ?? '',
              ab_test_uid: target.abTestUid,
              ab_test_title: target.abTestTitle,
              version_name: target.versionName,
              media:
                media === undefined ? null : { name: media.name, icon_name: media.icon_name },
              amount,
              occurred_at: new Date().toISOString(),
            },
          },
        }
        for (const client of clients) {
          if (client.subscriptions.has(CONVERSIONS_CHANNEL)) send(client.socket, payload)
        }
      }
      cvTimer = scheduleCv()
    }, wait)
  }
  let cvTimer = scheduleCv()

  wss.on('close', () => {
    clearInterval(pingTimer)
    clearTimeout(cvTimer)
  })

  return wss
}

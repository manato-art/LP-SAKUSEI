/**
 * CV速報の自動更新（2026-09-24・点検33）。
 *
 * サーバーは計測タグから CV が届くと /cable（ActionCable の形・mock-server/ws/cable.ts）へ流していたが、
 * 画面はつないでいなかったので、開きっぱなしでも新しい CV が出なかった。
 * 本番でも /cable は同じサーバーが持っている（mock-server/index.ts の attachCable）ので WebSocket でつなぐ。
 * 管理画面のログインの Cookie が要る（同じ場所から開くので自動で付く）。
 *
 * 切れたら状態を知らせて、少し待ってつなぎ直す（黙って止まらない）。
 */

const CONVERSIONS_CHANNEL = JSON.stringify({ channel: 'ConversionsChannel' })

/** 画面に出す自動更新の状態 */
export type LiveStatus = 'connecting' | 'live' | 'reconnecting'

export interface LiveOptions {
  url: string
  onConversion: (conversion: unknown) => void
  onStatus: (status: LiveStatus) => void
  /**
   * まだ画面が出ているか。false になったら（別の画面へ移ったら）つなぎっぱなしにせず止める。
   * サーバーは数秒おきに ping を送るので、画面を離れたあと遅くとも次の ping で止まる。
   */
  isActive?: () => boolean
  /** テストで差し替える */
  socketClass?: typeof WebSocket
  /** 切れてからつなぎ直すまでの待ち時間 */
  retryMs?: number
}

/** 今のページと同じ場所の /cable */
export function cableUrl(): string {
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/cable`
}

/** CV速報のチャンネルを購読する。返した関数を呼ぶと止める（画面を離れるとき） */
export function subscribeConversions(options: LiveOptions): () => void {
  const Socket = options.socketClass ?? WebSocket
  const retryMs = options.retryMs ?? 5000
  let socket: WebSocket | null = null
  let isStopped = false
  let retryTimer: ReturnType<typeof setTimeout> | null = null

  const stop = (): void => {
    isStopped = true
    if (retryTimer !== null) clearTimeout(retryTimer)
    socket?.close()
  }
  const isActive = (): boolean => options.isActive?.() ?? true

  const connect = (): void => {
    if (!isActive()) {
      stop()
      return
    }
    options.onStatus('connecting')
    const current = new Socket(options.url)
    socket = current
    current.onopen = () => {
      current.send(JSON.stringify({ command: 'subscribe', identifier: CONVERSIONS_CHANNEL }))
      options.onStatus('live')
    }
    current.onmessage = (event: MessageEvent) => {
      if (!isActive()) {
        stop()
        return
      }
      let frame: { identifier?: unknown; message?: { conversion?: unknown } }
      try {
        frame = JSON.parse(String(event.data)) as typeof frame
      } catch (error) {
        console.error('[cv-live] 読めない知らせを受け取りました', error)
        return
      }
      if (frame.identifier !== CONVERSIONS_CHANNEL) return
      const conversion = frame.message?.conversion
      if (conversion !== undefined) options.onConversion(conversion)
    }
    current.onclose = () => {
      if (isStopped) return
      options.onStatus('reconnecting')
      retryTimer = setTimeout(connect, retryMs)
    }
    // error の後には必ず close が来る。つなぎ直しは close の側で1回だけ行う
    current.onerror = () => undefined
  }

  connect()
  return stop
}

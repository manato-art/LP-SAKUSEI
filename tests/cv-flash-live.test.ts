/**
 * CV速報・ランキングのページ送り／CSV全件／自動更新（2026-09-24 点検33）。
 *
 * 以前は件数を指定せずに頼んでいたのでサーバーの既定20件で切れ、「1 ~ N件」のままページ送りも無く、
 * CSV も表示中の行だけだった。サーバーは CV を /cable へ流していたのに、画面はつないでいなかった。
 * 読み込みに失敗しても 0件と同じ表示になっていた（getJson が失敗を null にしていた）。
 */
import { describe, expect, it, vi } from 'vitest'
import { fetchAllPages, pageRangeLabel, requestJson } from '../src/app/pages/data-ui.ts'
import { subscribeConversions } from '../src/app/pages/live-conversions.ts'

describe('件数の表示', () => {
  it('何件目から何件目か・全部で何件かを出す', () => {
    expect(pageRangeLabel({ page: 2, perPage: 50, shown: 50, total: 120 })).toBe('51 ~ 100件を表示中（全120件）')
    expect(pageRangeLabel({ page: 1, perPage: 50, shown: 0, total: 0 })).toBe('1 ~ 0件を表示中')
  })
})

describe('CSV は期間の全件', () => {
  it('ページを最後までたどって全部集める', async () => {
    const fetchPage = vi.fn(async (page: number) => ({
      items: page === 1 ? ['a', 'b'] : page === 2 ? ['c'] : [],
      totalPages: 2,
    }))
    expect(await fetchAllPages(fetchPage)).toEqual(['a', 'b', 'c'])
    expect(fetchPage).toHaveBeenCalledTimes(2)
  })
})

describe('読み込みの失敗を0件にしない', () => {
  it('失敗したら理由つきで投げる（null にしない）', async () => {
    const original = globalThis.fetch
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: { code: 'unauthorized', message: '認証が必要です。' } }), { status: 401 }),
    ) as unknown as typeof fetch
    await expect(requestJson('/conversions')).rejects.toThrow('認証が必要です。')
    globalThis.fetch = original
  })
})

describe('CV の自動更新（/cable）', () => {
  class FakeSocket {
    static last: FakeSocket | null = null
    sent: string[] = []
    onopen: (() => void) | null = null
    onmessage: ((event: { data: string }) => void) | null = null
    onclose: (() => void) | null = null
    onerror: (() => void) | null = null
    closed = false
    constructor(readonly url: string) {
      FakeSocket.last = this
    }
    send(data: string): void {
      this.sent.push(data)
    }
    close(): void {
      this.closed = true
    }
  }

  it('つながったら CV速報のチャンネルを購読し、CV が届いたら知らせる', () => {
    const onConversion = vi.fn()
    const stop = subscribeConversions({
      url: 'ws://localhost/cable',
      onConversion,
      onStatus: () => undefined,
      socketClass: FakeSocket as unknown as typeof WebSocket,
    })
    const socket = FakeSocket.last!
    socket.onopen?.()
    expect(JSON.parse(socket.sent[0] ?? '{}')).toEqual({
      command: 'subscribe',
      identifier: JSON.stringify({ channel: 'ConversionsChannel' }),
    })
    socket.onmessage?.({ data: JSON.stringify({ type: 'ping', message: 1 }) })
    expect(onConversion).not.toHaveBeenCalled()
    socket.onmessage?.({
      data: JSON.stringify({
        identifier: JSON.stringify({ channel: 'ConversionsChannel' }),
        message: { conversion: { uid: 'CV1' } },
      }),
    })
    expect(onConversion).toHaveBeenCalledWith({ uid: 'CV1' })
    stop()
    expect(socket.closed).toBe(true)
  })

  it('切れたら状態を知らせる（黙って止まらない）', () => {
    const onStatus = vi.fn()
    const stop = subscribeConversions({
      url: 'ws://localhost/cable',
      onConversion: () => undefined,
      onStatus,
      socketClass: FakeSocket as unknown as typeof WebSocket,
      retryMs: 60_000,
    })
    FakeSocket.last!.onopen?.()
    expect(onStatus).toHaveBeenLastCalledWith('live')
    FakeSocket.last!.onclose?.()
    expect(onStatus).toHaveBeenLastCalledWith('reconnecting')
    stop()
  })
})

describe('画面を離れたら止まる', () => {
  class Sock {
    static last: Sock | null = null
    onopen: (() => void) | null = null
    onmessage: ((event: { data: string }) => void) | null = null
    onclose: (() => void) | null = null
    onerror: (() => void) | null = null
    closed = false
    constructor(readonly url: string) {
      Sock.last = this
    }
    send(): void {}
    close(): void {
      this.closed = true
    }
  }

  it('次に何か届いたとき（ping でも）画面が無ければ閉じる', () => {
    let active = true
    const onConversion = vi.fn()
    subscribeConversions({
      url: 'ws://localhost/cable',
      isActive: () => active,
      onConversion,
      onStatus: () => undefined,
      socketClass: Sock as unknown as typeof WebSocket,
    })
    Sock.last!.onopen?.()
    active = false
    Sock.last!.onmessage?.({ data: JSON.stringify({ type: 'ping', message: 1 }) })
    expect(Sock.last!.closed).toBe(true)
    expect(onConversion).not.toHaveBeenCalled()
  })
})

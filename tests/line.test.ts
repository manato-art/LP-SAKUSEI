/**
 * LINEへのお知らせ（2026-09-15・本人の依頼）。
 *
 * ⚠️ **LINE Notify は2025-03-31で終わっている**。今つながる道は
 * LINE公式アカウントの Messaging API だけで、チャネルアクセストークン1本で送る。
 *
 * 送り先IDを決めていないときは「友だち全員へ」（broadcast）にする。
 * 自分のIDを調べるにはWebhookを立てるか開発者画面を見る必要があり、
 * そこで詰まって使えないより、友だちが自分だけのアカウントへ全員送りが実用的なため。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { LineError, LINE_TEXT_LIMIT, lineToken, postLine } from '../mock-server/line.ts'
import { NotifyError, sendNotification } from '../mock-server/notify.ts'
import { getState, setState } from '../mock-server/store/store.ts'

interface Sent {
  url: string
  headers: Record<string, string>
  body: { to?: string; messages: { type: string; text: string }[] }
}

/** fetch を差し替えて、送った中身を覗けるようにする */
function stubFetch(reply: { ok: boolean; status?: number; json?: unknown }): {
  sent: Sent[]
} {
  const sent: Sent[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const options = (init ?? {}) as RequestInit
    sent.push({
      url: String(input),
      headers: (options.headers ?? {}) as Record<string, string>,
      body: JSON.parse(String(options.body ?? '{}')) as Sent['body'],
    })
    return Promise.resolve({
      ok: reply.ok,
      status: reply.status ?? (reply.ok ? 200 : 400),
      json: () => Promise.resolve(reply.json ?? {}),
    } as Response)
  })
  return { sent }
}

const KEEP = process.env['LINE_CHANNEL_ACCESS_TOKEN']

beforeEach(() => {
  delete process.env['LINE_CHANNEL_ACCESS_TOKEN']
})

afterEach(() => {
  vi.restoreAllMocks()
  if (KEEP === undefined) delete process.env['LINE_CHANNEL_ACCESS_TOKEN']
  else process.env['LINE_CHANNEL_ACCESS_TOKEN'] = KEEP
})

describe('トークンの読み方', () => {
  it('環境変数が最優先（本番は環境変数で上書きできる）', () => {
    setState((s) => ({
      ...s,
      integrations: { ...s.integrations, lineChannelAccessToken: '画面から入れたもの' },
    }))
    process.env['LINE_CHANNEL_ACCESS_TOKEN'] = '環境変数のもの'
    expect(lineToken()).toBe('環境変数のもの')
  })

  it('環境変数が無ければ画面から入れたものを使う', () => {
    setState((s) => ({
      ...s,
      integrations: { ...s.integrations, lineChannelAccessToken: '画面から入れたもの' },
    }))
    expect(lineToken()).toBe('画面から入れたもの')
  })

  it('どちらも空なら未設定として扱う', () => {
    setState((s) => ({ ...s, integrations: { ...s.integrations, lineChannelAccessToken: '' } }))
    expect(lineToken()).toBeNull()
  })

  it('トークンをコードに書かない', () => {
    const src = readFileSync('mock-server/line.ts', 'utf8')
    expect(src).toContain("process.env['LINE_CHANNEL_ACCESS_TOKEN']")
    // 値そのものが埋まっていないこと（LINEのトークンは長いBase64風の文字列）
    expect(src).not.toMatch(/[A-Za-z0-9+/]{80,}/)
  })

  it('返す値に生のトークンを混ぜない（状態には持つが画面へは出さない）', () => {
    setState((s) => ({ ...s, integrations: { ...s.integrations, lineChannelAccessToken: 'tok' } }))
    expect(getState().integrations.lineChannelAccessToken).toBe('tok')
  })
})

describe('送り方', () => {
  it('送り先を決めていなければ友だち全員へ送る', async () => {
    const { sent } = stubFetch({ ok: true })
    await postLine('TOKEN', '', 'CVが止まりました')

    expect(sent).toHaveLength(1)
    expect(sent[0]?.url).toBe('https://api.line.me/v2/bot/message/broadcast')
    expect(sent[0]?.body.to, '全員へ送るときは宛先を付けない').toBeUndefined()
    expect(sent[0]?.body.messages).toEqual([{ type: 'text', text: 'CVが止まりました' }])
  })

  it('送り先のIDがあればその相手にだけ送る', async () => {
    const { sent } = stubFetch({ ok: true })
    await postLine('TOKEN', 'U4af4980629', 'CPAが上限を超えました')

    expect(sent[0]?.url).toBe('https://api.line.me/v2/bot/message/push')
    expect(sent[0]?.body.to).toBe('U4af4980629')
  })

  it('トークンは Authorization ヘッダーで渡す', async () => {
    const { sent } = stubFetch({ ok: true })
    await postLine('TOKEN', '', 'やあ')
    expect(sent[0]?.headers['Authorization']).toBe('Bearer TOKEN')
    expect(sent[0]?.headers['Content-Type']).toBe('application/json')
  })

  it('長すぎる文は上限までで切る（超えるとLINEが丸ごと弾く）', async () => {
    const { sent } = stubFetch({ ok: true })
    await postLine('TOKEN', '', 'あ'.repeat(LINE_TEXT_LIMIT + 500))

    const text = sent[0]?.body.messages[0]?.text ?? ''
    expect(text.length).toBe(LINE_TEXT_LIMIT)
    expect(text.endsWith('…'), '切ったことが読み手に分かる').toBe(true)
  })

  it('送れなかったらLINEの言い分をそのまま返す', async () => {
    stubFetch({ ok: false, status: 401, json: { message: 'Invalid channel access token' } })
    await expect(postLine('TOKEN', '', 'やあ')).rejects.toThrow(LineError)
    await expect(postLine('TOKEN', '', 'やあ')).rejects.toThrow(/Invalid channel access token/)
  })

  it('理由が読めないときもHTTPの状態を出す（黙って握りつぶさない）', async () => {
    stubFetch({ ok: false, status: 500, json: null })
    await expect(postLine('TOKEN', '', 'やあ')).rejects.toThrow(/500/)
  })
})

describe('送れなかった理由を画面まで通す', () => {
  it('LINEの言い分をそのまま NotifyError にして返す', async () => {
    setState((s) => ({ ...s, integrations: { ...s.integrations, lineChannelAccessToken: 'tok' } }))
    stubFetch({ ok: false, status: 401, json: { message: 'Invalid channel access token' } })

    // 「通知を送れませんでした」だけでは、トークンが悪いのか宛先が悪いのか分からない
    await expect(sendNotification('line', '', 'やあ')).rejects.toThrow(NotifyError)
    await expect(sendNotification('line', '', 'やあ')).rejects.toThrow(
      /Invalid channel access token/,
    )
  })

  it('トークンが無いときは、送る前にそう言う', async () => {
    setState((s) => ({ ...s, integrations: { ...s.integrations, lineChannelAccessToken: '' } }))
    await expect(sendNotification('line', '', 'やあ')).rejects.toThrow(/チャネルアクセストークン/)
  })
})

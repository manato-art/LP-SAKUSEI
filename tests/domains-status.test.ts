/**
 * ドメインの状態（ステータス / SSL）を実際に合わせる。
 *
 * 以前: どのドメインも登録したまま「確認中」「SSL OFF」から変わらなかった。
 * クイックドメインも実際に配信しているのに橙の「確認中」のままだった。
 *   - クイックドメインは発行した時点で使える（土台をこのシステムへ向けてあるのが前提の仕組み）→ アクティブ
 *   - 独自ドメインは「確認する」で、サーバーがDNSを引き、このシステムに届くか（https → http）を
 *     時間を区切って確かめ、状態とSSLを更新する（DNSは読むだけ。書き換えない）
 *   - 独自ドメインの入力はホスト名だけ（https:// やパス・空白は断る）。画面とサーバーで同じ決まり
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { validateDomainInput } from '../src/shared/domain-input.ts'
import { checkDomainReachability, type DomainCheckDeps } from '../mock-server/lib/domain-check.ts'
import { getJson, postJson, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'

describe('独自ドメインの入力', () => {
  it('ホスト名だけを受け付け、小文字にそろえる', () => {
    expect(validateDomainInput('  LP.Example.com ')).toEqual({ ok: true, host: 'lp.example.com' })
  })
  it('https:// やパス・空白・ポートは断る（理由つき）', () => {
    for (const bad of ['https://lp.example.com', 'lp.example.com/path', 'lp example.com', 'lp.example.com:8080', 'localhost', '']) {
      const r = validateDomainInput(bad)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.message).not.toBe('')
    }
  })
})

const ok = (): Promise<Response> => Promise.resolve(new Response('{"ok":true}', { status: 200 }))
const fail = (): Promise<Response> => Promise.reject(new Error('connect ECONNREFUSED'))

function deps(over: Partial<DomainCheckDeps>): DomainCheckDeps {
  return {
    lookup: () => Promise.resolve(['203.0.113.10']),
    fetchUrl: ok,
    timeoutMs: 200,
    ...over,
  }
}

describe('届くかの確認', () => {
  it('DNSで見つからなければエラー', async () => {
    const r = await checkDomainReachability('lp.example.com', deps({ lookup: () => Promise.reject(new Error('ENOTFOUND')) }))
    expect(r.status).toBe('error')
    expect(r.ssl).toBe(false)
    expect(r.message).toContain('DNS')
  })

  it('内部のアドレスを指していたら確かめに行かない', async () => {
    let fetched = false
    const r = await checkDomainReachability(
      'lp.example.com',
      deps({
        lookup: () => Promise.resolve(['127.0.0.1']),
        fetchUrl: () => {
          fetched = true
          return ok()
        },
      }),
    )
    expect(r.status).toBe('error')
    expect(fetched).toBe(false)
  })

  it('https で届けばアクティブ・SSL ON', async () => {
    const r = await checkDomainReachability('lp.example.com', deps({}))
    expect(r).toMatchObject({ status: 'active', ssl: true })
  })

  it('http でだけ届けばアクティブ・SSL OFF（証明書がまだ）', async () => {
    const r = await checkDomainReachability(
      'lp.example.com',
      deps({ fetchUrl: (url) => (url.startsWith('https:') ? fail() : ok()) }),
    )
    expect(r).toMatchObject({ status: 'active', ssl: false })
    expect(r.message).toContain('HTTPS')
  })

  it('DNSは向いているが届かなければ確認中のまま', async () => {
    const r = await checkDomainReachability('lp.example.com', deps({ fetchUrl: fail }))
    expect(r).toMatchObject({ status: 'pending', ssl: false })
  })

  it('DNSの応答が返ってこなくても、時間で区切って止まる', async () => {
    const started = Date.now()
    const r = await checkDomainReachability('lp.example.com', deps({ lookup: () => new Promise(() => undefined), timeoutMs: 50 }))
    expect(r.status).toBe('error')
    expect(Date.now() - started).toBeLessThan(2000)
  })
})

describe('ドメインのAPI', () => {
  let server: TestServer
  beforeAll(async () => {
    server = await startTestServer()
  })
  afterAll(async () => {
    await server.close()
  })
  beforeEach(() => {
    resetStore()
  })

  it('https:// 付きは422で断る', async () => {
    const res = await postJson<{ error: { message: string } }>(`${server.api}/teams/domains`, { host: 'https://lp.example.com/' })
    expect(res.status).toBe(422)
  })

  it('ホスト名だけなら登録でき（確認中）、同じものは2回登録しない', async () => {
    const res = await postJson<{ domain: { host: string; status: string; checked_at: number | null } }>(
      `${server.api}/teams/domains`,
      { host: 'LP.example.test' },
    )
    expect(res.status).toBe(201)
    expect(res.json.domain.host).toBe('lp.example.test')
    expect(res.json.domain.status).toBe('pending')
    expect(res.json.domain.checked_at).toBeNull()
    const again = await postJson(`${server.api}/teams/domains`, { host: 'lp.example.test' })
    expect(again.status).toBe(409)
  })

  it('「確認する」で状態が更新される（名前解決できない .test はエラー）', async () => {
    const created = await postJson<{ domain: { uid: string } }>(`${server.api}/teams/domains`, { host: 'nothing-here.example.test' })
    const res = await postJson<{ domain: { status: string; ssl: boolean; checked_at: number | null; check_message: string } }>(
      `${server.api}/teams/domains/${created.json.domain.uid}/check`,
    )
    expect(res.status).toBe(200)
    expect(res.json.domain.status).toBe('error')
    expect(res.json.domain.ssl).toBe(false)
    expect(res.json.domain.checked_at).not.toBeNull()
    expect(res.json.domain.check_message).not.toBe('')
  }, 15_000)

  it('無いドメインの確認は404', async () => {
    const res = await postJson(`${server.api}/teams/domains/nope/check`)
    expect(res.status).toBe(404)
  })

  it('クイックドメインは発行した時点でアクティブ', async () => {
    await sendJson('PUT', `${server.api}/teams/quick_domain`, { base: 'lp-example.test' })
    const folder = await postJson<{ folder: { uid: string } }>(`${server.api}/folders`, { name: 'F' })
    await postJson(`${server.api}/folders/${folder.json.folder.uid}/quick_domain`)
    const list = await getJson<{ domains: { kind?: string; status: string }[] }>(`${server.api}/teams/domains`)
    expect(list.domains.find((d) => d.kind === 'quick')?.status).toBe('active')
  })
})

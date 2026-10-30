/**
 * 見に来た人の住所（IP）を、Cloudflare を通っても正しく読む（2026-10-30 本人「①は進めて」）。
 *
 * c1page.com は Cloudflare を通る。Railway の受付は X-Forwarded-For の先頭を「直前の相手」にするので、
 * Cloudflare を通った訪問は全員が Cloudflare の住所に見えていた（本番の記録で 4件中4件・141.101.x / 172.70.x）。
 * そのため IP でのレポート除外が c1page.com のLPでは効かなかった。
 *
 * 直前の相手が Cloudflare の公開範囲（cloudflare.com/ips）のときだけ、Cloudflare が付ける CF-Connecting-IP を使う。
 * それ以外では CF-Connecting-IP を見ない（Cloudflare を通らずに来た人が、住所を名乗って偽れないように）。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { isCloudflareIp, visitorIp } from '../mock-server/lib/visitor-ip.ts'
import { getJson, issueCreatedPage, postJson, resetStore, startTestServer, type TestServer } from './helpers/server.ts'

const headers = (h: Record<string, string>) => (name: string) => h[name.toLowerCase()]

describe('Cloudflare の住所の範囲', () => {
  it('公開範囲の住所（IPv4・IPv6）は Cloudflare', () => {
    expect(isCloudflareIp('141.101.65.10')).toBe(true)
    expect(isCloudflareIp('172.70.1.2')).toBe(true)
    expect(isCloudflareIp('2606:4700:10::1')).toBe(true)
  })

  it('ふつうの住所・壊れた値は Cloudflare ではない', () => {
    expect(isCloudflareIp('203.0.113.5')).toBe(false)
    expect(isCloudflareIp('2001:db8::1')).toBe(false)
    expect(isCloudflareIp('これはIPではない')).toBe(false)
    expect(isCloudflareIp('')).toBe(false)
  })
})

describe('見に来た人の住所', () => {
  it('Cloudflare を通らずに来た（railway.app の住所）なら、今までどおり X-Forwarded-For の先頭', () => {
    expect(visitorIp(headers({ 'x-forwarded-for': '203.0.113.5' }), '10.0.0.1')).toBe('203.0.113.5')
  })

  it('Cloudflare を通って来たら、Cloudflare が付けた本当の訪問者の住所', () => {
    const get = headers({ 'x-forwarded-for': '141.101.65.10', 'cf-connecting-ip': '203.0.113.9' })
    expect(visitorIp(get, '10.0.0.1')).toBe('203.0.113.9')
  })

  it('IPv6 で来た訪問者も読める', () => {
    const get = headers({ 'x-forwarded-for': '2606:4700:10::1', 'cf-connecting-ip': '2001:db8::7' })
    expect(visitorIp(get, '10.0.0.1')).toBe('2001:db8::7')
  })

  it('Cloudflare を通らずに CF-Connecting-IP を名乗っても使わない（なりすまし防止）', () => {
    const get = headers({ 'x-forwarded-for': '203.0.113.5', 'cf-connecting-ip': '198.51.100.1' })
    expect(visitorIp(get, '10.0.0.1')).toBe('203.0.113.5')
  })

  it('Cloudflare からでも、本当の住所が無い・壊れているときは Cloudflare の住所のまま', () => {
    expect(visitorIp(headers({ 'x-forwarded-for': '141.101.65.10' }), '10.0.0.1')).toBe('141.101.65.10')
    expect(
      visitorIp(headers({ 'x-forwarded-for': '141.101.65.10', 'cf-connecting-ip': 'これはIPではない' }), '10.0.0.1'),
    ).toBe('141.101.65.10')
  })

  it('X-Forwarded-For が無ければ、つながっている相手の住所', () => {
    expect(visitorIp(headers({}), '10.0.0.1')).toBe('10.0.0.1')
  })
})

describe('レポート除外（IP）が c1page.com のLPでも効く', () => {
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

  it('Cloudflare を通って来た自分の住所を除外に入れておけば、数字に入らない', async () => {
    await postJson(`${server.api}/report-exclusions`, {
      conditions: [{ kind: 'ip', match_type: 'exact', value: '203.0.113.9', join: 'or' }],
    })
    const created = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, { title: '除外', media_id: 1 })
    await issueCreatedPage(server.api, created.json)
    const uid = created.json.ab_test.uid
    const res = await fetch(`${server.baseUrl}/lp/${uid}/__track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '141.101.65.10', 'CF-Connecting-IP': '203.0.113.9' },
      body: JSON.stringify({ event: 'pv' }),
    })
    expect(await res.json()).toMatchObject({ excluded: true })
    const report = await getJson<{ totals: { pv: number } }>(
      `${server.api}/ab_tests/${uid}/reports?start_date=2000-01-01&end_date=2099-12-31`,
    )
    expect(report.totals.pv).toBe(0)
  })
})

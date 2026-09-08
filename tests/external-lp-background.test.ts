/**
 * ヒートマップ背景に「実LP」を敷く経路の機械保証。
 *
 * 症状: 外部LP（別アカウントで配信中）はこのシステム側にVersion HTMLが無いため、
 *       ヒートマップの背景がサンプルLPのままになり、色の位置が実物と合わなかった。
 * 対策: 計測タグが最初のPVでページURLを知らせ、サーバーがそれを取得して背景に返す。
 *
 * ここで守りたいのは2つ:
 *   1. URLは計測タグ由来のものだけを使う（外から任意のURLを取りに行かせない）
 *   2. 保存するURLはクエリ・ハッシュを落とし、自前配信は「外部LP」にしない
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getJson, postJson, resetStore, startTestServer, type TestServer } from './helpers/server.ts'

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

async function createAbTest(): Promise<string> {
  const created = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, {
    title: '外部LP背景テスト',
    media_id: 1,
  })
  return created.json.ab_test.uid
}

/** 計測タグと同じ形でPVビーコンを送る */
async function sendPv(uid: string, pageUrl?: string): Promise<void> {
  await fetch(`${server.baseUrl}/lp/${uid}/__track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pageUrl === undefined ? { event: 'pv' } : { event: 'pv', u: pageUrl }),
  })
}

describe('外部LPの所在は計測タグのPVから覚える', () => {
  it('まだ1度も計測されていないLPは「場所が分からない」と返す（404）', async () => {
    const uid = await createAbTest()
    const res = await fetch(`${server.api}/ab_tests/${uid}/external_page`)
    expect(res.status).toBe(404)
  })

  it('PVでURLが届くと、その後は取得を試みる（＝場所を覚えている）', async () => {
    const uid = await createAbTest()
    // 到達できない私有アドレスを渡す。覚えていなければ404、覚えていればSSRF拒否の502になる。
    await sendPv(uid, 'http://10.1.2.3/lp')
    const res = await fetch(`${server.api}/ab_tests/${uid}/external_page`)
    expect(res.status).toBe(502)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('blocked_host')
  })

  it('クエリとハッシュは保存しない（広告パラメータや個人情報を残さない）', async () => {
    const uid = await createAbTest()
    await sendPv(uid, 'http://10.1.2.3/lp?u=gk_mt01&mail=a@example.test#top')
    const { ab_test } = await getJson<{ ab_test: { external_url?: string } }>(
      `${server.api}/ab_tests/${uid}`,
    )
    expect(ab_test.external_url).toBe('http://10.1.2.3/lp')
  })

  it('自前配信（同じホスト）は外部LP扱いしない', async () => {
    const uid = await createAbTest()
    await sendPv(uid, `${server.baseUrl}/lp/${uid}`)
    const res = await fetch(`${server.api}/ab_tests/${uid}/external_page`)
    expect(res.status).toBe(404)
  })

  it('http/https 以外のURLは覚えない', async () => {
    const uid = await createAbTest()
    await sendPv(uid, 'javascript:alert(1)')
    const res = await fetch(`${server.api}/ab_tests/${uid}/external_page`)
    expect(res.status).toBe(404)
  })

  it('URLを送らない従来のPVでも壊れない（PVは通常どおり計上される）', async () => {
    const uid = await createAbTest()
    await sendPv(uid)
    const res = await fetch(`${server.api}/ab_tests/${uid}/external_page`)
    expect(res.status).toBe(404)
  })
})

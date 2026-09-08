/**
 * 配信割合どおりに配信されることの機械保証（指示173）。
 *
 * 症状: 配信割合0%のVersionが配信URLで表示されることがあった。
 * 原因: 「割合1%以上の候補が無ければ割合を無視した候補へ落ちる」フォールバックと、
 *       重み付けの `Math.max(1, ratio)`（0%を1%扱い）。
 *
 * どのVersionが配信されたかは、配信HTMLに埋まる計測スクリプトのversion uidで判別する。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import { createApp } from '../mock-server/app.ts'
import { resetState } from '../mock-server/store/store.ts'
import { postJson } from './helpers/server.ts'

let server: Server
let origin: string
let baseUrl: string

beforeAll(async () => {
  server = createServer(createApp())
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('ポート取得に失敗しました')
  origin = `http://127.0.0.1:${address.port}`
  baseUrl = `${origin}/api/v1`
})

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

beforeEach(() => {
  resetState()
})

interface Created {
  ab_test: { uid: string }
  article: { uid: string }
  version: { uid: string }
}

/** beyondページ＋記事＋初期Version を作り、2本目のVersionも足す */
async function setupTwoVersions(): Promise<{
  abTestUid: string
  first: string
  second: string
}> {
  const created = await postJson<Created>(`${baseUrl}/ab_tests`, {
    title: '配信割合テスト',
    media_id: 1,
  })
  const added = await postJson<{ version: { uid: string } }>(
    `${baseUrl}/articles/${created.json.article.uid}/versions`,
  )
  return {
    abTestUid: created.json.ab_test.uid,
    first: created.json.version.uid,
    second: added.json.version.uid,
  }
}

async function setRatio(versionUid: string, ratio: number): Promise<void> {
  await fetch(`${baseUrl}/versions/${versionUid}/distribution`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ distribution_ratio: ratio }),
  })
}

/** 配信URLを1回引いて、配信されたVersionのuidを返す（計測スクリプトから読む） */
async function fetchDeliveredVersion(abTestUid: string): Promise<string | null> {
  const res = await fetch(`${origin}/lp/${abTestUid}`)
  if (!res.ok) return null
  const html = await res.text()
  const m = /V="(VERSION_[0-9A-Za-z_]+)"/.exec(html)
  return m?.[1] ?? null
}

describe('配信割合どおりに配信する（指示173）', () => {
  it('配信割合0%のVersionは配信されない', async () => {
    const { abTestUid, first, second } = await setupTwoVersions()
    await setRatio(first, 100)
    await setRatio(second, 0)

    const served = new Set<string>()
    for (let i = 0; i < 40; i++) {
      const uid = await fetchDeliveredVersion(abTestUid)
      if (uid !== null) served.add(uid)
    }
    expect(served.has(second), '0%のVersionが配信された').toBe(false)
    expect(served.has(first)).toBe(true)
  }, 20000)

  it('配信できる割合のVersionが1つも無ければ配信しない（無理に表示しない）', async () => {
    // Versionがちょうど2件のときは合計100%を保つ自動バランスが効くので両方0%にはできない。
    // 1件だけのときは0%にできる＝ここが「割合0%なのに表示される」の再現ケース。
    const created = await postJson<Created>(`${baseUrl}/ab_tests`, {
      title: '割合0%のみ',
      media_id: 1,
    })
    await setRatio(created.json.version.uid, 0)

    const res = await fetch(`${origin}/lp/${created.json.ab_test.uid}`)
    expect(res.status).toBe(404)
    expect(await res.text()).toContain('配信できるVersionがありません')
  }, 15000)

  it('プレビューは配信割合0%でも必ずそのVersionを表示する（検証用途）', async () => {
    const { first } = await setupTwoVersions()
    await setRatio(first, 0)

    const res = await fetch(`${origin}/preview/${first}`)
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('このLPは検証用です')
  }, 15000)
})

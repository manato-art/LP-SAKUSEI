/**
 * クイックドメイン（2026-09-13・本人承認）＝本体のフリードメインにあたる仕組みの機械証明。
 *
 * 土台ドメインを1本だけ登録（実運用では `*.土台` をワイルドカードでこのシステムへ向ける）しておけば、
 * フォルダごとに `<ランダム>.<土台>` を即発行できる。DNSもドメイン購入もフォルダごとには要らない。
 *
 * 配信は来たドメインで絞る（fail-closed）。あるフォルダのドメインで来たリクエストでは、
 * そのフォルダのLPだけを出す。読み取り（LP表示）だけでなく書き込み（計測ビーコン）も同じ扱いにする
 * ＝ KB-2026-06-26-001「認可ゲートが読み取り限定で書込側越境」の再発防止。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  getJson,
  postJson,
  requestWithHost,
  resetStore,
  sendJson,
  startTestServer,
  type TestServer,
} from './helpers/server.ts'

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

/** フォルダとその中のbeyondページを1つ作る */
async function createFolderWithPage(name: string): Promise<{ folderUid: string; abTestUid: string }> {
  const folder = await postJson<{ folder: { id: number; uid: string } }>(`${server.api}/folders`, { name })
  const page = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, {
    title: `${name}のページ`,
    media_id: 1,
    folder_id: folder.json.folder.id,
  })
  return { folderUid: folder.json.folder.uid, abTestUid: page.json.ab_test.uid }
}

async function setBase(base: string): Promise<{ status: number; json: unknown }> {
  return sendJson('PUT', `${server.api}/teams/quick_domain`, { base })
}

describe('クイックドメインの土台', () => {
  it('はじめは未設定', async () => {
    const data = await getJson<{ quick_domain: { base: string } }>(`${server.api}/teams/quick_domain`)
    expect(data.quick_domain.base).toBe('')
  })

  it('設定できる（大文字は小文字にそろえる）', async () => {
    expect((await setBase('LP-Example.Test')).status).toBe(200)
    const data = await getJson<{ quick_domain: { base: string } }>(`${server.api}/teams/quick_domain`)
    expect(data.quick_domain.base).toBe('lp-example.test')
  })

  it('Railwayの表記をそのまま貼っても受け付ける（先頭の *. を外す）', async () => {
    expect((await setBase('*.lp-example.test')).status).toBe(200)
    const data = await getJson<{ quick_domain: { base: string } }>(`${server.api}/teams/quick_domain`)
    expect(data.quick_domain.base).toBe('lp-example.test')
  })

  it('形がおかしければ受け付けない', async () => {
    expect((await setBase('http://lp-example.test')).status).toBe(422)
    expect((await setBase('ドメイン.test')).status).toBe(422)
    expect((await setBase('localhost')).status).toBe(422)
  })

  it('空文字にすれば未設定に戻せる', async () => {
    await setBase('lp-example.test')
    expect((await setBase('')).status).toBe(200)
    const data = await getJson<{ quick_domain: { base: string } }>(`${server.api}/teams/quick_domain`)
    expect(data.quick_domain.base).toBe('')
  })
})

describe('クイックドメインの発行', () => {
  it('土台が未設定なら発行できない（案内を返す）', async () => {
    const folder = await createFolderWithPage('未設定確認')
    const res = await postJson<{ error: { message: string } }>(
      `${server.api}/folders/${folder.folderUid}/quick_domain`,
    )
    expect(res.status).toBe(422)
    expect(res.json.error.message).toContain('土台')
  })

  it('発行すると「ランダム.土台」がそのフォルダのドメインになる', async () => {
    await setBase('lp-example.test')
    const folder = await createFolderWithPage('発行確認')
    const res = await postJson<{ folder: { domain: string } }>(
      `${server.api}/folders/${folder.folderUid}/quick_domain`,
    )
    expect(res.status).toBe(201)
    expect(res.json.folder.domain).toMatch(/^[a-z0-9]{8}\.lp-example\.test$/)
  })

  it('発行したドメインはドメイン一覧にも載る', async () => {
    await setBase('lp-example.test')
    const folder = await createFolderWithPage('一覧確認')
    const res = await postJson<{ folder: { domain: string } }>(
      `${server.api}/folders/${folder.folderUid}/quick_domain`,
    )
    const list = await getJson<{ domains: { host: string; kind?: string }[] }>(`${server.api}/teams/domains`)
    expect(list.domains.map((d) => d.host)).toContain(res.json.folder.domain)
    expect(list.domains.find((d) => d.host === res.json.folder.domain)?.kind).toBe('quick')
  })

  it('2つのフォルダに発行すると別のドメインになる', async () => {
    await setBase('lp-example.test')
    const a = await createFolderWithPage('A')
    const b = await createFolderWithPage('B')
    const one = await postJson<{ folder: { domain: string } }>(`${server.api}/folders/${a.folderUid}/quick_domain`)
    const two = await postJson<{ folder: { domain: string } }>(`${server.api}/folders/${b.folderUid}/quick_domain`)
    expect(one.json.folder.domain).not.toBe(two.json.folder.domain)
  })
})

describe('来たドメインでLPを絞る', () => {
  /** 2フォルダを作り、片方にクイックドメインを発行した状態 */
  async function setup(): Promise<{
    owned: { folderUid: string; abTestUid: string }
    other: { folderUid: string; abTestUid: string }
    host: string
  }> {
    await setBase('lp-example.test')
    const owned = await createFolderWithPage('自分の')
    const other = await createFolderWithPage('よその')
    const issued = await postJson<{ folder: { domain: string } }>(
      `${server.api}/folders/${owned.folderUid}/quick_domain`,
    )
    return { owned, other, host: issued.json.folder.domain }
  }

  it('そのフォルダのLPは、そのドメインで開ける', async () => {
    const s = await setup()
    const res = await requestWithHost('GET', `${server.baseUrl}/lp/${s.owned.abTestUid}`, { host: s.host })
    expect(res.status).toBe(200)
  })

  it('よそのフォルダのLPは、そのドメインでは開けない', async () => {
    const s = await setup()
    const res = await requestWithHost('GET', `${server.baseUrl}/lp/${s.other.abTestUid}`, { host: s.host })
    expect(res.status).toBe(404)
  })

  it('計測ビーコン（書き込み）も、よそのフォルダのLP宛なら受け付けない', async () => {
    const s = await setup()
    const res = await requestWithHost('POST', `${server.baseUrl}/lp/${s.other.abTestUid}/__track`, {
      host: s.host,
      contentType: 'text/plain',
      body: JSON.stringify({ event: 'pv' }),
    })
    expect(res.status).toBe(404)
  })

  it('大文字・ポート付きのホストでも同じ判定になる', async () => {
    const s = await setup()
    const res = await requestWithHost('GET', `${server.baseUrl}/lp/${s.owned.abTestUid}`, {
      host: `${s.host.toUpperCase()}:8080`,
    })
    expect(res.status).toBe(200)
  })

  it('中間ページも、よそのフォルダのドメインでは開けない', async () => {
    const s = await setup()
    const made = await postJson<{ redirect_page: { uid: string } }>(
      `${server.api}/ab_tests/${s.other.abTestUid}/redirect_pages/create`,
    )
    const uid = made.json.redirect_page.uid
    await sendJson('PATCH', `${server.api}/redirect_pages/${uid}`, { url: 'https://example.test/next' })
    expect((await requestWithHost('GET', `${server.baseUrl}/redirect_pages/${uid}`, { host: s.host })).status).toBe(404)
    // このシステムのドメインなら今までどおり開ける
    expect(
      (await requestWithHost('GET', `${server.baseUrl}/redirect_pages/${uid}`, { host: 'lp-sakusei.example.test' }))
        .status,
    ).toBe(200)
  })

  it('このシステムのドメイン（どのフォルダのドメインでもないホスト）なら、今までどおり全部出す', async () => {
    const s = await setup()
    for (const uid of [s.owned.abTestUid, s.other.abTestUid]) {
      const res = await requestWithHost('GET', `${server.baseUrl}/lp/${uid}`, { host: 'lp-sakusei.example.test' })
      expect(res.status).toBe(200)
    }
  })
})

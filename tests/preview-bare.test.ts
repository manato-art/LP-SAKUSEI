/**
 * プレビューの「LPだけ」（?bare=1・2026-09-24）。
 * ポップアップの中身を直す画面で「LPの上に重ねて見る」の後ろに敷くLP。検証用の赤い帯とポップアップは出さない
 * （出すと、直しているポップアップの後ろに同じポップアップや帯が重なる）。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { postJson, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'

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

async function pageWithPopup(): Promise<string> {
  const created = await postJson<{ ab_test: { uid: string }; version: { uid: string } }>(`${server.api}/ab_tests`, {
    title: 'ポップ入りLP',
    media_id: 1,
  })
  await sendJson('PUT', `${server.api}/versions/${created.json.version.uid}`, { html: '<p>LPの本文です</p>' })
  await postJson(`${server.api}/ab_tests/${created.json.ab_test.uid}/exit_popups`, {
    name: 'テストのポップ',
    html: '<div class="pop-marker">ポップの中身</div>',
  })
  return created.json.version.uid
}

describe('プレビューの「LPだけ」（?bare=1）', () => {
  it('ふつうのプレビューは、検証用の帯とポップアップを出す（今までどおり）', async () => {
    const html = await (await fetch(`${server.baseUrl}/preview/${await pageWithPopup()}`)).text()
    expect(html).toContain('id="preview-banner"')
    expect(html).toContain('pop-marker')
  })

  it('?bare=1 はLPの本文だけ（帯・ポップアップを出さない）', async () => {
    const html = await (await fetch(`${server.baseUrl}/preview/${await pageWithPopup()}?bare=1`)).text()
    expect(html).toContain('LPの本文です')
    expect(html).not.toContain('id="preview-banner"')
    expect(html).not.toContain('pop-marker')
  })
})

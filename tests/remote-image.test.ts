/**
 * ほかのサイトの画像を、EBIyon に写して置く（2026-10-31 本人「スクワットビヨンドで作成したLPを全選択してそのままエビヨンに
 * はりつけたいんだけど、文字はコピーできるけど、画像がそのままコピーできない」→ 本人の選択「EBIyonに写して置く」）。
 *
 * 貼り付けた中身の画像の住所（SB なら SB の画像置き場＝Amazon の S3＋CloudFront）から、サーバーが画像を取ってきて
 * /uploads に置く。外から渡された住所をサーバーが開くので、次を守る:
 *  - http・https だけ。内部の住所（127.0.0.1・10.x・192.168.x・169.254.x＝クラウドの設定置き場 など）は開かない
 *    （つなぐ直前に住所を確かめる＝名前の引き直しでもぐり込めない）。リダイレクトの先も同じく確かめる
 *  - 中身が本物の画像（png・jpeg・gif・webp・avif）のときだけ置く（見出しの種類ではなく中身の先頭で見る。SVG・HTML は置かない）
 *  - 大きさと時間に上限
 */
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { fetchRemoteImage, isPublicAddress } from '../mock-server/lib/remote-image.ts'
import { postJson, resetStore, startTestServer, type TestServer } from './helpers/server.ts'

/** PNG（先頭の印＋中身の代わり。種類は先頭の印で見分ける） */
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('IHDR-test-image')])

/** MP4（先頭の ftyp と種類 isom）・WebM（先頭の印）の代わり */
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom0000test-video')])
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from('test-video')])

let site: Server
let origin = ''
beforeAll(async () => {
  site = createServer((req, res) => {
    if (req.url === '/a.png') {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' })
      res.end(PNG)
    } else if (req.url === '/a.mp4') {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' })
      res.end(MP4)
    } else if (req.url === '/a.webm') {
      res.writeHead(200, { 'Content-Type': 'video/webm' })
      res.end(WEBM)
    } else if (req.url === '/page.html') {
      res.writeHead(200, { 'Content-Type': 'image/png' })
      res.end('<html><script>alert(1)</script></html>')
    } else if (req.url === '/big.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' })
      res.end(Buffer.concat([PNG, Buffer.alloc(5000)]))
    } else if (req.url === '/moved') {
      res.writeHead(302, { Location: '/a.png' })
      res.end()
    } else if (req.url === '/to-inside') {
      res.writeHead(302, { Location: 'http://10.0.0.1/secret.png' })
      res.end()
    } else {
      res.writeHead(404)
      res.end()
    }
  })
  await new Promise<void>((resolve) => site.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${(site.address() as AddressInfo).port}`
})
afterAll(async () => {
  await new Promise<void>((resolve) => site.close(() => resolve()))
})

/** テストの中だけ、手元の住所（127.0.0.1）を開いてよいことにする（ほかの内部の住所は断ったまま） */
const allowLoopback = (address: string): boolean => address === '127.0.0.1' || isPublicAddress(address)

describe('開いてよい住所', () => {
  it('外の住所は開く', () => {
    expect(isPublicAddress('8.8.8.8')).toBe(true)
    expect(isPublicAddress('2606:4700::6810:84e5')).toBe(true)
  })

  it('内部の住所は開かない（自分のサーバー・社内・クラウドの設定置き場）', () => {
    for (const address of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fc00::1', 'fe80::1', '::ffff:10.0.0.1']) {
      expect(isPublicAddress(address), address).toBe(false)
    }
  })
})

describe('画像を取ってくる', () => {
  it('本物の画像なら中身と種類を返す（見出しの種類がちがっても、中身の先頭で見る）', async () => {
    const got = await fetchRemoteImage(`${origin}/a.png`, { isAllowedAddress: allowLoopback })
    expect(got).toMatchObject({ ok: true, mime: 'image/png' })
    expect(got.ok && got.content.equals(PNG)).toBe(true)
  })

  it('動画（mp4・webm）も中身の先頭で見分けて取ってくる（2026-10-31 本人「動画がコピーできない」）', async () => {
    expect(await fetchRemoteImage(`${origin}/a.mp4`, { isAllowedAddress: allowLoopback })).toMatchObject({ ok: true, mime: 'video/mp4' })
    expect(await fetchRemoteImage(`${origin}/a.webm`, { isAllowedAddress: allowLoopback })).toMatchObject({ ok: true, mime: 'video/webm' })
  })

  it('リダイレクトの先も取ってくる', async () => {
    expect(await fetchRemoteImage(`${origin}/moved`, { isAllowedAddress: allowLoopback })).toMatchObject({ ok: true })
  })

  it('画像でない中身（HTML など）は置かない', async () => {
    expect((await fetchRemoteImage(`${origin}/page.html`, { isAllowedAddress: allowLoopback })).ok).toBe(false)
  })

  it('大きすぎるものは途中でやめる', async () => {
    expect((await fetchRemoteImage(`${origin}/big.png`, { isAllowedAddress: allowLoopback, maxBytes: 1000 })).ok).toBe(false)
  })

  it('内部の住所は開かない（ふつうの決まりでは手元の住所も断る）・リダイレクトで内部へ行くのも断る', async () => {
    expect((await fetchRemoteImage(`${origin}/a.png`)).ok).toBe(false)
    expect((await fetchRemoteImage(`${origin}/to-inside`, { isAllowedAddress: allowLoopback })).ok).toBe(false)
  })

  it('http・https 以外は開かない', async () => {
    for (const url of ['file:///etc/passwd', 'ftp://example.test/a.png', 'javascript:alert(1)', 'not a url']) {
      expect((await fetchRemoteImage(url, { isAllowedAddress: () => true })).ok, url).toBe(false)
    }
  })
})

describe('受け口（POST /versions/:uid/remote_images）', () => {
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

  const versionOf = async (): Promise<string> =>
    (await postJson<{ version: { uid: string } }>(`${server.api}/ab_tests`, { title: '貼り付け', media_id: 1 })).json.version.uid

  it('内部の住所・おかしな住所は断る（理由を返す）', async () => {
    const version = await versionOf()
    for (const url of [`${origin}/a.png`, 'file:///etc/passwd', '']) {
      const res = await postJson<{ error: { message: string } }>(`${server.api}/versions/${version}/remote_images`, { url })
      expect(res.status, url).toBe(422)
      expect(res.json.error.message).not.toBe('')
    }
  })

  it('無いVersionは404', async () => {
    expect((await postJson(`${server.api}/versions/NO_SUCH/remote_images`, { url: 'https://img.example.test/a.png' })).status).toBe(404)
  })
})

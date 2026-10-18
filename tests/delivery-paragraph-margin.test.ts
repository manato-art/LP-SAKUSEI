/**
 * 配信・プレビューで、本文の段落（Quill の1行＝<body> の直下の <p>）の上下の空きが、編集画面と同じ0になることの機械証明。
 *
 * 実測（2026-10-18・本人指摘「PCの行間とスマホでの行間が違う」）: 編集画面（.ql-editor）は Quill の
 * `.ql-editor p{margin:0}` で段落の空きが0なのに、配信ページにはその決まりが無く、ブラウザ既定の上下1文字分
 * （記事設定の文字17pxなら17px）が付いていた。スマホに限らず、PC幅の配信でも同じだけ広かった。
 * 本体（SquadBeyond）のプレビューも `.article-body p{margin:0}`。
 * Widget の中の段落は、これまでの配信の見た目を変えないため対象にしない。
 */
import { createServer, type Server } from 'node:http'
import { parseHTML } from 'linkedom'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../mock-server/app.ts'
import { resetState } from '../mock-server/store/store.ts'
import { LP_BASE_CSS } from '../src/app/lp-base-css.ts'
import { postJson } from './helpers/server.ts'

const PARAGRAPH_RULE = 'body>p{margin:0}'

const LP_HTML =
  '<p class="ql-align-center">一行目</p>' +
  '<p><br></p>' +
  '<section class="sb-widget-block" data-widget-block="true"><div class="box"><p>Widgetの中</p></div></section>' +
  '<p class="ql-align-center">二行目</p>'

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

async function createPage(html: string): Promise<{ abTestUid: string; versionUid: string }> {
  const created = await postJson<{ ab_test: { uid: string }; version: { uid: string } }>(
    `${baseUrl}/ab_tests`,
    { title: '段落の空き', media_id: 1 },
  )
  await fetch(`${baseUrl}/versions/${created.json.version.uid}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html }),
  })
  return { abTestUid: created.json.ab_test.uid, versionUid: created.json.version.uid }
}

/** 空きを0にする決まりが当たる段落の文字（配信ページを組み立てたあとの並びで判定する） */
function paragraphsWithoutMargin(pageHtml: string): string[] {
  const { document } = parseHTML(pageHtml)
  return [...document.querySelectorAll('body>p')].map((p) => p.textContent ?? '')
}

describe('配信の本文の段落の空き', () => {
  it('LPの土台CSSに、本文の段落の上下の空きを0にする決まりがある', () => {
    expect(LP_BASE_CSS).toContain(PARAGRAPH_RULE)
  })

  it('プレビュー（/preview）: 本文の段落にだけ当たり、Widget の中の段落には当たらない', async () => {
    const page = await createPage(LP_HTML)
    const html = await (await fetch(`${origin}/preview/${page.versionUid}`)).text()
    expect(html).toContain(PARAGRAPH_RULE)
    expect(paragraphsWithoutMargin(html)).toEqual(['一行目', '', '二行目'])
  })

  it('公開LP（/lp）でも同じ', async () => {
    const page = await createPage(LP_HTML)
    const html = await (await fetch(`${origin}/lp/${page.abTestUid}`)).text()
    expect(html).toContain(PARAGRAPH_RULE)
    expect(paragraphsWithoutMargin(html)).toEqual(['一行目', '', '二行目'])
  })
})

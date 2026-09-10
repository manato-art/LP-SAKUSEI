/**
 * 公開LP・プレビューで、Widget に紛れ込んだ SquadBeyond のプレビュー用CSSがページ全体を上書きしないことの機械証明。
 *
 * 実測（2026-09-10）: ライブラリの Widget を入れると、公開LPが「背景グレー・左寄せ・高さが画面に固定」になっていた。
 * 本人指定の直し方: ページを壊す部分だけ外し、Widget の見た目に要る指定は Widget の中だけに効かせる。
 * 配信時に行い、保存済みのデータは書き換えない。
 */
import { readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../mock-server/app.ts'
import { resetState } from '../mock-server/store/store.ts'
import { WIDGET_RESET_CSS } from '../src/shared/sb-preview-css.ts'
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

function unescapeHtml(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

/** ライブラリの見本から、これまでのアプリと同じ入れ方（<head> のCSS＋<body>）で Widget の HTML を作る */
function libraryWidgetAsSaved(keyword: string): string {
  const fragment = readFileSync('src/app/fragments/ab_tests__UID__articles__widget-library.portals.html', 'utf8')
  const m = [...fragment.matchAll(/aria-label="([^"]*)">[^<]*<\/p>[\s\S]*?<iframe[^>]*srcdoc="([^"]*)"/g)].find((e) =>
    (e[1] ?? '').includes(keyword),
  )
  const doc = unescapeHtml(m?.[2] ?? '')
  const head = /<head[^>]*>([\s\S]*?)<\/head>/.exec(doc)?.[1] ?? ''
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(doc)?.[1] ?? ''
  const headStyles = [...head.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map((s) => s[0]).join('')
  return `<section class="sb-widget-block" data-widget-block="true" contenteditable="false">${headStyles}${body}</section>`
}

async function createPage(html: string): Promise<{ abTestUid: string; articleUid: string; versionUid: string }> {
  const created = await postJson<{ ab_test: { uid: string }; article: { uid: string }; version: { uid: string } }>(
    `${baseUrl}/ab_tests`,
    { title: 'Widget入りLP', media_id: 1 },
  )
  await fetch(`${baseUrl}/versions/${created.json.version.uid}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html }),
  })
  return {
    abTestUid: created.json.ab_test.uid,
    articleUid: created.json.article.uid,
    versionUid: created.json.version.uid,
  }
}

function expectPageIsNotBroken(html: string): void {
  const headEnd = html.indexOf('</head>')
  // 配信の土台（白・中央寄せ・620px）はそのまま
  expect(html).toContain('body{margin:0 auto;max-width:620px;')
  // SquadBeyond のプレビュー用CSS（背景グレー・編集画面用・記事設定の既定値）は出さない
  expect(html).not.toContain('background-color:#ececec')
  expect(html).not.toContain('.CodeMirror{')
  expect(html).not.toContain('#articlePartPreview')
  // Widget の見た目に要る指定は、Widget の中だけに効く形で <head> に1回だけ置く
  expect(html.split(WIDGET_RESET_CSS)).toHaveLength(2)
  expect(html.indexOf(WIDGET_RESET_CSS)).toBeLessThan(headEnd)
}

describe('Widget 入りの LP を配信する', () => {
  it('プレビュー（/preview）でページ全体を上書きしない。Widget 自身のCSSは残る', async () => {
    const page = await createPage(libraryWidgetAsSaved('4つ並んだテキストバルーン') + '<p>本文</p>')
    const html = await (await fetch(`${origin}/preview/${page.versionUid}`)).text()
    expectPageIsNotBroken(html)
    expect(html).toContain('.point-trouble')
    expect(html).toContain('<p>本文</p>')
  })

  it('公開LP（/lp）でも同じ', async () => {
    const page = await createPage(libraryWidgetAsSaved('矢印小刻み'))
    const html = await (await fetch(`${origin}/lp/${page.abTestUid}`)).text()
    expectPageIsNotBroken(html)
    expect(html).toContain('@keyframes tap-down')
  })

  it('保存済みのデータは書き換えない（取り除くのは配信のときだけ）', async () => {
    const page = await createPage(libraryWidgetAsSaved('4つ並んだテキストバルーン'))
    await fetch(`${origin}/preview/${page.versionUid}`)
    const versions = await (await fetch(`${baseUrl}/articles/${page.articleUid}/versions`)).json() as {
      versions: { uid: string; html: string }[]
    }
    const saved = versions.versions.find((v) => v.uid === page.versionUid)?.html ?? ''
    expect(saved).toContain('background-color:#ececec')
  })

  it('Widget の無い LP には土台を置かない', async () => {
    const page = await createPage('<p>本文だけ</p>')
    const html = await (await fetch(`${origin}/preview/${page.versionUid}`)).text()
    expect(html).not.toContain(WIDGET_RESET_CSS)
  })
})

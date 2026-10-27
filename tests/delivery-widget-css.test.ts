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
import { WIDGET_BASE_CSS } from '../src/shared/sb-part-css.ts'
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

/**
 * これまでのアプリと同じ入れ方（<head> のCSS＋<body>）で Widget の HTML を作る。
 * 材料は tests/fixtures/sb-library-widget.json（SBのライブラリ見本から取り出したもの。
 * 見本そのものは 2026-09-23 に外したが、すでにLPへ入っている Widget のために配信の確かめは続ける）。
 */
function libraryWidgetAsSaved(keyword: string): string {
  const fixture = JSON.parse(readFileSync('tests/fixtures/sb-library-widget.json', 'utf8')) as {
    headStyles: string[]
    widgets: { title: string; body: string }[]
  }
  const widget = fixture.widgets.find((w) => w.title.includes(keyword))
  const headStyles = fixture.headStyles.map((css) => `<style>${css}</style>`).join('')
  return `<section class="sb-widget-block" data-widget-block="true" contenteditable="false">${headStyles}${widget?.body ?? ''}</section>`
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
  // 幅は記事設定の余白込み（SBと同じ・2026-10-27）
  expect(html).toContain('body{box-sizing:border-box;margin:0 auto;max-width:620px;')
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

  it('取り込んだ見本の入った LP には、SB本体と同じ土台（取り込んだ見本の中だけ）も <head> に1回置く', async () => {
    const part = '<section class="sb-widget-block" data-widget-block="true"><div id="sb-part-15950" class="sb-custom-part sbtoken1"><div class="logo"><img src="/logo.png" alt=""></div><p>見本の文</p></div></section>'
    const page = await createPage(part)
    for (const url of [`${origin}/preview/${page.versionUid}`, `${origin}/lp/${page.abTestUid}`]) {
      const html = await (await fetch(url)).text()
      expect(html.split(WIDGET_BASE_CSS), url).toHaveLength(2)
      expect(html.indexOf(WIDGET_BASE_CSS), url).toBeLessThan(html.indexOf('</head>'))
    }
  })

  it('Widget の無い LP には土台を置かない', async () => {
    const page = await createPage('<p>本文だけ</p>')
    const html = await (await fetch(`${origin}/preview/${page.versionUid}`)).text()
    expect(html).not.toContain(WIDGET_RESET_CSS)
  })
})

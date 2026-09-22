/**
 * 公開LP・プレビュー・HTMLダウンロード・ヒートマップに敷くLPに、Widget の外枠の「編集画面だけの属性」を出さないことの機械証明。
 *
 * 実測（2026-09-22）: 公開LPに `data-widget-name="MuiBox-root"`（編集画面のホバー表示の名前）と
 * `contenteditable="false"`（Quill の中で Widget を1かたまりにするもの）が、保存されたまま出ていた。
 * 本人指定の直し方: 保存データは書き換えず、画面の外へ出すときに外す。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { postJson, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'
import { buildVersionHtmlDocument } from '../src/app/panels/version-dots-menu.ts'
import { buildHeatmapLpDocument } from '../src/app/pages/heatmap-lp-document.ts'

/** 保存されている形（2026-09-22 実測の外枠）。中身は Widget 自身のCSS・スクリプト・中の要素の属性 */
const SAVED_WIDGET =
  '<section class="sb-widget-block" data-widget-block="true" contenteditable="false" style="margin: 8px 0px;" data-widget-name="MuiBox-root">' +
  '<style>.box{color:red}</style><div class="box" contenteditable="true">中身</div>' +
  '<script>document.querySelector(".box").dataset.ready="1"</script>' +
  '</section>'
/** 画面の外に出す形 */
const PAGE_WIDGET =
  '<section class="sb-widget-block" data-widget-block="true" style="margin: 8px 0px;">' +
  '<style>.box{color:red}</style><div class="box" contenteditable="true">中身</div>' +
  '<script>document.querySelector(".box").dataset.ready="1"</script>' +
  '</section>'

function expectNoEditorAttributes(html: string): void {
  expect(html).not.toContain('data-widget-name')
  expect(html).not.toContain('data-widget-selected')
  expect(html).not.toContain('contenteditable="false"')
  expect(html).toContain(PAGE_WIDGET)
}

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

async function createPage(html: string): Promise<{ abTestUid: string; articleUid: string; versionUid: string }> {
  const created = await postJson<{ ab_test: { uid: string }; article: { uid: string }; version: { uid: string } }>(
    `${server.api}/ab_tests`,
    { title: 'Widget入りLP', media_id: 1 },
  )
  await sendJson('PUT', `${server.api}/versions/${created.json.version.uid}`, { html })
  return {
    abTestUid: created.json.ab_test.uid,
    articleUid: created.json.article.uid,
    versionUid: created.json.version.uid,
  }
}

describe('Widget の外枠の編集画面だけの属性を、画面の外に出すHTMLに出さない', () => {
  it('公開LP（/lp）', async () => {
    const page = await createPage(`<p>本文</p>${SAVED_WIDGET}`)
    expectNoEditorAttributes(await (await fetch(`${server.baseUrl}/lp/${page.abTestUid}`)).text())
  })

  it('プレビュー（/preview）', async () => {
    const page = await createPage(`<p>本文</p>${SAVED_WIDGET}`)
    expectNoEditorAttributes(await (await fetch(`${server.baseUrl}/preview/${page.versionUid}`)).text())
  })

  it('保存データは書き換えない（外すのは画面の外に出すときだけ）', async () => {
    const page = await createPage(SAVED_WIDGET)
    await fetch(`${server.baseUrl}/lp/${page.abTestUid}`)
    await fetch(`${server.baseUrl}/preview/${page.versionUid}`)
    const versions = (await (await fetch(`${server.api}/articles/${page.articleUid}/versions`)).json()) as {
      versions: { uid: string; html: string }[]
    }
    expect(versions.versions.find((v) => v.uid === page.versionUid)?.html).toBe(SAVED_WIDGET)
  })

  it('HTMLダウンロード', () => {
    expectNoEditorAttributes(buildVersionHtmlDocument({ name: 'Ver.1', html: SAVED_WIDGET, css: '' }))
  })

  it('ヒートマップに敷くLP', () => {
    expectNoEditorAttributes(buildHeatmapLpDocument({ html: SAVED_WIDGET, css: '', styleCss: '' }))
  })
})

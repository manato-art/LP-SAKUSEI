/**
 * 「タグ設定」モーダル（右レール6番・HtmlSettingModal）のAPI検証。
 *
 * 「触れるが効かない」を禁止するため、保存 → 再取得で実際に反映されることを機械証明する。
 * ルーターは app.ts への配線（配線担当の担当）を待たずに検証できるよう、単体で express に載せる。
 */
import { createServer, type Server } from 'node:http'
import express, { type Express } from 'express'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { tagSettingsRouter } from '../mock-server/routes/panel-tag-settings.ts'
import { createAbTest } from '../mock-server/store/actions.ts'
import { getState, setState } from '../mock-server/store/store.ts'
import {
  findUnclosedTag,
  getHtmlSetting,
  setHtmlSetting,
} from '../mock-server/store/html-tags.ts'
import { getJson, getStatus, resetStore, sendJson } from './helpers/server.ts'

interface HtmlTagResponse {
  html_tags: { tag: string; document_property: string; body: string }[]
  noindex: boolean
}
interface ErrorResponse {
  error: { code: string; message: string }
}

let server: Server
let api: string

function buildApp(): Express {
  const app = express()
  app.use(express.json())
  app.use('/api/v1', tagSettingsRouter)
  return app
}

/** 記事を1件作り、そのuidを返す（AbTest作成時に記事が1件生まれる） */
function seedArticle(): string {
  let uid = ''
  setState((state) => {
    const out = createAbTest(state, {
      title: 'サンプル施策001',
      memo: '',
      media_id: null,
      folder_id: null,
    })
    uid = out.article.uid
    return out.state
  })
  return uid
}

beforeAll(async () => {
  server = createServer(buildApp())
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('ポート取得に失敗しました')
  api = `http://127.0.0.1:${address.port}/api/v1`
})
afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())))
})
beforeEach(() => {
  resetStore()
})

describe('タグ設定の取得', () => {
  it('未保存の記事は既定値（noindex ON・タグ0件）を返す', async () => {
    const uid = seedArticle()
    const res = await getJson<HtmlTagResponse>(`${api}/articles/${uid}/html_tags`)
    expect(res).toEqual({ html_tags: [], noindex: true })
  })

  it('存在しない記事は404', async () => {
    expect(await getStatus(`${api}/articles/NOT_EXIST/html_tags`)).toBe(404)
  })

  it('mock_state=empty ではタグを空配列にする（§10-8）', async () => {
    const uid = seedArticle()
    await sendJson('PUT', `${api}/articles/${uid}/html_tags`, {
      html_tags: [{ tag: 'script', document_property: 'head', body: '<script></script>' }],
    })
    const res = await getJson<HtmlTagResponse>(
      `${api}/articles/${uid}/html_tags?mock_state=empty`,
    )
    expect(res.html_tags).toEqual([])
  })
})

describe('タグ設定の保存', () => {
  it('保存した個別設定が、再取得で返ってくる', async () => {
    const uid = seedArticle()
    const head = '<script>window.dataLayer = window.dataLayer || [];</script>'
    const body = '<script>console.log("body")</script>'

    const saved = await sendJson<HtmlTagResponse>('PUT', `${api}/articles/${uid}/html_tags`, {
      html_tags: [
        { tag: 'script', document_property: 'head', body: head },
        { tag: 'script', document_property: 'body', body },
      ],
      noindex: true,
    })
    expect(saved.status).toBe(200)

    const reloaded = await getJson<HtmlTagResponse>(`${api}/articles/${uid}/html_tags`)
    expect(reloaded.html_tags).toEqual([
      { tag: 'script', document_property: 'head', body: head },
      { tag: 'script', document_property: 'body', body },
    ])
  })

  it('noindexトグルをOFFにした状態が、再取得で返ってくる', async () => {
    const uid = seedArticle()
    await sendJson('PUT', `${api}/articles/${uid}/html_tags`, { html_tags: [], noindex: false })
    const reloaded = await getJson<HtmlTagResponse>(`${api}/articles/${uid}/html_tags`)
    expect(reloaded.noindex).toBe(false)
  })

  it('保存し直すと前回のタグは残らない（差し替えであって追記ではない）', async () => {
    const uid = seedArticle()
    await sendJson('PUT', `${api}/articles/${uid}/html_tags`, {
      html_tags: [{ tag: 'script', document_property: 'head', body: '<script>1</script>' }],
    })
    await sendJson('PUT', `${api}/articles/${uid}/html_tags`, { html_tags: [] })
    const reloaded = await getJson<HtmlTagResponse>(`${api}/articles/${uid}/html_tags`)
    expect(reloaded.html_tags).toEqual([])
  })

  it('記事ごとに独立して保存される', async () => {
    const first = seedArticle()
    const second = seedArticle()
    await sendJson('PUT', `${api}/articles/${first}/html_tags`, {
      html_tags: [{ tag: 'script', document_property: 'head', body: '<script>1</script>' }],
    })
    const other = await getJson<HtmlTagResponse>(`${api}/articles/${second}/html_tags`)
    expect(other.html_tags).toEqual([])
  })

  it('存在しない記事への保存は404', async () => {
    const res = await sendJson('PUT', `${api}/articles/NOT_EXIST/html_tags`, { html_tags: [] })
    expect(res.status).toBe(404)
  })
})

describe('保存時の境界バリデーション（§12）', () => {
  it('閉じられていないタグは422で、codeでどちらの欄か分かる', async () => {
    const uid = seedArticle()
    const res = await sendJson<ErrorResponse>('PUT', `${api}/articles/${uid}/html_tags`, {
      html_tags: [{ tag: 'script', document_property: 'head', body: '<script>alert(1)' }],
    })
    expect(res.status).toBe(422)
    expect(res.json.error.code).toBe('invalid_script_head')
    expect(res.json.error.message).toBe('タグが正しく閉じられてません。')
  })

  it('body側の閉じ漏れは invalid_script_body になる', async () => {
    const uid = seedArticle()
    const res = await sendJson<ErrorResponse>('PUT', `${api}/articles/${uid}/html_tags`, {
      html_tags: [{ tag: 'script', document_property: 'body', body: '<div><span></div>' }],
    })
    expect(res.status).toBe(422)
    expect(res.json.error.code).toBe('invalid_script_body')
  })

  it('不正な document_property は422', async () => {
    const uid = seedArticle()
    const res = await sendJson<ErrorResponse>('PUT', `${api}/articles/${uid}/html_tags`, {
      html_tags: [{ tag: 'script', document_property: 'footer', body: '' }],
    })
    expect(res.status).toBe(422)
    expect(res.json.error.code).toBe('validation_failed')
  })

  it('422のときは保存されない', async () => {
    const uid = seedArticle()
    await sendJson('PUT', `${api}/articles/${uid}/html_tags`, {
      html_tags: [{ tag: 'script', document_property: 'head', body: '<script>' }],
    })
    const reloaded = await getJson<HtmlTagResponse>(`${api}/articles/${uid}/html_tags`)
    expect(reloaded.html_tags).toEqual([])
  })

  it('未知のキーは保存されない（マスアサインメント防止）', async () => {
    const uid = seedArticle()
    await sendJson('PUT', `${api}/articles/${uid}/html_tags`, {
      html_tags: [
        { tag: 'script', document_property: 'head', body: '', article_id: 999, admin: true },
      ],
    })
    const reloaded = await getJson<HtmlTagResponse>(`${api}/articles/${uid}/html_tags`)
    expect(reloaded.html_tags).toEqual([{ tag: 'script', document_property: 'head', body: '' }])
  })
})

describe('タグの閉じ漏れ検査', () => {
  it.each([
    ['', null],
    ['<script>console.log(1)</script>', null],
    ['<script>if (a < b) { b--; }</script>', null],
    ['<script>document.write("</div>")</script>', null],
    ['<meta name="robots" content="noindex">', null],
    ['<img src="x.png" /><br>', null],
    ['<!-- <div> --><span>x</span>', null],
    ['<script>alert(1)', 'script'],
    ['<div><span></div>', 'div'],
    ['<div>', 'div'],
  ])('%s → %s', (source, expected) => {
    expect(findUnclosedTag(source as string)).toBe(expected)
  })
})

describe('Stateのイミュータブル更新（§12）', () => {
  it('setHtmlSetting は元のStateを書き換えず、新しいStateを返す', () => {
    seedArticle()
    const before = getState()
    const uid = before.articles[0]?.uid ?? ''

    const after = setHtmlSetting(before, uid, {
      html_tags: [{ tag: 'script', document_property: 'head', body: '<script></script>' }],
      noindex: false,
    })

    expect(after).not.toBe(before)
    expect(getHtmlSetting(before, uid)).toEqual({
      article_uid: uid,
      noindex: true,
      html_tags: [],
    })
    expect(getHtmlSetting(after, uid).noindex).toBe(false)
    expect(getHtmlSetting(after, uid).html_tags).toHaveLength(1)
  })
})

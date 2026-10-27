/**
 * LP設定（記事設定）を Version ごとに持つ（2026-10-27 本人「LP設定なんだけど、各バージョンごとに分けたい」
 * 「LP設定の中に他のバージョンにも適応する。って項目を作成して」）。
 * 本人の決定: 全部の項目を Version ごと／「他のバージョンにも適用する」はチェックを入れて保存（最初はチェックなし）／
 * アーカイブ済みの Version には入れない。
 * それまでの設定はページ（ステップ）に1つ＝自分の設定を持たない Version はその共通の設定を使う（見た目は変わらない）。
 */
import { createServer, type Server } from 'node:http'
import express from 'express'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { versionSettingsRouter } from '../mock-server/routes/panel-version-settings.ts'
import { renderPreviewDocument } from '../mock-server/routes/delivery-preview.ts'
import { addVersion, archiveVersion, createAbTest, duplicateVersion } from '../mock-server/store/actions.ts'
import { DEFAULT_MASTER_STYLE_SHEET, getMasterStyleSheet, putMasterStyleSheet, type MasterStyleSheet } from '../mock-server/store/master-style-sheet.ts'
import { getState, resetState, setState } from '../mock-server/store/store.ts'
import { getJson, getStatus, sendJson } from './helpers/server.ts'

let server: Server
let api: string

interface SheetResponse {
  master_style_sheet: MasterStyleSheet
  applied_versions?: number
}

/** ページ1つ（Version A）に Version B・C を足し、C をアーカイブする */
function seedStep(): { article: string; a: string; b: string; c: string } {
  let ids = { article: '', a: '', b: '', c: '' }
  setState((state) => {
    const created = createAbTest(state, { title: 'テストページ', memo: '', folder_id: null, media_id: null })
    const withB = addVersion(created.state, created.article.uid)
    const withC = addVersion(withB.state, created.article.uid)
    // アーカイブには「配信している Version が残る」ことが要る（A が100%）
    const archived = archiveVersion(withC.state, withC.version?.uid ?? '')
    ids = { article: created.article.uid, a: created.version.uid, b: withB.version?.uid ?? '', c: withC.version?.uid ?? '' }
    return archived.state
  })
  return ids
}

const sheetUrl = (article: string, version?: string): string =>
  `${api}/articles/${article}/master_style_sheet${version === undefined ? '' : `?version_uid=${version}`}`

beforeAll(async () => {
  const app = express()
  app.use(express.json())
  app.use('/api/v1', versionSettingsRouter)
  server = createServer(app)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('ポート取得に失敗しました')
  api = `http://127.0.0.1:${address.port}/api/v1`
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
})

beforeEach(() => {
  resetState()
})

describe('LP設定を Version ごとに持つ', () => {
  it('自分の設定を持たない Version は、ページの共通の設定（それまでの設定）を使う', async () => {
    const ids = seedStep()
    await sendJson('PUT', sheetUrl(ids.article), { font_size: '22' })
    const body = await getJson<SheetResponse>(sheetUrl(ids.article, ids.b))
    expect(body.master_style_sheet.font_size).toBe(22)
  })

  it('Version を指定して保存すると、その Version だけが変わる', async () => {
    const ids = seedStep()
    const saved = await sendJson<SheetResponse>('PUT', sheetUrl(ids.article, ids.a), { font_size: '30' })
    expect(saved.status).toBe(200)
    expect((await getJson<SheetResponse>(sheetUrl(ids.article, ids.a))).master_style_sheet.font_size).toBe(30)
    expect((await getJson<SheetResponse>(sheetUrl(ids.article, ids.b))).master_style_sheet.font_size).toBe(DEFAULT_MASTER_STYLE_SHEET.font_size)
  })

  it('「他のバージョンにも適用する」で保存すると、アーカイブ済みを除くほかの Version にも同じ設定が入る', async () => {
    const ids = seedStep()
    await sendJson('PUT', sheetUrl(ids.article, ids.b), { font_size: '19' })
    const saved = await sendJson<SheetResponse>('PUT', sheetUrl(ids.article, ids.a), { font_size: '26', color: '336699', apply_to_other_versions: true })
    expect(saved.status).toBe(200)
    expect(saved.json.applied_versions).toBe(1)
    for (const uid of [ids.a, ids.b]) {
      const sheet = (await getJson<SheetResponse>(sheetUrl(ids.article, uid))).master_style_sheet
      expect([sheet.font_size, sheet.color]).toEqual([26, '336699'])
    }
    // アーカイブ済みの C は前のまま
    expect((await getJson<SheetResponse>(sheetUrl(ids.article, ids.c))).master_style_sheet.font_size).toBe(DEFAULT_MASTER_STYLE_SHEET.font_size)
  })

  it('「他のバージョンにも適用する」のあとに足した Version は、その設定で始まる', async () => {
    const ids = seedStep()
    await sendJson('PUT', sheetUrl(ids.article, ids.a), { font_size: '24', apply_to_other_versions: true })
    let added = ''
    setState((state) => {
      const out = addVersion(state, ids.article)
      added = out.version?.uid ?? ''
      return out.state
    })
    expect((await getJson<SheetResponse>(sheetUrl(ids.article, added))).master_style_sheet.font_size).toBe(24)
  })

  it('チェックなしで保存したときは、ほかの Version に入れない', async () => {
    const ids = seedStep()
    const saved = await sendJson<SheetResponse>('PUT', sheetUrl(ids.article, ids.a), { font_size: '28', apply_to_other_versions: false })
    expect(saved.json.applied_versions).toBe(0)
    expect((await getJson<SheetResponse>(sheetUrl(ids.article, ids.b))).master_style_sheet.font_size).toBe(DEFAULT_MASTER_STYLE_SHEET.font_size)
  })

  it('ほかのページの Version を指定したら 404', async () => {
    const one = seedStep()
    const two = seedStep()
    expect(await getStatus(sheetUrl(one.article, two.a))).toBe(404)
    expect((await sendJson('PUT', sheetUrl(one.article, two.a), { font_size: '20' })).status).toBe(404)
  })

  it('Version を複製すると、元の Version の設定も一緒に写す', () => {
    const ids = seedStep()
    setState((state) => putMasterStyleSheet(state, ids.article, { ...DEFAULT_MASTER_STYLE_SHEET, font_size: 33 }, ids.b))
    let copy = ''
    setState((state) => {
      const out = duplicateVersion(state, ids.b)
      copy = out.version?.uid ?? ''
      return out.state
    })
    expect(getMasterStyleSheet(getState(), ids.article, copy).font_size).toBe(33)
  })

  it('プレビュー（配信と同じ作り）は、その Version の設定で出す', () => {
    const ids = seedStep()
    setState((state) => putMasterStyleSheet(state, ids.article, { ...DEFAULT_MASTER_STYLE_SHEET, font_size: 41 }, ids.b))
    const state = getState()
    const page = (uid: string): string => {
      const version = state.versions.find((v) => v.uid === uid)
      if (version === undefined) throw new Error('Version がありません')
      return renderPreviewDocument(state, version, { bare: true, device: 'pc' }) ?? ''
    }
    expect(page(ids.b)).toContain('font-size:41px')
    expect(page(ids.a)).not.toContain('font-size:41px')
  })
})

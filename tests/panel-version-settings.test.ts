/**
 * Version設定（MasterStyleSheet）の機械証明。
 *
 * `versionSettingsRouter` はまだ `mock-server/app.ts` にマウントされていない（配線は親担当）。
 * そのためテスト側で express に単体で載せて、実際にHTTPで叩いて検証する。
 * 併せて、モーダルの土台（採取マークアップ）に必要な目印が全部揃っていることも確認する。
 */
import { readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import express from 'express'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { versionSettingsRouter } from '../mock-server/routes/panel-version-settings.ts'
import { createAbTest } from '../mock-server/store/actions.ts'
import { DEFAULT_MASTER_STYLE_SHEET } from '../mock-server/store/master-style-sheet.ts'
import { getState, resetState, setState } from '../mock-server/store/store.ts'
import type { MasterStyleSheet } from '../mock-server/store/master-style-sheet.ts'
import { getJson, getStatus, sendJson } from './helpers/server.ts'

let server: Server
let api: string

/** ルーター単体を express に載せる（app.ts は触らない） */
function createRouterApp(): express.Express {
  const app = express()
  app.use(express.json())
  app.use('/api/v1', versionSettingsRouter)
  return app
}

/** テスト用に記事を1件作り、その uid を返す */
function seedArticle(title = 'テストページ'): string {
  let uid = ''
  setState((state) => {
    const out = createAbTest(state, { title, memo: '', folder_id: null, media_id: null })
    uid = out.article.uid
    return out.state
  })
  return uid
}

interface SheetResponse {
  master_style_sheet: MasterStyleSheet
}

beforeAll(async () => {
  server = createServer(createRouterApp())
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

describe('GET /articles/:uid/master_style_sheet', () => {
  it('未保存の記事は実機の初期表示と同じ既定値を返す', async () => {
    const uid = seedArticle()
    const body = await getJson<SheetResponse>(`${api}/articles/${uid}/master_style_sheet`)
    expect(body.master_style_sheet).toEqual(DEFAULT_MASTER_STYLE_SHEET)
    // 採取DOMのvalue属性そのもの（企画書 §11: 実物の値を推測で作らない）
    expect(body.master_style_sheet.font_size).toBe(17)
    expect(body.master_style_sheet.line_height).toBe(1.8)
    expect(body.master_style_sheet.padding_left).toBe(20)
    expect(body.master_style_sheet.delivery_version_width).toBeNull()
  })

  it('存在しない記事は404（未定義404を作らない・§13-B）', async () => {
    expect(await getStatus(`${api}/articles/NOT_EXIST/master_style_sheet`)).toBe(404)
  })
})

describe('PUT /articles/:uid/master_style_sheet', () => {
  it('保存した値が、再取得で反映される', async () => {
    const uid = seedArticle()
    const saved = await sendJson<SheetResponse>('PUT', `${api}/articles/${uid}/master_style_sheet`, {
      font_size: '20',
      color: 'FF0000',
      line_height: '2',
      padding_top: '30',
      delivery_version_width: '780',
      delivery_version_width_unit: 'px',
      border_size: '2',
      border_type: 'dashed',
      border_color: '00ff00',
    })
    expect(saved.status).toBe(200)

    const reloaded = await getJson<SheetResponse>(`${api}/articles/${uid}/master_style_sheet`)
    expect(reloaded.master_style_sheet.font_size).toBe(20)
    expect(reloaded.master_style_sheet.color).toBe('FF0000')
    expect(reloaded.master_style_sheet.line_height).toBe(2)
    expect(reloaded.master_style_sheet.padding_top).toBe(30)
    expect(reloaded.master_style_sheet.delivery_version_width).toBe(780)
    expect(reloaded.master_style_sheet.delivery_version_width_unit).toBe('px')
    expect(reloaded.master_style_sheet.border_type).toBe('dashed')
    expect(reloaded.master_style_sheet.border_color).toBe('00ff00')
    // 送っていない項目は現在値のまま
    expect(reloaded.master_style_sheet.font_family).toBe(DEFAULT_MASTER_STYLE_SHEET.font_family)
  })

  it('空文字は「指定しない」＝ null として保存される（実物の注記どおり）', async () => {
    const uid = seedArticle()
    await sendJson('PUT', `${api}/articles/${uid}/master_style_sheet`, {
      iframe_height: '',
      iframe_height_unit: '',
      letter_spacing: '',
      font_size: '',
    })
    const body = await getJson<SheetResponse>(`${api}/articles/${uid}/master_style_sheet`)
    expect(body.master_style_sheet.iframe_height).toBeNull()
    expect(body.master_style_sheet.iframe_height_unit).toBe('')
    expect(body.master_style_sheet.letter_spacing).toBeNull()
    expect(body.master_style_sheet.font_size).toBeNull()
  })

  it('背景ラジオが「設定しない」なら色・画像は空で保存される', async () => {
    const uid = seedArticle()
    await sendJson('PUT', `${api}/articles/${uid}/master_style_sheet`, {
      outer_background_color: '',
      outer_background_image: '',
      inner_background_color: 'CCCCCC',
      inner_background_image: '',
    })
    const body = await getJson<SheetResponse>(`${api}/articles/${uid}/master_style_sheet`)
    expect(body.master_style_sheet.outer_background_color).toBe('')
    expect(body.master_style_sheet.inner_background_color).toBe('CCCCCC')
  })

  it('記事ごとに独立して保存される', async () => {
    const first = seedArticle('1件目')
    const second = seedArticle('2件目')
    await sendJson('PUT', `${api}/articles/${first}/master_style_sheet`, { font_size: '24' })

    const firstBody = await getJson<SheetResponse>(`${api}/articles/${first}/master_style_sheet`)
    const secondBody = await getJson<SheetResponse>(`${api}/articles/${second}/master_style_sheet`)
    expect(firstBody.master_style_sheet.font_size).toBe(24)
    expect(secondBody.master_style_sheet.font_size).toBe(17)
  })

  it('保存しても既存のStateオブジェクトを破壊しない（§12 イミュータブル）', async () => {
    const uid = seedArticle()
    const before = getState()
    const snapshot = JSON.stringify(before)
    await sendJson('PUT', `${api}/articles/${uid}/master_style_sheet`, { font_size: '19' })
    expect(JSON.stringify(before)).toBe(snapshot)
    expect(getState()).not.toBe(before)
  })

  it('範囲外の数値・不正な色・選択肢外の値は422で弾く', async () => {
    const uid = seedArticle()
    const negative = await sendJson<{ error: { message: string } }>(
      'PUT',
      `${api}/articles/${uid}/master_style_sheet`,
      { font_size: '-1' },
    )
    expect(negative.status).toBe(422)
    expect(negative.json.error.message).toContain('文字サイズ')

    const badColor = await sendJson('PUT', `${api}/articles/${uid}/master_style_sheet`, {
      color: 'ZZZZZZ',
    })
    expect(badColor.status).toBe(422)

    const badType = await sendJson('PUT', `${api}/articles/${uid}/master_style_sheet`, {
      border_type: 'wavy',
    })
    expect(badType.status).toBe(422)

    // 422のあとも値は変わっていない
    const body = await getJson<SheetResponse>(`${api}/articles/${uid}/master_style_sheet`)
    expect(body.master_style_sheet.font_size).toBe(17)
  })

  it('存在しない記事への保存は404', async () => {
    const res = await sendJson('PUT', `${api}/articles/NOT_EXIST/master_style_sheet`, {
      font_size: '20',
    })
    expect(res.status).toBe(404)
  })
})

describe('モーダルの土台（採取マークアップ）', () => {
  const fragment = readFileSync('src/app/fragments/version-settings-modal.html', 'utf8')

  it('配線に使う目印が実マークアップに揃っている', () => {
    expect(fragment).toContain('data-test="MasterStyleSheetModal-ModalWrapper"')
    expect(fragment).toContain('data-test="MasterStyleSheetModal-BtnUpdate"')
    expect(fragment).toContain('btnCnacel') // 実物の綴り（typo）をそのまま使っている
    expect(fragment).toContain('ReactModal__Overlay')
  })

  it('APIのキーと同じ name を持つ入力欄が全部ある', () => {
    for (const name of Object.keys(DEFAULT_MASTER_STYLE_SHEET)) {
      if (name.includes('background')) continue // 背景は色/画像でなくラジオで採取されている
      expect(fragment).toContain(`name="${name}"`)
    }
    expect(fragment).toContain('name="outerBackgroundRadio"')
    expect(fragment).toContain('name="innerBackgroundRadio"')
  })

  it('採取ノイズ（本番JS・採取ツールの痕跡）が混ざっていない', () => {
    expect(fragment).not.toContain('<script')
    expect(fragment).not.toContain('claude-agent')
    expect(fragment).not.toContain('claude-phantom')
    expect(fragment).not.toMatch(/https?:\/\//)
  })
})

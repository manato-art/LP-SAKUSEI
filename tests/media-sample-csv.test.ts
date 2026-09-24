/**
 * メディア > 商品 の「サンプルCSV」。
 *
 * 以前は押すと列の順を書いたトーストが出るだけで、サーバーに見本の口
 * （GET /teams/products/sample_csv）があるのに使っていなかった。見本をファイルで受け取れるようにする。
 * 見本を Excel で開いて「CSV UTF-8」で保存すると先頭に BOM が付く。そのまま取り込んでも
 * 見出し行を商品として登録しないことも押さえる。
 */
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { parseProductCsv } from '../mock-server/routes/media.ts'
import { startTestServer, type TestServer } from './helpers/server.ts'

let server: TestServer
beforeAll(async () => {
  server = await startTestServer()
})
afterAll(async () => {
  await server.close()
})

describe('サンプルCSV', () => {
  it('ファイルとして受け取れる（保存するときの名前つき）', async () => {
    const res = await fetch(`${server.api}/teams/products/sample_csv`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    expect(res.headers.get('content-disposition')).toContain('attachment')
    expect(res.headers.get('content-disposition')).toContain('.csv')
    const text = await res.text()
    expect(text.split('\n')[0]).toBe('名前,価格(税抜),評価(1~5),サイトURL,説明文')
  })

  it('見本をそのまま取り込むと、見本の商品だけが入る', async () => {
    const text = await (await fetch(`${server.api}/teams/products/sample_csv`)).text()
    expect(parseProductCsv(text).map((p) => p.name)).toEqual(['商品A'])
  })

  it('Excel が付ける BOM があっても見出し行を商品にしない', () => {
    const rows = parseProductCsv('﻿名前,価格(税抜),評価(1~5),サイトURL,説明文\n商品A,1980,4,,')
    expect(rows.map((p) => p.name)).toEqual(['商品A'])
  })

  it('画面のボタンはトーストを出すだけでなく、見本を受け取る', () => {
    const src = readFileSync('src/app/pages/media-page.ts', 'utf8')
    expect(src).toContain('sample_csv')
    expect(src).not.toContain("toast('名前,価格(税抜)")
  })
})

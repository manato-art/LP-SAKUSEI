/**
 * Widgetライブラリの見本（カテゴリーごとの gz）を、デプロイした版から配る（2026-09-22）。
 *
 * 以前は 9/3 に一度だけ永続Volume（DATA_DIR/widgets）へ写し、以後ずっとそこから配っていた。
 * そのため見本を直して push しても、本番は古い見本のままだった（見本の点検と作り変えで発覚）。
 * 見本はイメージ（dist/clean/widget-library）に入っているので、そこから配り、
 * 直した見本がすぐ届くように毎回確かめさせる（no-cache。変わっていなければ 304 で軽い）。
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import express from 'express'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { widgetLibraryRouter } from '../mock-server/widget-assets.ts'

let server: Server
let origin: string

beforeAll(async () => {
  const dist = mkdtempSync(join(tmpdir(), 'widget-assets-'))
  mkdirSync(join(dist, 'clean', 'widget-library', 'cat0'), { recursive: true })
  writeFileSync(join(dist, 'clean', 'widget-library', 'cat0', 'grid.html.gz'), 'NEW')
  const app = express()
  app.use(widgetLibraryRouter(dist))
  server = createServer(app)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('ポート取得に失敗しました')
  origin = `http://127.0.0.1:${address.port}`
})

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

describe('Widgetライブラリの見本の配り方', () => {
  it('デプロイした版（dist）の見本を配る', async () => {
    const res = await fetch(`${origin}/clean/widget-library/cat0/grid.html.gz`)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('NEW')
  })

  it('毎回確かめさせる（直した見本が、前に開いた人にもすぐ届く）', async () => {
    const res = await fetch(`${origin}/clean/widget-library/cat0/grid.html.gz`)
    expect(res.headers.get('cache-control')).toBe('no-cache')
  })

  it('無いカテゴリーは 404（ほかの場所を探しに行かない）', async () => {
    const res = await fetch(`${origin}/clean/widget-library/cat99/grid.html.gz`)
    expect(res.status).toBe(404)
  })
})

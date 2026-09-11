/**
 * LP本文などに埋め込まれた画像・動画（data URL）を、別ファイルにして URL に置き換えることの機械証明（2026-09-11・本人依頼）。
 *
 * 本番では「めぐり」のLPの本文が約101MBあり、画像67枚が data URL で埋め込まれていた（保存データ102MBのほぼ全部）。
 * 保存のたびにこの全体を書き直すのでサーバーが重く、配信LPもこの101MBをそのまま送っていた。
 */
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { MIN_EXTERNALIZE_BASE64_LENGTH, externalizeDataUrls } from '../mock-server/lib/uploads.ts'
import { externalizeStateImages } from '../mock-server/store/externalize-images.ts'
import { createAbTest } from '../mock-server/store/actions.ts'
import { createEmptyState } from '../mock-server/store/seed-empty.ts'
import type { FollowPopup, Product, State } from '../mock-server/store/types.ts'

const dir = mkdtempSync(join(tmpdir(), 'lp-sakusei-uploads-'))

beforeAll(() => {
  vi.stubEnv('UPLOADS_DIR', dir)
})

afterAll(() => {
  vi.unstubAllEnvs()
  rmSync(dir, { recursive: true, force: true })
})

/** 埋め込む中身（fill で中身を変える。length は置き換える対象になる大きさが既定） */
function bytes(fill: number, length = 4000): Buffer {
  return Buffer.alloc(length, fill)
}

function dataUrl(mime: string, content: Buffer): string {
  return `data:${mime};base64,${content.toString('base64')}`
}

function sha256(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex')
}

const UPLOAD_URL = /\/uploads\/[0-9a-f]{64}\.[a-z0-9]+/g

describe('本文の data URL を別ファイルにする', () => {
  it('img の src を /uploads/<中身のハッシュ>.png に置き換え、中身はそのままファイルに保存する', () => {
    const png = bytes(1)
    const out = externalizeDataUrls(`<p><img src="${dataUrl('image/png', png)}"></p>`)
    const url = `/uploads/${sha256(png)}.png`
    expect(out).toEqual({ text: `<p><img src="${url}"></p>`, converted: 1 })
    expect(readFileSync(join(dir, `${sha256(png)}.png`)).equals(png)).toBe(true)
  })

  it('同じ画像は1つのファイルにまとめる', () => {
    const jpeg = bytes(2)
    const src = dataUrl('image/jpeg', jpeg)
    const before = readdirSync(dir).length
    const out = externalizeDataUrls(`<img src="${src}"><div style="background-image:url(${src})"></div>`)
    const urls = out.text.match(UPLOAD_URL) ?? []
    expect(urls).toEqual([`/uploads/${sha256(jpeg)}.jpg`, `/uploads/${sha256(jpeg)}.jpg`])
    expect(readdirSync(dir).length).toBe(before + 1)
  })

  it('CSSの url()・srcset・ヘッダー画像のコメント・動画も置き換える', () => {
    const a = bytes(3)
    const b = bytes(4)
    const video = bytes(5)
    const html =
      `<!--header-image:${dataUrl('image/webp', a)}-->` +
      `<img srcset="${dataUrl('image/webp', a)} 1x, ${dataUrl('image/webp', b)} 2x">` +
      `<video src="${dataUrl('video/mp4', video)}"></video>`
    const css = `.hero{background:url("${dataUrl('image/webp', b)}") no-repeat}`
    expect(externalizeDataUrls(html).text).toBe(
      `<!--header-image:/uploads/${sha256(a)}.webp-->` +
        `<img srcset="/uploads/${sha256(a)}.webp 1x, /uploads/${sha256(b)}.webp 2x">` +
        `<video src="/uploads/${sha256(video)}.mp4"></video>`,
    )
    expect(externalizeDataUrls(css).text).toBe(`.hero{background:url("/uploads/${sha256(b)}.webp") no-repeat}`)
  })

  it('小さい画像と SVG は埋め込みのまま（SVG は中にスクリプトを書けるので、同じドメインのファイルにしない）', () => {
    const small = dataUrl('image/png', bytes(6, 32))
    const svg = dataUrl('image/svg+xml', bytes(7))
    const html = `<img src="${small}"><img src="${svg}">`
    expect(small.length).toBeLessThan(MIN_EXTERNALIZE_BASE64_LENGTH)
    expect(externalizeDataUrls(html)).toEqual({ text: html, converted: 0 })
  })

  it('data URL が無ければ、何もしない', () => {
    const html = '<p>テキストだけ</p><img src="https://example.com/a.png">'
    expect(externalizeDataUrls(html)).toEqual({ text: html, converted: 0 })
  })
})

describe('保存データ全体（起動時の移し替え）', () => {
  it('Version の html / css の data URL を別ファイルにする', () => {
    const made = createAbTest(createEmptyState(), { title: 'A', memo: '', media_id: 1, folder_id: null })
    const png = bytes(8)
    const state: State = {
      ...made.state,
      versions: made.state.versions.map((v) => ({
        ...v,
        html: `<img src="${dataUrl('image/png', png)}">`,
        css: `.a{background:url(${dataUrl('image/png', png)})}`,
      })),
    }
    const out = externalizeStateImages(state)
    expect(out.converted).toBe(2)
    expect(out.state.versions[0]?.html).toBe(`<img src="/uploads/${sha256(png)}.png">`)
    expect(out.state.versions[0]?.css).toBe(`.a{background:url(/uploads/${sha256(png)}.png)}`)
  })

  it('追尾ポップアップの html / css と商品画像も対象', () => {
    const gif = bytes(9)
    const src = dataUrl('image/gif', gif)
    const base = createEmptyState()
    const state: State = {
      ...base,
      followPopups: [{ uid: 'FOLLOW_TEST', html: `<img src="${src}">`, css: `.b{background:url(${src})}` } as unknown as FollowPopup],
      products: [{ uid: 'PRODUCT_TEST', image: src } as unknown as Product],
    }
    const out = externalizeStateImages(state)
    const url = `/uploads/${sha256(gif)}.gif`
    expect(out.converted).toBe(3)
    expect(out.state.followPopups[0]?.html).toBe(`<img src="${url}">`)
    expect(out.state.followPopups[0]?.css).toBe(`.b{background:url(${url})}`)
    expect(out.state.products[0]?.image).toBe(url)
  })

  it('埋め込み画像が無ければ、同じ state をそのまま返す', () => {
    const state = createAbTest(createEmptyState(), { title: 'A', memo: '', media_id: 1, folder_id: null }).state
    const out = externalizeStateImages(state)
    expect(out.state).toBe(state)
    expect(out.converted).toBe(0)
  })
})

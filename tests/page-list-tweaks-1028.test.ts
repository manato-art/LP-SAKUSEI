/**
 * ページ一覧の手直し（2026-10-28 本人の指示32〜35）。
 *
 *   - 指示32: 表の途中にカーソルを当てると「謎の青線」＝名前の列の幅を変える取っ手（採取物）。
 *     ドラッグしても何も起きない（配線していない）うえ、名前の列を細くしたので場所もずれていた → 出さない
 *   - 指示33: 左の一番下の「フォルダなし」→ 中にページがあるときだけ出す（本人選択）
 *   - 指示34: 右の詳細の幅 340 → 320
 *   - 指示35: 「更新順」の右の ←→（押しても何も起きない）→ 出さない
 *   - ついで: 左のフォルダ一覧の幅を `!important` で決めていたので、端をつまんで広げても変わらなかった
 *     （見た目の作り直し 2026-10-27 で壊した）→ 決めるのは最初の幅だけにする
 */
import { readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createAbTest, createFolder } from '../mock-server/store/actions.ts'
import { setState } from '../mock-server/store/store.ts'
import { isUnfiledShown, UNFILED_FOLDER_UID } from '../src/shared/unfiled-folder.ts'
import { resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'

async function styleText(): Promise<string> {
  const { document } = parseHTML('<!doctype html><html><head></head><body></body></html>')
  ;(globalThis as unknown as Record<string, unknown>)['document'] = document
  const { ensurePageListStyle } = await import('../src/app/pages/folders-redesign-style.ts')
  ensurePageListStyle()
  return document.getElementById('page-list-v2-style')?.textContent ?? ''
}

describe('指示32・35: 動かない取っ手とボタンは出さない', () => {
  it('表の名前の列の幅を変える取っ手（青い縦線）を出さない', async () => {
    expect(await styleText()).toContain('[data-pl-v2] .e14iuak30{display:none !important}')
  })

  it('「更新順」の右の ←→ を出さない（並べ替えのボタンは残す）', async () => {
    const css = await styleText()
    expect(css).toContain('[data-pl-v2] .en4zj403 > .css-2f4ijs{display:none !important}')
    expect(css).not.toMatch(/\.en4zj403 > \.css-1q2q6c6\{display:none/)
  })
})

describe('指示34: 右の詳細の幅は 320', () => {
  it('開いているときの幅・一覧が空ける幅・上の段が止まる位置を 320 に合わせる', async () => {
    const css = await styleText()
    // 畳むと幅0（folders-detail-panel.ts が data-collapsed を付けて style に書く）。畳んだときは決めない（KB-2026-10-27-009）
    expect(css).toContain('.efy50tl23:not([data-collapsed="true"]){width:320px !important}')
    expect(css).toContain('.efy50tl20{margin-right:320px !important}')
    expect(css).toContain('padding-right:332px !important')
    expect(css).not.toContain('352px')
  })
})

describe('左のフォルダ一覧は端をつまんで広げられる', () => {
  it('幅は最初の値だけ決める（つまんだときに書く style の幅に勝たない）', async () => {
    const css = await styleText()
    const rule = /\[data-testid="side-menu"\]\{border-right[^}]*\}/.exec(css)?.[0] ?? ''
    expect(rule).toContain('width:224px')
    expect(rule).not.toMatch(/(?:^|[;{])(?:min-|max-)?width:[^;]*!important/)
  })
})

describe('指示33: 「フォルダなし」は中にページがあるときだけ出す', () => {
  it('ふだんは出さない。中にページがある・いま開いているときだけ出す', () => {
    expect(isUnfiledShown(false, null)).toBe(false)
    expect(isUnfiledShown(false, 'FOLDER_0001')).toBe(false)
    expect(isUnfiledShown(true, null)).toBe(true)
    // パンくずからフォルダの無いページの一覧へ来たときは、いまいる場所として出す
    expect(isUnfiledShown(false, UNFILED_FOLDER_UID)).toBe(true)
  })

  it('PCの左の一覧とスマホのフォルダのカードの両方が同じ決まりを使う', () => {
    expect(readFileSync('src/app/pages/folders.ts', 'utf8')).toContain('isUnfiledShown(')
    expect(readFileSync('src/app/mobile/pages-mobile.ts', 'utf8')).toContain('isUnfiledShown(')
  })

  it('ページの無いフォルダを消したときは「フォルダなし」へ飛ばない', () => {
    const source = readFileSync('src/app/panels/folder-menu.ts', 'utf8')
    const block = /function confirmDeleteFolder[\s\S]*?\n}\n/.exec(source)?.[0] ?? ''
    expect(block).toContain('ab_tests_count')
  })
})

describe('指示33: フォルダなしにページがあるかをサーバーに聞く', () => {
  let server: TestServer
  const realFetch = globalThis.fetch

  beforeAll(async () => {
    server = await startTestServer()
  })
  afterAll(async () => {
    await server.close()
  })
  beforeEach(() => {
    resetStore()
    // 画面の request は '/api/v1/...' を相手にするので、テストのサーバーへつなぐ
    globalThis.fetch = ((input: string, init?: RequestInit) =>
      realFetch(input.startsWith('/') ? `${server.baseUrl}${input}` : input, init)) as typeof fetch
  })
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it('フォルダを消してページが残ると「ある」になる', async () => {
    let folderUid = ''
    setState((state) => {
      const folder = createFolder(state, { name: 'フォルダA', parent_id: null })
      folderUid = folder.folder.uid
      return createAbTest(folder.state, { title: 'ページ1', memo: '', folder_id: folder.folder.id, media_id: 3 }).state
    })
    const { pageListApi } = await import('../src/app/api-page-list.ts')
    expect(await pageListApi.hasUnfiledPages()).toBe(false)
    await sendJson('DELETE', `${server.api}/folders/${folderUid}`)
    expect(await pageListApi.hasUnfiledPages()).toBe(true)
  })
})

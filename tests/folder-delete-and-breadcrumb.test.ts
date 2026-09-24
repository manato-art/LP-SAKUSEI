/**
 * フォルダ削除の確認文と、パンくずのフォルダ名（2026-09-24 点検）。
 *
 *   - 本人の決定: フォルダを消しても中のページは残す（サーバーは folder_id を null にして残している）。
 *     確認文は「フォルダ内のbeyondページも削除されます」と逆のことを書いていた。
 *   - パンくずのフォルダ名・←は、どのフォルダも選ばれていないページ画面へ戻していた（folderUid を使っていなかった）。
 */
import { readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { afterEach, describe, expect, it } from 'vitest'

describe('フォルダ削除の確認', () => {
  const source = readFileSync('src/app/panels/folder-menu.ts', 'utf8')
  const block = /function confirmDeleteFolder[\s\S]*?\n}\n/.exec(source)?.[0] ?? ''

  it('ページは消えず「フォルダなし」に移ると書く（消えるとは書かない）', () => {
    expect(block).not.toContain('beyondページも削除されます')
    expect(block).toContain('削除されません')
    expect(block).toContain('UNFILED_FOLDER_NAME')
  })

  it('アプリ内の確認カード（赤）で聞く', () => {
    expect(block).toContain('confirmCard(')
    expect(block).toContain('danger: true')
  })
})

describe('パンくずのフォルダ名は、そのフォルダを選んだページ画面へ', () => {
  const g = globalThis as unknown as Record<string, unknown>
  const before = g['document']

  afterEach(() => {
    Object.defineProperty(globalThis, 'document', { value: before, configurable: true, writable: true })
  })

  async function crumbLinks(folderName: string, folderUid: string | undefined): Promise<{ href: string; text: string }[]> {
    const { document } = parseHTML('<!doctype html><html><head></head><body><div id="root"></div></body></html>')
    Object.defineProperty(globalThis, 'document', { value: document, configurable: true, writable: true })
    const { setupBreadcrumb } = await import('../src/app/pages/tab-nav.ts')
    const root = document.getElementById('root') as unknown as HTMLElement
    setupBreadcrumb(root, folderName, 'ページ1', folderUid)
    return [...root.querySelectorAll('.sb-breadcrumb a')].map((a) => ({
      href: a.getAttribute('href') ?? '',
      text: (a.textContent ?? '').trim(),
    }))
  }

  it('フォルダ名と←は、そのフォルダを選んだ一覧へ', async () => {
    const links = await crumbLinks('フォルダA', 'FOLDER_0001')
    expect(links.map((l) => l.href)).toEqual(['#/folders?uid=FOLDER_0001', '#/folders?uid=FOLDER_0001'])
  })

  it('フォルダの無いページは「フォルダなし」を選んだ一覧へ', async () => {
    const links = await crumbLinks('', undefined)
    expect(links.map((l) => l.href)).toEqual(['#/folders?uid=unfiled', '#/folders?uid=unfiled'])
    expect(links[1]?.text).toBe('フォルダなし')
  })
})

describe('スマホでも「フォルダなし」を開ける（パンくずがそこへ飛ぶため）', () => {
  const mobile = readFileSync('src/app/mobile/pages-mobile.ts', 'utf8')
  it('一覧に「フォルダなし」を出し、開くとフォルダの無いページを並べる', () => {
    expect(mobile).toContain('UNFILED_FOLDER_UID')
    expect(mobile).toContain('pageListApi.unfiledAbTests()')
  })
})

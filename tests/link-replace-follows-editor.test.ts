/**
 * リンク置換の一覧は、いま編集中の本文とVersionに合わせる（2026-10-27 本人「リンク入れても置換されないことがある」）。
 * パネルを開いたままVersionを切り替えると、一覧が前のVersionのリンクのまま残り、
 * 置換が「置き換えるリンクを選択してください」で止まっていた。番号が合うと、今の本文を前のVersionへ書き込み、
 * 前のVersionの中身が消えていた。
 * あわせて指示⑪: 「計測機能付きリンクに変更」は最初はチェックなし（本人「入れる際に計測するかどうかを選ぶ。デフォルトは計測なし」）。
 */
import { describe, expect, it } from 'vitest'
import { settle, setupLinkReplacePanel } from './helpers/link-replace-panel.ts'

const V1 = '<p><a href="https://example.test/a">一つ目</a></p><p><a href="https://example.test/b">二つ目</a></p>'
const V2 = '<p><a href="https://example.test/v2">Version2のリンク</a></p>'

const setup = () => setupLinkReplacePanel(V1)

describe('リンク置換の一覧は、いまの本文とVersionに合わせる', () => {
  it('開いたままVersionを切り替えて置換を押しても、前のVersionへは書き込まない（一覧を今の本文に合わせ、選び直してもらう）', async () => {
    const t = await setup()
    expect(t.rows()).toHaveLength(2)
    t.pick(0)
    t.typeUrl('https://example.test/new')
    // Versionを切り替えた（本文が入れ替わった）が、一覧にはまだ知らせが来ていない
    t.body.innerHTML = V2
    t.version.current = 'V2'
    await t.replace()
    expect(t.posts()).toHaveLength(0)
    expect(t.rows()).toHaveLength(1)
    expect(t.rows()[0]).toContain('Version2のリンク')

    t.pick(0)
    await t.replace()
    expect(t.posts()).toHaveLength(1)
    expect(t.posts()[0]?.body?.['version_uid']).toBe('V2')
    expect(t.posts()[0]?.body?.['html']).toContain('Version2のリンク')
  })

  it('Versionを切り替えたら、開いている一覧がそのVersionのリンクに変わる', async () => {
    const t = await setup()
    const handlers: Array<() => void> = []
    t.mod.followEditorContent(t.root, t.panel, { on: (_name: string, handler: () => void) => handlers.push(handler) })
    const { showVersionContent } = await import('../src/app/pages/editor-html.ts')
    t.version.current = 'V2'
    showVersionContent({ root: t.root, quill: { root: t.body, update: () => undefined, history: { clear: () => undefined } } } as never, V2)
    await settle(300)
    expect(t.rows()).toHaveLength(1)
    expect(t.rows()[0]).toContain('Version2のリンク')
  })

  it('本文を直してリンクが増えたら、開いている一覧も増える', async () => {
    const t = await setup()
    const handlers: Array<() => void> = []
    t.mod.followEditorContent(t.root, t.panel, { on: (_name: string, handler: () => void) => handlers.push(handler) })
    t.body.innerHTML = `${V1}<p><a href="https://example.test/c">三つ目</a></p>`
    for (const handler of handlers) handler()
    await settle(300)
    expect(t.rows()).toHaveLength(3)
  })
})

describe('指示⑪ 計測する・しない', () => {
  it('「計測機能付きリンクに変更」は最初はチェックなしで、そのまま置換すると計測なしのリンクになる', async () => {
    const t = await setup()
    expect(t.panel.querySelector<HTMLInputElement>('input[id="trackingCheckBox"]')?.checked).toBe(false)
    t.pick(1)
    t.typeUrl('https://example.test/plain')
    await t.replace()
    expect(t.posts()[0]?.body?.['tracking']).toBe(false)
  })
})

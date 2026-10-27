/**
 * リンク置換の一覧は、いま編集中の本文とVersionに合わせる（2026-10-27 本人「リンク入れても置換されないことがある」）。
 * パネルを開いたままVersionを切り替えると、一覧が前のVersionのリンクのまま残り、
 * 置換が「置き換えるリンクを選択してください」で止まっていた。番号が合うと、今の本文を前のVersionへ書き込み、
 * 前のVersionの中身が消えていた。
 * あわせて指示⑪: 「計測機能付きリンクに変更」は最初はチェックなし（本人「入れる際に計測するかどうかを選ぶ。デフォルトは計測なし」）。
 */
import { parseHTML } from 'linkedom'
import { describe, expect, it, vi } from 'vitest'

const V1 = '<p><a href="https://example.test/a">一つ目</a></p><p><a href="https://example.test/b">二つ目</a></p>'
const V2 = '<p><a href="https://example.test/v2">Version2のリンク</a></p>'

interface Sent {
  readonly method: string
  readonly body: Record<string, unknown> | null
}

const settle = (ms = 10): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

async function setup() {
  vi.resetModules()
  const { window } = parseHTML('<!doctype html><html><head></head><body><div id="root"><div class="ql-editor"></div></div></body></html>')
  const g = globalThis as unknown as Record<string, unknown>
  for (const key of ['document', 'window', 'Event', 'CustomEvent', 'HTMLElement', 'HTMLInputElement', 'Node']) {
    g[key] = (window as unknown as Record<string, unknown>)[key]
  }
  // linkedom の input には checked が無い。属性で読み書きできるようにする
  const inputProto = (window as unknown as { HTMLInputElement: { prototype: object } }).HTMLInputElement.prototype
  Object.defineProperty(inputProto, 'checked', {
    configurable: true,
    get(this: Element) {
      return this.hasAttribute('checked')
    },
    set(this: Element, on: boolean) {
      if (on) this.setAttribute('checked', '')
      else this.removeAttribute('checked')
    },
  })
  const root = window.document.getElementById('root') as unknown as HTMLElement
  const body = root.querySelector('.ql-editor') as HTMLElement
  body.innerHTML = V1
  const version = { current: 'V1' }
  const sent: Sent[] = []
  g['fetch'] = async (_url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const parsed = typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null
    sent.push({ method, body: parsed })
    if (method === 'POST') {
      const indexes = parsed?.['indexes'] as number[]
      return new Response(JSON.stringify({ html: parsed?.['html'], replaced_count: indexes.length, links: [] }), { status: 200 })
    }
    return new Response(JSON.stringify({ version_uid: version.current, links: [], redirect_pages: [], exit_popups: [] }), { status: 200 })
  }
  const mod = await import('../src/app/panels/link-replace.ts')
  const panel = mod.mountLinkReplace(root, 'ARTICLE_X', () => version.current)
  if (panel === null) throw new Error('パネルが出ない')
  panel.classList.add('_open_x4j8w_84')
  mod.reloadLinkReplace(root, panel)
  await settle()

  const rows = (): string[] => [...panel.querySelectorAll('[data-link-row]')].map((row) => row.textContent ?? '')
  const pick = (index: number): void => {
    panel.querySelector(`[data-link-row="${String(index)}"] input`)?.dispatchEvent(new window.Event('change'))
  }
  const typeUrl = (url: string): void => {
    const input = panel.querySelector<HTMLInputElement>('._replaceLinkInput_id5w4_246 input')
    if (input === null) throw new Error('入力欄が無い')
    input.value = url
    input.dispatchEvent(new window.Event('input'))
  }
  const replace = async (): Promise<void> => {
    panel.querySelector('._btnReplace_id5w4_297')?.dispatchEvent(new window.Event('click'))
    await settle()
  }
  const posts = (): Sent[] => sent.filter((s) => s.method === 'POST')
  return { mod, root, body, panel, version, rows, pick, typeUrl, replace, posts }
}

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

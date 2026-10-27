/**
 * リンク置換パネルを linkedom の上に立てる（本文は .ql-editor・サーバーは fetch の代わり）。
 * 送った POST を控え、置換の結果は送った html をそのまま返す。
 */
import { parseHTML } from 'linkedom'
import { vi } from 'vitest'

export interface Sent {
  readonly method: string
  readonly body: Record<string, unknown> | null
}

export const settle = (ms = 10): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export async function setupLinkReplacePanel(initialHtml: string) {
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
  body.innerHTML = initialHtml
  const version = { current: 'V1' }
  const sent: Sent[] = []
  g['fetch'] = async (_url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const parsed = typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null
    sent.push({ method, body: parsed })
    if (method === 'POST') {
      const { replaceLinksInHtml } = await import('../../src/shared/link-html.ts')
      const indexes = parsed?.['indexes'] as number[]
      const html = replaceLinksInHtml(String(parsed?.['html'] ?? ''), indexes, {
        href: String(parsed?.['url'] ?? ''),
        tracking: parsed?.['tracking'] === true,
        newTab: parsed?.['new_tab'] === true,
      })
      return new Response(JSON.stringify({ html, replaced_count: indexes.length, links: [] }), { status: 200 })
    }
    return new Response(JSON.stringify({ version_uid: version.current, links: [], redirect_pages: [], exit_popups: [] }), { status: 200 })
  }
  const mod = await import('../../src/app/panels/link-replace.ts')
  const panel = mod.mountLinkReplace(root, 'ARTICLE_X', () => version.current)
  if (panel === null) throw new Error('パネルが出ない')
  panel.classList.add('_open_x4j8w_84')
  mod.reloadLinkReplace(root, panel)
  await settle()

  const rows = (): string[] => [...panel.querySelectorAll('[data-link-row]')].map((row) => row.textContent ?? '')
  const rowIndexes = (): string[] => [...panel.querySelectorAll('[data-link-row]')].map((row) => row.getAttribute('data-link-row') ?? '')
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
  return { window, mod, root, body, panel, version, rows, rowIndexes, pick, typeUrl, replace, posts }
}

/** DOMを組み立てる関数をテストで動かすための最小の土台（linkedom） */
import { parseHTML } from 'linkedom'

/**
 * linkedom は <select> の value を持たない（undefined を返す）。
 * ブラウザと同じく「selected の付いた option（無ければ先頭）」の値を返すようにする（テストだけ）。
 */
function patchSelectValue(window: { HTMLSelectElement: { prototype: object } }): void {
  const proto = window.HTMLSelectElement.prototype as {
    querySelectorAll?: (s: string) => ArrayLike<Element>
  }
  if (Object.getOwnPropertyDescriptor(proto, '__testValuePatched') !== undefined) return
  Object.defineProperty(proto, '__testValuePatched', { value: true })
  Object.defineProperty(proto, 'value', {
    configurable: true,
    get(this: Element) {
      const options = [...this.querySelectorAll('option')]
      const picked = options.find((o) => o.hasAttribute('selected')) ?? options[0]
      return picked?.getAttribute('value') ?? picked?.textContent ?? ''
    },
    set(this: Element, value: string) {
      for (const option of this.querySelectorAll('option')) {
        if ((option.getAttribute('value') ?? option.textContent) === value) option.setAttribute('selected', '')
        else option.removeAttribute('selected')
      }
    },
  })
}

export function installDom(): Document {
  const { document, window } = parseHTML('<!doctype html><html><head></head><body></body></html>')
  patchSelectValue(window as unknown as { HTMLSelectElement: { prototype: object } })
  const g = globalThis as unknown as Record<string, unknown>
  g['document'] = document
  g['window'] = window
  g['HTMLElement'] = window.HTMLElement
  g['Event'] = window.Event
  return document as unknown as Document
}

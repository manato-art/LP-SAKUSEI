/**
 * リンク置換の一覧（2026-09-24 全体点検37: リンクがあると一覧が真っ白で、1件ずつ選べなかった）
 */
import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import { renderLinkRows, renderPopupRows, renderRedirectPicker } from '../src/app/panels/link-replace-rows.ts'
import { extractLinksFromHtml } from '../src/shared/link-html.ts'

function dom(): Document {
  const { document } = parseHTML('<!doctype html><html><body><div id="h"></div><div><select id="type"></select></div></body></html>')
  ;(globalThis as unknown as Record<string, unknown>)['document'] = document
  return document
}

describe('リンク置換の一覧', () => {
  it('リンクを1行ずつ並べ、選んだ行にはチェックが付き、押すと知らせる', () => {
    const doc = dom()
    const host = doc.getElementById('h') as unknown as HTMLElement
    const links = extractLinksFromHtml('<a href="https://a.example.test/?sb_tracking=true">買う</a><a href="/about">会社</a>')
    const toggled: number[] = []
    renderLinkRows(host, links, { selected: new Set([1]), onToggle: (i) => toggled.push(i) })
    const rows = host.querySelectorAll('[data-link-row]')
    expect(rows.length).toBe(2)
    expect(rows[0]?.textContent).toContain('買う')
    expect(rows[0]?.textContent).toContain('計測あり')
    expect((rows[1]?.querySelector('input') as HTMLInputElement).checked).toBe(true)
    ;(rows[0]?.querySelector('input') as HTMLInputElement).dispatchEvent(new (doc.defaultView as unknown as { Event: typeof Event }).Event('change'))
    expect(toggled).toEqual([0])
  })

  it('中間ページリンクでは、置き換え先の中間ページを選べる', () => {
    const doc = dom()
    const anchor = doc.getElementById('type') as unknown as HTMLElement
    const picked: string[] = []
    renderRedirectPicker(anchor, [{ uid: 'R1', name: '確認ページ', url: 'https://x.example.test/r/R1' }], '', (uid) => picked.push(uid))
    const select = doc.querySelector('[data-redirect-picker] select') as unknown as HTMLSelectElement
    expect([...select.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['中間ページを選ぶ', '確認ページ'])
  })

  it('離脱防止ポップアップのタブでは、ポップアップごとに「開いて直す」を出す', () => {
    const doc = dom()
    const host = doc.getElementById('h') as unknown as HTMLElement
    renderPopupRows(host, [{ uid: 'P1', name: '限定クーポン' }], () => undefined)
    expect(host.textContent).toContain('限定クーポン')
    expect(host.textContent).toContain('開いて直す')
  })
})

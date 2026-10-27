/**
 * LP設定（記事設定）を Version ごとに持つ・画面の側（2026-10-27 本人「LP設定なんだけど、各バージョンごとに分けたい」
 * 「LP設定の中に他のバージョンにも適応する。って項目を作成して」）。
 * 本人の決定: 「他のバージョンにも適用する」はチェックを入れて保存（最初はチェックなし）／アーカイブ済みの Version には入れない。
 */
import { describe, expect, it, vi } from 'vitest'
import { parseHTML } from 'linkedom'

type Win = ReturnType<typeof parseHTML>['window']

const SHEET = {
  font_size: 17, font_family: '', color: '000000', text_align: '', line_height: null, letter_spacing: null,
  img_margin_top: null, img_margin_bottom: null, padding_top: null, padding_bottom: null, padding_right: null, padding_left: null,
  iframe_height: null, iframe_height_unit: '', delivery_version_width: null, delivery_version_width_unit: '',
  border_size: null, border_type: '', border_color: '', outer_background_color: '', outer_background_image: '',
  inner_background_color: '', inner_background_image: '',
}

interface Call {
  url: string
  method: string
  body: Record<string, unknown> | null
}

async function open(version?: { uid: string; name: string }): Promise<{ window: Win; calls: Call[] }> {
  const { window } = parseHTML('<!doctype html><html><head></head><body></body></html>')
  const g = globalThis as unknown as Record<string, unknown>
  for (const key of ['document', 'window', 'DOMParser', 'Event', 'HTMLElement', 'HTMLInputElement', 'Node']) {
    g[key] = (window as unknown as Record<string, unknown>)[key]
  }
  // linkedom の input には checked が無い（:checked で読めない）。属性で読み書きできるようにする
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
  const selectProto = (window as unknown as { HTMLSelectElement: { prototype: object } }).HTMLSelectElement.prototype
  Object.defineProperty(selectProto, 'value', {
    configurable: true,
    get(this: Element) {
      return this.getAttribute('data-value') ?? ''
    },
    set(this: Element, v: string) {
      this.setAttribute('data-value', v)
    },
  })
  const calls: Call[] = []
  g['fetch'] = async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? 'GET', body: init?.body === undefined ? null : (JSON.parse(String(init.body)) as Record<string, unknown>) })
    return new Response(JSON.stringify({ master_style_sheet: SHEET, applied_versions: 2 }), { status: 200 })
  }
  vi.resetModules()
  const { openVersionSettings } = await import('../src/app/panels/version-settings.ts')
  await openVersionSettings('ARTICLE_X', version)
  return { window, calls }
}

const save = async (window: Win): Promise<void> => {
  window.document.querySelector('[data-test="MasterStyleSheetModal-BtnUpdate"]')?.dispatchEvent(new window.Event('click'))
  await new Promise((resolve) => setTimeout(resolve, 10))
}

describe('LP設定を Version ごとに読み書きする', () => {
  it('開いている Version の設定を読み、どの Version の設定かを見出しに出す', async () => {
    const { window, calls } = await open({ uid: 'VER_A', name: 'Ver.4751' })
    expect(calls[0]?.url).toBe('/api/v1/articles/ARTICLE_X/master_style_sheet?version_uid=VER_A')
    expect(window.document.querySelector('[data-lp-settings-version]')?.textContent).toContain('Ver.4751')
  })

  it('「他のバージョンにも適用する」は最初はチェックなし。そのまま保存すると、この Version だけに入れる', async () => {
    const { window, calls } = await open({ uid: 'VER_A', name: 'Ver.4751' })
    const box = window.document.querySelector<HTMLInputElement>('[data-apply-other-versions] input[type="checkbox"]')
    expect(box).not.toBeNull()
    expect(box?.checked).toBe(false)
    expect(window.document.querySelector('[data-apply-other-versions]')?.textContent).toContain('他のバージョンにも適用する')
    await save(window)
    const put = calls.find((c) => c.method === 'PUT')
    expect(put?.url).toBe('/api/v1/articles/ARTICLE_X/master_style_sheet?version_uid=VER_A')
    expect(put?.body?.['apply_to_other_versions']).toBe(false)
  })

  it('チェックを入れて保存すると、ほかの Version にも入れるよう送る', async () => {
    const { window, calls } = await open({ uid: 'VER_A', name: 'Ver.4751' })
    const box = window.document.querySelector<HTMLInputElement>('[data-apply-other-versions] input[type="checkbox"]')
    if (box === null) throw new Error('チェックの項目が無い')
    box.checked = true
    await save(window)
    expect(calls.find((c) => c.method === 'PUT')?.body?.['apply_to_other_versions']).toBe(true)
  })
})

describe('ヒートマップに敷く LP も Version ごとの設定で', () => {
  it('Version ごとに、その Version の LP設定の CSS を持つ', async () => {
    vi.resetModules()
    vi.doMock('../src/app/api.ts', () => ({
      api: {
        articles: async () => ({ articles: [{ uid: 'ART' }] }),
        versions: async () => ({ versions: [{ uid: 'V1', html: '<p>1</p>', css: '' }, { uid: 'V2', html: '<p>2</p>', css: '' }] }),
        masterStyleSheet: async (_article: string, version?: string) => ({
          master_style_sheet: { ...SHEET, font_size: version === 'V2' ? 31 : 17 },
        }),
      },
    }))
    const { fetchHeatmapLpSources } = await import('../src/app/pages/heatmap-lp-sources.ts')
    const sources = await fetchHeatmapLpSources('AB')
    expect(sources.versions.get('V2')?.styleCss).toContain('font-size:31px')
    expect(sources.versions.get('V1')?.styleCss).not.toContain('font-size:31px')
    vi.doUnmock('../src/app/api.ts')
  })
})

/**
 * LP設定（記事設定）の見た目の作り直し（2026-10-27 本人「LP設定なんだけど、デザインの修正をしたい」＋見本の画像・「この画像の見た目にしてほしい」）。
 * 見本: 白地＋細い枠の入力欄・薄い青の帯の見出し・LP内背景と外枠背景を横に並べて枠で囲む・青い保存・灰色の丸の×。
 * 見出しの左に青いバー（本人「横の青いバーもつけて」・はじめは「縦線なし・帯の色だけ」を選んでいた）。枠の左線ではなく、文字の前の小さなバー。
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'

async function openSettings(): Promise<Window> {
  const { window } = parseHTML('<!doctype html><html><head></head><body></body></html>')
  const g = globalThis as unknown as Record<string, unknown>
  for (const key of ['document', 'window', 'DOMParser', 'Event', 'HTMLElement', 'HTMLInputElement', 'Node']) g[key] = (window as unknown as Record<string, unknown>)[key]
  // linkedom の select は value を入れられない（読むだけ）。入れられるようにする
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
  const sheet = {
    font_size: 17, font_family: '', color: '000000', text_align: 'center', line_height: null, letter_spacing: null,
    img_margin_top: null, img_margin_bottom: null, padding_top: null, padding_bottom: null, padding_right: null, padding_left: null,
    iframe_height: null, iframe_height_unit: '', delivery_version_width: null, delivery_version_width_unit: '',
    border_size: null, border_type: '', border_color: '', outer_background_color: '', outer_background_image: '',
    inner_background_color: '', inner_background_image: '',
  }
  g['fetch'] = async () => new Response(JSON.stringify({ master_style_sheet: sheet }), { status: 200 })
  const { openVersionSettings } = await import('../src/app/panels/version-settings.ts')
  await openVersionSettings('ARTICLE_X')
  return window as unknown as Window
}

describe('LP設定の見た目（見本の画像どおり）', () => {
  // 開いている画面は1枚だけ（2枚目は開かない作り）なので、1回開いて見比べる
  let window: Window
  beforeAll(async () => {
    window = await openSettings()
  })

  it('LP内背景と外枠背景は、横に並ぶ2つの枠の中に、見出しと選択肢を組にして入れる', () => {
    const portal = window.document.querySelector('.ReactModalPortal[data-clone-lp-settings]')
    expect(portal).not.toBeNull()
    const row = window.document.querySelector('.lp-bg-row')
    const boxes = [...(row?.querySelectorAll(':scope > .lp-bg-box') ?? [])]
    expect(boxes.map((box) => box.querySelector('[class*="_title_qyxur_126"]')?.textContent)).toEqual(['LP内背景', '外枠背景'])
    expect(boxes.map((box) => box.querySelector('input[type="radio"]')?.getAttribute('name'))).toEqual(['innerBackgroundRadio', 'outerBackgroundRadio'])
  })

  it('テキスト揃えのボタンは、押した物だけ「選んでいる」になる（見た目は決まりの側で当てる）', () => {
    const buttons = [...window.document.querySelectorAll<HTMLButtonElement>('[data-clone-text-align-row] .lp-align-btn')]
    expect(buttons).toHaveLength(3)
    expect(buttons.map((btn) => btn.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false'])
    buttons[2]?.dispatchEvent(new (window as unknown as { Event: typeof Event }).Event('click'))
    expect(buttons.map((btn) => btn.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true'])
    expect(buttons.every((btn) => btn.style.background === '')).toBe(true)
  })

  it('見本の色（青い保存・薄い青の帯・白い入力欄・見出しの左の青いバー）を当てる。枠の左線は使わない', () => {
    const css = window.document.getElementById('lp-settings-style')?.textContent ?? ''
    // 青・淡い青はアプリのテーマの色に合わせる（無いときは見本の色）
    expect(css).toContain('var(--sb-accent, #1178F3)')
    expect(css).toContain('var(--sb-accent-tint, #EBF5FD)')
    expect(css).toMatch(/input[^{]*\{[^}]*background-color:#FFFFFF !important/)
    expect(css).toMatch(/_title_qyxur_126::before\{content:"";[^}]*background:var\(--sb-accent, #1178F3\)/)
    expect(css).not.toMatch(/border-left\s*:/)
  })

  it('暗い表示でも暗くなる（印が「LPの中身＝暗くしない」に当たらない）', async () => {
    const { darkSelector } = await import('../src/shared/dark-css.ts')
    const css = window.document.getElementById('lp-settings-style')?.textContent ?? ''
    const selectors = [...css.matchAll(/^([^{}@/][^{}]*)\{/gm)].map((m) => (m[1] ?? '').trim())
    expect(selectors.length).toBeGreaterThan(20)
    expect(selectors.filter((sel) => darkSelector(sel) === '')).toEqual([])
  })

  it('暗い表示では、文字の黒・灰色が明るい色に変わる（青みのある黒は変わらず、暗い地に暗い字で読めなかった）', async () => {
    const { mapDarkDeclaration } = await import('../src/shared/dark-color.ts')
    const css = window.document.getElementById('lp-settings-style')?.textContent ?? ''
    const textColors = [...css.matchAll(/(?:^|[;{])color:(#[0-9A-Fa-f]{6})/g)].map((m) => m[1] ?? '')
    expect(textColors.length).toBeGreaterThan(5)
    expect(textColors.filter((hex) => hex !== '#FFFFFF' && mapDarkDeclaration('color', hex) === null)).toEqual([])
  })
})

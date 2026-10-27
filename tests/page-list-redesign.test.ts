/**
 * ページ一覧の見た目の作り直し（2026-10-27 本人「こんな感じにリデザインしたい」＋見本の画像）。
 * 決まりの側の約束: 暗い表示でも暗くなる（印が「LPの中身」扱いで飛ばされない・文字の黒は青みなし）／
 * 枠の左線は使わない／棒グラフは一覧の全部の指標に色がある／行の左の画像は読めなければ元のしるしに戻す。
 */
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import { darkSelector } from '../src/shared/dark-css.ts'
import { mapDarkDeclaration } from '../src/shared/dark-color.ts'

async function styleText(): Promise<string> {
  const { document } = parseHTML('<!doctype html><html><head></head><body></body></html>')
  ;(globalThis as unknown as Record<string, unknown>)['document'] = document
  const { ensurePageListStyle } = await import('../src/app/pages/folders-redesign-style.ts')
  ensurePageListStyle()
  return document.getElementById('page-list-v2-style')?.textContent ?? ''
}

describe('ページ一覧の見た目の決まり', () => {
  it('暗い表示でも暗くなる（全部のセレクタが飛ばされない・文字の黒と灰色は明るくなる）', async () => {
    const css = await styleText()
    const selectors = [...css.matchAll(/^([^{}@/\n][^{}]*)\{/gm)].map((m) => (m[1] ?? '').trim())
    expect(selectors.length).toBeGreaterThan(40)
    expect(selectors.filter((sel) => darkSelector(sel) === '')).toEqual([])
    // 暗い表示のために別に決めた札の色（html[data-theme="dark"] の決まり）は除いて見る
    const lightRules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter((m) => !(m[1] ?? '').includes('data-theme="dark"')).map((m) => `{${m[2] ?? ''}`)
    const textColors = lightRules.flatMap((rule) => [...rule.matchAll(/(?:^|[;{])color:(#[0-9A-Fa-f]{6})/g)].map((m) => m[1] ?? ''))
    const darkInk = textColors.filter((hex) => Number.parseInt(hex.slice(1, 3), 16) < 0x80)
    expect(darkInk.length).toBeGreaterThan(3)
    // 色付きの札の文字（茶・緑）は暗い表示の札を別に決めてある
    expect(darkInk.filter((hex) => !['#9A5B00', '#0B6B36'].includes(hex) && mapDarkDeclaration('color', hex) === null)).toEqual([])
    expect(css).toContain('html[data-theme="dark"] body [data-pl-v2][data-pl-v2] .ejtacxq0[data-ad-status="prepared"]')
  })

  it('枠の左線は使わない・棒グラフは一覧の指標の全部に色がある', async () => {
    const css = await styleText()
    expect(css).not.toMatch(/border-left\s*:\s*[1-9]/)
    for (const metric of ['ad_cost', 'pv', 'click', 'ctr', 'cv', 'cvr', 'ctvr', 'cpa', 'mcpa', 'media_click', 'media_ctr', 'roas']) {
      expect(css).toContain(`.pl-spark[data-metric="${metric}"] .pl-spark__bar{background:#`)
    }
  })
})

describe('行の左のページの画像', () => {
  it('画像があれば元のしるしと入れ替え、読めなければ元のしるしに戻す。無ければそのまま', async () => {
    const { document, Event } = parseHTML('<div class="row"><div class="ec7ecxf1"><svg id="icon"></svg></div></div><div class="row2"><div class="ec7ecxf1"><svg id="icon2"></svg></div></div>')
    ;(globalThis as unknown as Record<string, unknown>)['document'] = document
    const { applyRowThumbnail } = await import('../src/app/pages/folders-row-icons.ts')
    const row = document.querySelector('.row') as unknown as HTMLElement
    applyRowThumbnail(row, '/uploads/a.webp')
    const img = row.querySelector('img.pl-thumb')
    expect(img?.getAttribute('src')).toBe('/uploads/a.webp')
    expect(row.querySelector('#icon')).toBeNull()
    img?.dispatchEvent(new Event('error'))
    expect(row.querySelector('#icon')).not.toBeNull()
    const row2 = document.querySelector('.row2') as unknown as HTMLElement
    applyRowThumbnail(row2, null)
    expect(row2.querySelector('#icon2')).not.toBeNull()
  })
})

describe('フォルダを選ぶ前の画面', () => {
  it('仮の数字の段と、空の右の詳細の見出しを出さない（隠す仕組みを上書きしない）', async () => {
    const css = await styleText()
    expect(css).toContain('[data-pl-v2] .en4zj406[style*="display: none"]{display:none !important}')
    expect(css).toContain('.efy50tl23:has(.efy50tl16[style*="display: none"]) > .e1ti96lw2{display:none !important}')
  })
})

/**
 * 部品「ロード中」（2026-09-24・本人「部品にロード中という内容を追加して」。動き＝本人の選択「数秒後に次の画面へ」）。
 * 診断LPの「あなたに合うものを診断中…」: くるくる・バー・点々が動き、決めた秒数のあと自動で画面②③…（かリンク）へ移る。
 */
import { describe, expect, it } from 'vitest'
import { ALL_BLOCK_TYPES, BUILDER_TEMPLATE, SCREENS_SCRIPT } from '../src/app/panels/nocode/templates/builder.ts'
import type { ItemData, TemplateData } from '../src/app/panels/nocode/templates/types.ts'

const NOW = new Date(Date.UTC(2026, 8, 24, 3, 0))
const UID = 'nc-test0006'
const HEADING: ItemData = { type: 'heading', text: '結果', size: 21, align: 'center', color: '#1F2A37' }
const loading = (extra: ItemData): ItemData => ({ type: 'loading', look: 'spinner', text: '診断中…', seconds: 3, color: '#E5573F', target: '', url: '', track: true, ...extra })

const data = (first: readonly ItemData[], withSecond = true): TemplateData =>
  ({
    ...BUILDER_TEMPLATE.defaults(NOW),
    screens: [{ id: 's1', name: '画面①', blocks: first }, ...(withSecond ? [{ id: 's2', name: '結果', blocks: [HEADING] }] : [])],
  }) as TemplateData
const render = (first: readonly ItemData[], withSecond = true): string => BUILDER_TEMPLATE.render(data(first, withSecond), UID)
const validate = (first: readonly ItemData[], withSecond = true): string | null => BUILDER_TEMPLATE.validate(data(first, withSecond), NOW)

describe('部品「ロード中」', () => {
  it('部品を足すにある。見た目・秒数・終わったら移る先を選べる', () => {
    const type = ALL_BLOCK_TYPES.find((t) => t.type === 'loading')
    expect(type?.label).toBe('ロード中')
    const keys = type?.fields.map((f) => [f.kind, f.key])
    expect(keys).toContainEqual(['select', 'look'])
    expect(keys).toContainEqual(['number', 'seconds'])
    expect(type?.fields.find((f) => f.kind === 'goto')?.label).toBe('終わったら')
  })

  it('決めた秒数のあと、選んだ画面へ移る（印は data-nc-wait と data-nc-then）', () => {
    const html = render([loading({ action: 'screen', target: 's2', seconds: 2.5 })])
    expect(html).toContain('data-nc-wait="2500" data-nc-then="s2"')
    expect(html).toContain('<p class="nc-b-loading__text" role="status">診断中…</p>')
    expect(html).toContain(SCREENS_SCRIPT)
  })

  it('リンクへ移るときは、隠したリンクを押す（1画面だけでも切り替えのスクリプトを入れる）', () => {
    const html = render([loading({ action: 'link', url: 'https://example.com/result', track: false })], false)
    expect(html).toMatch(/<a class="nc-b-loading__go" href="https:\/\/example\.com\/result"[^>]*hidden tabindex="-1" aria-hidden="true"><\/a>/)
    expect(html).toContain(SCREENS_SCRIPT)
  })

  it('見た目: くるくる・バー（秒数ぶんで満ちる）・点々', () => {
    expect(render([loading({ action: 'screen', target: 's2' })])).toContain('nc-b-loading__spinner')
    const bar = render([loading({ look: 'bar', seconds: 4, action: 'screen', target: 's2' })])
    expect(bar).toContain('nc-b-loading__bar')
    expect(bar).toMatch(/\.nc-b-1\{--nc-wait:4s\}/)
    expect(render([loading({ look: 'dots', action: 'screen', target: 's2' })])).toContain('nc-b-loading__dots')
  })

  it('秒数は 1〜10 秒（0.5 秒刻み）に収める', () => {
    expect(render([loading({ seconds: 0.2, action: 'screen', target: 's2' })])).toContain('data-nc-wait="1000"')
    expect(render([loading({ seconds: 99, action: 'screen', target: 's2' })])).toContain('data-nc-wait="10000"')
  })

  it('入力の文字は文字として出す', () => {
    const html = render([loading({ text: '<img src=x onerror=alert(1)>', action: 'screen', target: 's2' })])
    expect(html).not.toContain('<img src=x')
  })

  it('移る先を選んでいない・開くページが空なら、保存の前に知らせる', () => {
    expect(validate([loading({ action: 'none' })])).toContain('ロード中')
    expect(validate([loading({ action: 'link', url: ' ' })])).toContain('開くページ')
    expect(validate([loading({ action: 'screen', target: 's2' })])).toBeNull()
  })

  it('スクリプト: 画面が出たら数え始める。Widget編集の見たまま画面では移らない（動きだけ見せる）', () => {
    expect(SCREENS_SCRIPT).toContain('[data-nc-wait]')
    expect(SCREENS_SCRIPT).toContain("closest('[data-widget-preview]')")
    expect(() => new Function(SCREENS_SCRIPT)).not.toThrow()
  })
})

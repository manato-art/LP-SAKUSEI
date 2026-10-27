/**
 * リンク置換の見た目の作り直し（2026-10-27 指示㉒ 本人「こんな感じにリンク置換をリデザインして」「計測の右の：はいらない」）と、
 * 外を押したら閉じる（指示㉓ 本人「範囲外を押したら自動で閉じるようにして。←を押さないでも閉じれるイメージ」）。
 */
import { describe, expect, it } from 'vitest'
import { setupLinkReplacePanel } from './helpers/link-replace-panel.ts'

const HTML = '<p><a href="https://example.test/a">ボタン反応テスト</a></p><p><a href="https://example.test/b?sb_tracking=true">申し込む</a></p>'

describe('リンク置換の見た目（㉒）', () => {
  it('専用の見た目を読み込み、行はカード（リンクのアイコン付きのURL・右に計測の札）。「⋮」は出さない', async () => {
    const t = await setupLinkReplacePanel(HTML)
    expect(t.window.document.getElementById('link-replace-style')).not.toBeNull()
    const row = t.panel.querySelector('[data-link-row="0"]')
    expect(row?.classList.contains('lr-row')).toBe(true)
    expect(row?.querySelector('.lr-row__url svg')).not.toBeNull()
    expect(row?.querySelector('[data-link-tracking-toggle]')?.classList.contains('lr-pill')).toBe(true)
    expect(row?.textContent).not.toMatch(/[⋮︙:：]\s*$/)
    expect(row?.querySelectorAll('button').length).toBe(1)
  })

  it('「全て選択」「選択解除」にアイコン、「新しいリンク」の前に＋のしるし', async () => {
    const t = await setupLinkReplacePanel(HTML)
    for (const button of t.panel.querySelectorAll('._btn_id5w4_117')) expect(button.querySelector('svg')).not.toBeNull()
    expect(t.panel.querySelector('.lr-select-icon svg')).not.toBeNull()
  })
})

describe('送るのは一覧だけ（2026-10-27 本人「全体をスクロールするのではなく、2枚目のところのみをスクロール」）', () => {
  it('パネルは画面の高さに収めて送らない。一覧（_targetLinkLists）だけが残りの高さで送る。一覧の下に灰色の間をあける', async () => {
    const t = await setupLinkReplacePanel(HTML)
    const css = t.window.document.getElementById('link-replace-style')?.textContent ?? ''
    const rule = (selector: string): string => {
      const at = css.indexOf(`${selector}{`)
      return at < 0 ? '' : css.slice(at, css.indexOf('}', at))
    }
    const panel = rule('[data-clone-panel="link-replace"]')
    expect(panel).toContain('max-height:calc(100vh - 140px)')
    expect(panel).toContain('overflow:hidden')
    expect(panel).not.toContain('overflow-y:auto')
    const list = rule('._targetLinkLists_id5w4_134')
    expect(list).toContain('overflow-y:auto')
    expect(list).toContain('min-height:0')
    expect(list).toContain('margin-bottom:12px')
  })
})

describe('下のチェックの ⓘ（2026-10-27 本人「消して」）', () => {
  it('「計測機能付きリンクに変更」「リンクを別タブで開く」の横の ⓘ と、開かない説明の箱を出さない。チェックと文字は残す', async () => {
    const t = await setupLinkReplacePanel(HTML)
    for (const box of t.panel.querySelectorAll('._trackingCheckBox_id5w4_257, ._targetCheckBox_id5w4_9')) {
      expect(box.querySelector('svg')).toBeNull()
      expect(box.querySelector('._description_1uihv_17')).toBeNull()
      expect(box.querySelector('input[type="checkbox"]')).not.toBeNull()
    }
    expect(t.panel.querySelector('label[for="trackingCheckBox"]')?.textContent).toBe('計測機能付きリンクに変更')
    expect(t.panel.querySelector('label[for="targetCheckBox"]')?.textContent).toBe('リンクを別タブで開く')
  })
})

describe('外を押したら閉じる（㉓）', () => {
  it('開いているとき、パネルの外を押すと閉じる。中を押しても閉じない', async () => {
    const closed: number[] = []
    const t = await setupLinkReplacePanel(HTML, () => closed.push(1))
    t.panel.querySelector('[data-link-row="0"]')?.dispatchEvent(new t.window.Event('pointerdown', { bubbles: true }))
    expect(closed).toHaveLength(0)
    t.body.dispatchEvent(new t.window.Event('pointerdown', { bubbles: true }))
    expect(closed).toHaveLength(1)
  })

  it('閉じているときは何もしない', async () => {
    const closed: number[] = []
    const t = await setupLinkReplacePanel(HTML, () => closed.push(1))
    t.panel.classList.remove('_open_x4j8w_84')
    t.body.dispatchEvent(new t.window.Event('pointerdown', { bubbles: true }))
    expect(closed).toHaveLength(0)
  })
})

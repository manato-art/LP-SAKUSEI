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

/**
 * 履歴（変更・復元履歴）のパネル（2026-10-27）。
 * 指示㉚ 本人「履歴もリンク置換と同じように外を押したら閉じて」／指示㉛「履歴の項目をリデザインして」（見本の画像）。
 * 見本: 大きな太字の題名・オレンジの復元と灰色の戻る／行は枠で囲んだ箱・選んだ行は淡いオレンジ／「現行版」は小さな札。
 */
import { parseHTML } from 'linkedom'
import { describe, expect, it, vi } from 'vitest'

const OPEN = '_open_x4j8w_84'

async function setup(onClose: () => void) {
  vi.resetModules()
  const { window } = parseHTML('<!doctype html><html><head></head><body><div id="root"><div class="ql-editor"></div></div><div id="outside"></div><div data-history-toggle id="icon"></div></body></html>')
  const g = globalThis as unknown as Record<string, unknown>
  for (const key of ['document', 'window', 'Event', 'CustomEvent', 'Element', 'HTMLElement', 'HTMLInputElement', 'Node']) {
    g[key] = (window as unknown as Record<string, unknown>)[key]
  }
  const histories = [
    { id: 3, article_uid: 'A', version_uid: 'V1', recorded_at: 3, recorded_at_label: '2026-10-27 19:42:02', is_current: true, label: '編集' },
    { id: 2, article_uid: 'A', version_uid: 'V1', recorded_at: 2, recorded_at_label: '2026-10-27 19:41:57', is_current: false, label: '本文 +23文字' },
  ]
  g['fetch'] = async (_url: string, init?: RequestInit) =>
    new Response(JSON.stringify(init?.method === 'POST' ? { history: histories[0], recorded: false } : { histories }), { status: 200 })
  const mod = await import('../src/app/panels/history.ts')
  const root = window.document.getElementById('root') as unknown as HTMLElement
  const panel = mod.mountHistory(root, 'A', { versionUid: () => 'V1', currentHtml: () => '<p>x</p>', apply: () => undefined }, onClose)
  if (panel === null) throw new Error('パネルが出ない')
  panel.classList.add(OPEN)
  mod.refreshHistory(panel)
  await new Promise((resolve) => setTimeout(resolve, 10))
  const press = (el: Element): void => {
    el.dispatchEvent(new window.Event('pointerdown', { bubbles: true }))
  }
  return { window, panel, press }
}

describe('履歴のパネルを外を押して閉じる（指示㉚）', () => {
  it('パネルの外を押すと閉じる。パネルの中・履歴のアイコンを押したときは閉じない', async () => {
    const onClose = vi.fn()
    const { window, panel, press } = await setup(onClose)
    press(panel.querySelector('._articleHistoryList_qvqhx_22') as Element)
    press(window.document.getElementById('icon') as unknown as Element)
    expect(onClose).not.toHaveBeenCalled()
    press(window.document.getElementById('outside') as unknown as Element)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('閉じているときは外を押しても何もしない', async () => {
    const onClose = vi.fn()
    const { window, panel, press } = await setup(onClose)
    panel.classList.remove(OPEN)
    press(window.document.getElementById('outside') as unknown as Element)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('「戻る」は開け閉めの記録を通して閉じる（パネルの class を直接外さない）', async () => {
    const onClose = vi.fn()
    const { window, panel } = await setup(onClose)
    panel.querySelector('._btnCancel_qvqhx_12')?.dispatchEvent(new window.Event('click'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('履歴の項目の見た目（指示㉛）', () => {
  it('「現行版」の行に札の印が付き、見た目の決まりが入る', async () => {
    const { window, panel } = await setup(() => undefined)
    const current = panel.querySelector('[data-clone-current="true"]')
    expect(current?.querySelector('.hx-current-tag')?.textContent).toBe('現行版')
    const css = window.document.getElementById('history-panel-style')?.textContent ?? ''
    expect(css).toContain('#FF8D02')
    expect(css).toContain('#FFF6E9')
    // 開け閉めは採取物の class に任せる（パネルに display を当てない・KB-2026-10-27-009）
    expect(css).not.toMatch(/_bodyWrapper_x4j8w_8\{[^}]*display/)
  })
})

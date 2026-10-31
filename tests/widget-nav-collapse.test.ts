/**
 * 編集画面の左「設置済みWidget」の列を開け閉めできる（2026-10-18 本人指定「開いたり閉まったりできるようにして」）。
 *
 * 本人の選択: 閉じると列ごと細い帯にたたみ、その分キャンバスが広くなる（キャンバスは flex:1 なので自然に広がる）。
 * 帯を押すと開く。開け閉めはブラウザに覚えておき、次に編集画面を開いたときも同じにする。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { installDom } from './helpers/dom.ts'

const EDITOR_HTML =
  '<div class="_editorWrapper_abc">' +
  '<div class="versions"></div>' +
  '<div class="quillEditorContentWrapper"><div class="ql-editor">' +
  '<p>本文</p>' +
  '<section class="sb-widget-block"><div class="arrow">矢印</div></section>' +
  '<section class="sb-widget-block"><div class="arrow">矢印2</div></section>' +
  '</div></div></div>'

function installStorage(): Map<string, string> {
  const saved = new Map<string, string>()
  ;(globalThis as Record<string, unknown>)['localStorage'] = {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => { saved.set(key, value) },
  }
  return saved
}

async function mountEditor(): Promise<HTMLElement> {
  const g = globalThis as Record<string, unknown>
  const win = g['window'] as Record<string, unknown>
  // カードの縮小プレビュー（containWidgetStyles）と Widget の増減の見張りが使う
  g['MutationObserver'] = win['MutationObserver']
  g['DOMParser'] = win['DOMParser']
  document.body.innerHTML = EDITOR_HTML
  const { mountWidgetNav } = await import('../src/app/panels/widget-nav.ts')
  mountWidgetNav(document.body, {} as never)
  const sidebar = document.querySelector<HTMLElement>('[data-widget-nav]')
  if (sidebar === null) throw new Error('設置済みWidgetの列が無い')
  return sidebar
}

function toggle(sidebar: HTMLElement): HTMLElement {
  const button = sidebar.querySelector<HTMLElement>('[data-widget-nav-toggle]')
  if (button === null) throw new Error('開け閉めのボタンが無い')
  return button
}

function cardCount(sidebar: HTMLElement): number {
  return sidebar.querySelectorAll('[data-widget-nav-card]').length
}

function press(button: HTMLElement): void {
  button.dispatchEvent(new Event('click'))
}

beforeEach(() => {
  installDom()
  installStorage()
})

describe('設置済みWidgetの列の開け閉め', () => {
  it('最初は開いていて、Widgetのカードと「閉じる」ボタンが出る', async () => {
    const sidebar = await mountEditor()
    expect(sidebar.style.width).toBe('220px')
    // 列の名前は「設置済み」（離脱ポップも並べるため・指示41）。中は「Widget（2）▼」の段
    expect(sidebar.textContent).toContain('設置済み')
    expect(sidebar.textContent).toContain('Widget（2）')
    expect(cardCount(sidebar)).toBe(2)
    expect(toggle(sidebar).getAttribute('aria-label')).toBe('設置済みを閉じる')
    expect(toggle(sidebar).getAttribute('aria-expanded')).toBe('true')
  })

  it('閉じると細い帯になり、カードは出さない', async () => {
    const sidebar = await mountEditor()
    press(toggle(sidebar))
    expect(sidebar.style.width).toBe('28px')
    expect(cardCount(sidebar)).toBe(0)
    expect(toggle(sidebar).getAttribute('aria-label')).toBe('設置済みを開く')
    expect(toggle(sidebar).getAttribute('aria-expanded')).toBe('false')
  })

  it('帯を押すと、もとの幅に開いてカードが戻る', async () => {
    const sidebar = await mountEditor()
    press(toggle(sidebar))
    press(toggle(sidebar))
    expect(sidebar.style.width).toBe('220px')
    expect(cardCount(sidebar)).toBe(2)
  })

  it('閉じたことを覚えていて、次に編集画面を開いたときも閉じている', async () => {
    press(toggle(await mountEditor()))
    const reopened = await mountEditor()
    expect(reopened.style.width).toBe('28px')
    expect(cardCount(reopened)).toBe(0)
  })
})

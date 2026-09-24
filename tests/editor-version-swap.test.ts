/**
 * Versionを切り替えたときの中身の入れ替え（2026-09-24 全体点検1・2）。
 *
 * 1 ヘッダー画像の無いVersionを開いても、前のVersionの画像が残り、自動保存でそのVersionへ書き込まれていた
 * 2 切り替えた直後の「戻る」で前のVersionの本文に戻り、それが今のVersionへ保存されていた
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseHTML } from 'linkedom'

const HEADER_BOX = '<div class="_articleHeaderPhoto_1pk5s_1"><div class="sample_token_x"><span>ヘッダー画像を追加する</span></div></div>'

function setup(): { root: HTMLElement; editor: HTMLElement; calls: string[]; quill: never } {
  const { window } = parseHTML(`<!doctype html><html><body><div id="root">${HEADER_BOX}<div class="ql-editor"></div></div></body></html>`)
  const g = globalThis as unknown as Record<string, unknown>
  g['document'] = window.document
  g['CustomEvent'] = window.CustomEvent
  g['Event'] = window.Event
  g['requestAnimationFrame'] = (cb: () => void) => setTimeout(cb, 0)
  g['dispatchEvent'] = () => true
  const root = window.document.getElementById('root') as unknown as HTMLElement
  const editor = root.querySelector('.ql-editor') as HTMLElement
  const calls: string[] = []
  const quill = {
    root: editor,
    update: (source: string) => calls.push(`update:${source}`),
    history: { clear: () => calls.push('history.clear') },
  }
  return { root, editor, calls, quill: quill as never }
}

describe('Versionを開いたときの中身の入れ替え', () => {
  beforeEach(() => vi.resetModules())

  it('ヘッダー画像の無いVersionを開くと、前のVersionの画像を外す（外さないと別のVersionへ保存されていた）', async () => {
    const { root, quill } = setup()
    const { showVersionContent } = await import('../src/app/pages/editor-html.ts')
    showVersionContent({ root, quill }, '<!--header-image:data:image/png;base64,AAA--><p>Version1</p>')
    expect(root.querySelector('img[data-clone-header="true"]')).not.toBeNull()

    showVersionContent({ root, quill }, '<p>Version2</p>')
    expect(root.querySelector('img[data-clone-header="true"]')).toBeNull()
    expect(root.querySelector('[data-clone-header-remove]')).toBeNull()
    const prompt = [...root.querySelectorAll('span')].find((s) => s.textContent === 'ヘッダー画像を追加する') as HTMLElement
    expect(prompt.style.display).toBe('')
  })

  it('保存する中身にも前の画像が混ざらない', async () => {
    const { root, quill } = setup()
    const { showVersionContent, buildFullHtml } = await import('../src/app/pages/editor-html.ts')
    showVersionContent({ root, quill }, '<!--header-image:data:image/png;base64,AAA--><p>Version1</p>')
    showVersionContent({ root, quill }, '<p>Version2</p>')
    expect(buildFullHtml({ root, quill } as never)).toBe('<p>Version2</p>')
  })

  it('入れ替えは利用者の編集ではない: Quill に silent で取り込ませ、「戻る」の履歴を空にする', async () => {
    const { root, editor, calls, quill } = setup()
    const { showVersionContent } = await import('../src/app/pages/editor-html.ts')
    showVersionContent({ root, quill }, '<p>Version2</p>')
    expect(editor.innerHTML).toBe('<p>Version2</p>')
    expect(calls).toEqual(['update:silent', 'history.clear'])
  })

  it('画像の「削除」を押すと、自動保存の合図を出す（Quill の外の変更なので、出さないと保存されなかった）', async () => {
    const { root, quill } = setup()
    const { showVersionContent } = await import('../src/app/pages/editor-html.ts')
    const { EDITOR_CHANGE_EVENT } = await import('../src/app/panels/editor-change.ts')
    showVersionContent({ root, quill }, '<!--header-image:data:image/png;base64,AAA--><p>x</p>')
    let changed = 0
    root.addEventListener(EDITOR_CHANGE_EVENT, () => (changed += 1))
    ;(root.querySelector('[data-clone-header-remove]') as HTMLElement).dispatchEvent(new (globalThis as unknown as { Event: typeof Event }).Event('click'))
    expect(changed).toBe(1)
    expect(root.querySelector('img[data-clone-header="true"]')).toBeNull()
  })
})

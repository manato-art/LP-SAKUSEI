/**
 * Widget編集の「画面」切り替え（2026-09-22・本人の依頼「移行先の編集も行いたい」。ノーコードでWidgetを作る④）。
 *
 * 「部品を積んで作る」で画面①②…を作ったWidgetは、LPでは最初の画面だけが見え、押すと次の画面へ切り替わる。
 * Widget編集の見たまま画面でも最初の画面しか見えないので、上に画面のタブを出して、選んだ画面を直せるようにする。
 *
 * - 画面の hidden は触らない（触るとコード欄へ書き出されて保存され、LPの最初の画面が変わる）。
 *   見たまま画面の外に置いた style で見せ方だけを上書きする（editorScreenCss）
 * - 画面が1つだけのWidget・型で作っていないWidgetでは何も出さない
 */
import { editorScreenCss, screenLabel } from './screens-state.ts'

export function attachScreenSwitcher(editorBody: HTMLElement, contentDiv: HTMLElement): void {
  const root = contentDiv.querySelector<HTMLElement>('[data-nc-screens]')
  if (root === null) return
  const uid = [...root.classList].find((c) => /^nc-[a-z0-9]{8}$/.test(c))
  const screens = [...root.children].filter((c): c is HTMLElement => c instanceof HTMLElement && /^s\d{1,4}$/.test(c.dataset['ncScreen'] ?? ''))
  if (uid === undefined || screens.length < 2) return

  const bar = document.createElement('div')
  bar.dataset['nocodeScreenBar'] = 'true'
  bar.setAttribute('role', 'tablist')
  bar.setAttribute('aria-label', '編集する画面')
  bar.style.cssText =
    'display:flex;align-items:center;gap:6px;flex-shrink:0;overflow-x:auto;padding:8px 12px;' +
    'background:#F7F8FA;border-bottom:1px solid #E3E6EA;font:12.5px/1.4 "Hiragino Sans",sans-serif'
  const label = document.createElement('span')
  label.textContent = '編集する画面'
  label.style.cssText = 'flex-shrink:0;color:#6B7480;margin-right:4px'
  bar.append(label)

  const style = document.createElement('style')
  const tabs: HTMLButtonElement[] = []
  const show = (id: string): void => {
    style.textContent = editorScreenCss(uid, id)
    for (const tab of tabs) {
      const on = tab.dataset['screen'] === id
      tab.setAttribute('aria-selected', String(on))
      tab.style.background = on ? 'var(--sb-accent, #0091FF)' : '#FFFFFF'
      tab.style.color = on ? '#FFFFFF' : '#1F2A37'
      tab.style.borderColor = on ? 'var(--sb-accent, #0091FF)' : '#D5DAE0'
    }
  }
  screens.forEach((screen, index) => {
    const id = screen.dataset['ncScreen'] ?? ''
    const tab = document.createElement('button')
    tab.type = 'button'
    tab.setAttribute('role', 'tab')
    tab.dataset['screen'] = id
    tab.textContent = (screen.dataset['ncName'] ?? '').trim() || screenLabel(index + 1)
    tab.style.cssText =
      'flex-shrink:0;border:1px solid #D5DAE0;border-radius:999px;padding:5px 12px;cursor:pointer;' +
      'font:700 12.5px/1.4 "Hiragino Sans",sans-serif;white-space:nowrap'
    // 押しても文字の選択やカーソル位置を失わない
    tab.addEventListener('mousedown', (e) => e.preventDefault())
    tab.addEventListener('click', () => show(id))
    tabs.push(tab)
    bar.append(tab)
  })
  bar.append(style)
  editorBody.before(bar)
  show(screens[0]?.dataset['ncScreen'] ?? '')
}

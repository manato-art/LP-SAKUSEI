/**
 * Widget編集の「画面」切り替え（2026-09-22・本人の依頼「移行先の編集も行いたい」。ノーコードでWidgetを作る④）。
 *
 * 「部品を積んで作る」で画面①②…を作ったWidgetは、LPでは最初の画面だけが見え、押すと次の画面へ切り替わる。
 * Widget編集の見たまま画面でも最初の画面しか見えないので、上に画面のタブを出して、選んだ画面を直せるようにする。
 *
 * - 画面の hidden は触らない（触るとコード欄へ書き出されて保存され、LPの最初の画面が変わる）。
 *   見たまま画面の外に置いた style で見せ方だけを上書きする（editorScreenCss）
 * - 画面が1つだけのWidget・型で作っていないWidgetでは何も出さない
 * - 見本にもともとある設問①②…（attachStepSwitcher）も、同じように上のタブで切り替えて直せる
 *   （本人の依頼「見本でもページの切り替わりを」。決定: 両方）
 */
import { findStepGroup, type SlotNode } from './sample-model.ts'
import { cssPathFrom, editorScreenCss, editorStepCss, screenLabel } from './screens-state.ts'

/**
 * 画面①②…のタブを host に足す（Widget編集の右側の「画面」の段。以前は見たまま画面の上に出していた）。
 * 画面が1つだけ・部品で作っていないWidgetでは何も足さない。
 */
export function attachScreenSwitcher(host: HTMLElement, contentDiv: HTMLElement): void {
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
  host.append(bar)
  show(screens[0]?.dataset['ncScreen'] ?? '')
}

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'
/** 見本のスクリプトが動いて、最初の見え方が決まるまで待つ */
const STEP_DETECT_DELAY_MS = 500

/**
 * 見本にもともとある設問①②…を、Widget編集の上のタブで切り替える（入れたあとも隠れている設問を直せる）。
 * 設問は、今の見え方（見えている箱が1つ・ほかは隠れている）で見つける。見本のスクリプトが動いてから調べる。
 * 切り替えは見たまま画面の外の style で見せ方だけ変える（Widgetの中身には目印を付けない＝保存されない）。
 */
export function attachStepSwitcher(host: HTMLElement, contentDiv: HTMLElement): void {
  window.setTimeout(() => {
    if (!contentDiv.isConnected) return
    const visible = (node: SlotNode): boolean => {
      const style = getComputedStyle(node as unknown as Element)
      return style.display !== 'none' && style.visibility !== 'hidden'
    }
    const steps = findStepGroup(contentDiv as unknown as SlotNode, visible) as unknown as HTMLElement[]
    const paths = steps.map((step) => cssPathFrom(contentDiv, step))
    if (steps.length < 2 || paths.some((path) => path === null)) return
    const bar = document.createElement('div')
    bar.dataset['nocodeStepBar'] = 'true'
    bar.setAttribute('role', 'tablist')
    bar.setAttribute('aria-label', '見本の設問')
    bar.style.cssText =
      'display:flex;align-items:center;gap:6px;flex-shrink:0;overflow-x:auto;padding:8px 12px;' +
      'background:#F7F8FA;border-bottom:1px solid #E3E6EA;font:12.5px/1.4 "Hiragino Sans",sans-serif'
    const label = document.createElement('span')
    label.textContent = '見本の設問'
    label.style.cssText = 'flex-shrink:0;color:#6B7480;margin-right:4px'
    bar.append(label)
    const style = document.createElement('style')
    const tabs: HTMLButtonElement[] = []
    const paint = (active: number): void => {
      for (const [i, tab] of tabs.entries()) {
        const on = i === active
        tab.setAttribute('aria-selected', String(on))
        tab.style.background = on ? 'var(--sb-accent, #0091FF)' : '#FFFFFF'
        tab.style.color = on ? '#FFFFFF' : '#1F2A37'
        tab.style.borderColor = on ? 'var(--sb-accent, #0091FF)' : '#D5DAE0'
      }
    }
    steps.forEach((_, index) => {
      const tab = document.createElement('button')
      tab.type = 'button'
      tab.setAttribute('role', 'tab')
      tab.textContent = `設問${Array.from(CIRCLED)[index] ?? String(index + 1)}`
      tab.style.cssText =
        'flex-shrink:0;border:1px solid #D5DAE0;border-radius:999px;padding:5px 12px;cursor:pointer;' +
        'font:700 12.5px/1.4 "Hiragino Sans",sans-serif;white-space:nowrap'
      tab.addEventListener('mousedown', (e) => e.preventDefault())
      tab.addEventListener('click', () => {
        style.textContent = editorStepCss(paths as string[], index)
        paint(index)
      })
      tabs.push(tab)
      bar.append(tab)
    })
    bar.append(style)
    host.append(bar)
    // 今見えている設問を選んだ状態にする（見え方はまだ変えない）
    paint(Math.max(0, steps.findIndex((step) => visible(step as unknown as SlotNode))))
  }, STEP_DETECT_DELAY_MS)
}

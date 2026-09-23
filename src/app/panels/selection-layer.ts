/**
 * 見たまま画面で「選んでいるもの」を示す枠（2026-09-23・Widget編集に統合）。
 *
 * 押した部品の外側に枠と名前を出す。右側の入力欄と同じ部品を指す（Canva の選択枠）。
 * 枠は Widget の中身（contentDiv）の外の層に置く（中に置くとコード欄へ書き出されて保存されてしまう。
 * 並んでいる部品の操作ボタン item-toolbar.ts と同じ作り）。
 * スクロール・打ち直し・大きさの変化に追従する。
 */
const ACCENT = 'var(--sb-accent, #0091FF)'

export interface SelectionLayer {
  /** 枠を出す（null で消す）。label は枠の上に出す名前 */
  readonly select: (el: HTMLElement | null, label?: string) => void
  readonly current: () => HTMLElement | null
  /** 位置を合わせ直す（描き直したあとなど） */
  readonly refresh: () => void
}

export function createSelectionLayer(editorBody: HTMLElement, contentDiv: HTMLElement): SelectionLayer {
  const layer = document.createElement('div')
  layer.dataset['widgetSelectionLayer'] = 'true'
  layer.style.cssText = 'position:relative;height:0;width:0'
  editorBody.prepend(layer)

  const frame = document.createElement('div')
  frame.style.cssText =
    `position:absolute;display:none;pointer-events:none;z-index:9997;box-sizing:border-box;` +
    `outline:2px solid ${ACCENT};outline-offset:2px;border-radius:2px`
  const tag = document.createElement('div')
  tag.style.cssText =
    `position:absolute;left:-2px;top:-2px;transform:translateY(-100%);padding:2px 7px;border-radius:4px 4px 0 0;` +
    `background:${ACCENT};color:var(--sb-accent-ink, #FFFFFF);font:600 11px/1.4 "Hiragino Sans",sans-serif;white-space:nowrap`
  frame.append(tag)
  layer.append(frame)

  let current: HTMLElement | null = null

  const place = (): void => {
    if (current === null || !contentDiv.contains(current)) {
      frame.style.display = 'none'
      current = null
      return
    }
    const origin = layer.getBoundingClientRect()
    const rect = current.getBoundingClientRect()
    frame.style.display = 'block'
    frame.style.top = `${rect.top - origin.top}px`
    frame.style.left = `${rect.left - origin.left}px`
    frame.style.width = `${rect.width}px`
    frame.style.height = `${rect.height}px`
    // 枠がいちばん上にあるときは名前を枠の中に入れる（見たまま画面の上端で切れないように）
    const view = editorBody.getBoundingClientRect()
    const inside = rect.top - view.top < 24
    tag.style.transform = inside ? 'none' : 'translateY(-100%)'
    tag.style.borderRadius = inside ? '0 0 4px 0' : '4px 4px 0 0'
  }

  let raf = 0
  const schedule = (): void => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(place)
  }
  editorBody.addEventListener('scroll', schedule)
  contentDiv.addEventListener('input', schedule)
  window.addEventListener('resize', schedule)
  const observer = new ResizeObserver(schedule)
  observer.observe(contentDiv)

  return {
    select: (el, label = '') => {
      current = el
      tag.textContent = label
      tag.style.display = label === '' ? 'none' : 'block'
      place()
    },
    current: () => current,
    refresh: schedule,
  }
}

/**
 * 指示㊻: エディタ右側のミニマップ（LP全体の縮小プレビュー）。
 *
 * 右ツールバーの横に細い帯（幅40px）でLP本文全体の縮小画像を表示し、
 * クリック/ドラッグで該当箇所へ一気にスクロールできる。
 *
 * 実装はCanvas描画ではなく、Quill本文のクローンをCSSで縮小表示する方式
 * （transform:scale）。軽量でリアルタイム追従できる。
 */

const MINIMAP_WIDTH = 40
const MINIMAP_SCALE = 0.06

/** ミニマップを生成してエディタに差し込む */
export function mountMinimap(editorRoot: HTMLElement, scrollContainer: HTMLElement): void {
  if (editorRoot.querySelector('[data-clone-minimap]') !== null) return

  const quillHost =
    editorRoot.querySelector<HTMLElement>('.ql-editor')?.parentElement ?? null
  if (quillHost === null) return

  // ── ミニマップの外枠 ──
  const wrapper = document.createElement('div')
  wrapper.setAttribute('data-clone-minimap', 'true')
  wrapper.style.cssText = [
    'position:fixed',
    'top:80px',
    'right:0',
    `width:${MINIMAP_WIDTH}px`,
    'bottom:40px',
    'overflow:hidden',
    'z-index:40',
    'background:#F5F5F5',
    'border-left:1px solid #E0E0E0',
    'cursor:pointer',
    'user-select:none',
  ].join(';')

  // ── LP本文の縮小クローン ──
  const clone = document.createElement('div')
  clone.style.cssText = [
    `transform:scale(${MINIMAP_SCALE})`,
    'transform-origin:top left',
    `width:${100 / MINIMAP_SCALE}%`,
    'pointer-events:none',
    'position:absolute',
    'top:0',
    'left:0',
  ].join(';')
  wrapper.append(clone)

  // ── ビューポートインジケータ（現在表示範囲を示す半透明の帯） ──
  const viewport = document.createElement('div')
  viewport.style.cssText = [
    'position:absolute',
    'left:0',
    `width:${MINIMAP_WIDTH}px`,
    'background:rgba(0,145,255,0.15)',
    'border:1px solid rgba(0,145,255,0.4)',
    'border-radius:2px',
    'pointer-events:none',
    'transition:top 0.1s ease-out, height 0.1s ease-out',
  ].join(';')
  wrapper.append(viewport)

  // ── サイドツールバーの右横に配置 ──
  // fixed なので body 直下に置く
  document.body.append(wrapper)

  // ── 同期: Quill本文をクローンへ転写 ──
  let syncTimer: ReturnType<typeof setTimeout> | null = null
  const syncContent = (): void => {
    const qlEditor = editorRoot.querySelector<HTMLElement>('.ql-editor')
    if (qlEditor === null) return
    clone.innerHTML = qlEditor.innerHTML
    // 画像の max-width を制限して横溢れを防ぐ
    for (const img of clone.querySelectorAll<HTMLImageElement>('img')) {
      img.style.maxWidth = '100%'
      img.style.height = 'auto'
    }
    updateViewport()
  }

  const scheduleSyncContent = (): void => {
    if (syncTimer !== null) clearTimeout(syncTimer)
    syncTimer = setTimeout(syncContent, 300)
  }

  // ── ビューポートインジケータの位置を更新 ──
  const updateViewport = (): void => {
    const wrapperH = wrapper.clientHeight
    const contentH = clone.scrollHeight * MINIMAP_SCALE
    if (contentH <= 0) return
    const scrollRatio = scrollContainer.scrollTop / scrollContainer.scrollHeight
    const visibleRatio = scrollContainer.clientHeight / scrollContainer.scrollHeight
    const top = scrollRatio * Math.min(wrapperH, contentH)
    const height = visibleRatio * Math.min(wrapperH, contentH)
    viewport.style.top = `${top}px`
    viewport.style.height = `${Math.max(8, height)}px`
  }

  // ── クリック/ドラッグでスクロール ──
  const scrollToY = (clientY: number): void => {
    const rect = wrapper.getBoundingClientRect()
    const contentH = clone.scrollHeight * MINIMAP_SCALE
    const mapH = Math.min(rect.height, contentH)
    if (mapH <= 0) return
    const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / mapH))
    scrollContainer.scrollTop =
      ratio * (scrollContainer.scrollHeight - scrollContainer.clientHeight)
  }

  let isDragging = false
  wrapper.addEventListener('mousedown', (e: MouseEvent) => {
    isDragging = true
    scrollToY(e.clientY)
    document.body.style.userSelect = 'none'
  })
  document.addEventListener('mousemove', (e: MouseEvent) => {
    if (!isDragging) return
    scrollToY(e.clientY)
  })
  document.addEventListener('mouseup', () => {
    if (!isDragging) return
    isDragging = false
    document.body.style.userSelect = ''
  })

  // ── イベント購読 ──
  scrollContainer.addEventListener('scroll', updateViewport, { passive: true })
  // MutationObserver で本文の変化を追う
  const qlEditor = editorRoot.querySelector<HTMLElement>('.ql-editor')
  if (qlEditor !== null) {
    const observer = new MutationObserver(scheduleSyncContent)
    observer.observe(qlEditor, { childList: true, subtree: true, characterData: true })
  }
  addEventListener('resize', updateViewport)

  // 初回描画
  syncContent()
}

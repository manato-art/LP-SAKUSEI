/**
 * 指示㊻: エディタ右側のミニマップ（LP全体の縮小プレビュー）。
 *
 * 右ツールバーの横に細い帯（幅40px）でLP本文全体の縮小画像を表示し、
 * クリック/ドラッグで該当箇所へ一気にスクロールできる。
 *
 * 実装はCanvas描画ではなく、Quill本文のクローンをCSSで縮小表示する方式
 * （transform:scale）。軽量でリアルタイム追従できる。
 *
 * 修正（指示46再修正）: コンテンツが長い場合にビューポートインジケータの位置が
 * ずれていたのを修正。動的スケール計算でLP全体が必ずミニマップ内に収まるようにし、
 * クリック/ドラッグの位置もそれに合わせて正確にスクロールする。
 */

const MINIMAP_WIDTH = 40
/** 理想スケール。コンテンツが長い場合はこれより小さくなる */
const PREFERRED_SCALE = 0.06

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
    'transform-origin:top left',
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
  document.body.append(wrapper)

  /** 現在の実効スケール（コンテンツ量で変わる） */
  let effectiveScale = PREFERRED_SCALE

  /** クローンのスケールを再計算し、LP全体がミニマップ内に収まるようにする */
  const recalcScale = (): void => {
    const wrapperH = wrapper.clientHeight
    if (wrapperH <= 0 || clone.scrollHeight <= 0) {
      effectiveScale = PREFERRED_SCALE
    } else {
      // コンテンツが長い場合は PREFERRED_SCALE より小さくして全体を収める
      effectiveScale = Math.min(PREFERRED_SCALE, wrapperH / clone.scrollHeight)
    }
    clone.style.transform = `scale(${effectiveScale})`
    clone.style.width = `${100 / effectiveScale}%`
  }

  // ── 同期: Quill本文をクローンへ転写 ──
  let syncTimer: ReturnType<typeof setTimeout> | null = null
  const syncContent = (): void => {
    const qlEditor = editorRoot.querySelector<HTMLElement>('.ql-editor')
    if (qlEditor === null) return
    clone.innerHTML = qlEditor.innerHTML
    for (const img of clone.querySelectorAll<HTMLImageElement>('img')) {
      img.style.maxWidth = '100%'
      img.style.height = 'auto'
    }
    recalcScale()
    updateViewport()
  }

  const scheduleSyncContent = (): void => {
    if (syncTimer !== null) clearTimeout(syncTimer)
    syncTimer = setTimeout(syncContent, 300)
  }

  // ── ビューポートインジケータの位置を更新 ──
  //
  // scrollFraction = scrollTop / maxScrollTop  (0=先頭, 1=末尾)
  // indicatorH     = (clientH / scrollH) * scaledH  (表示範囲の視覚的な高さ)
  // indicatorTop   = scrollFraction * (scaledH - indicatorH)
  //
  // scrollToY はこの逆写像で、クリック位置と表示位置が必ず一致する。
  const updateViewport = (): void => {
    const scrollH = scrollContainer.scrollHeight
    const clientH = scrollContainer.clientHeight
    if (scrollH <= 0 || scrollH <= clientH) return
    const scaledH = clone.scrollHeight * effectiveScale
    const indicatorH = (clientH / scrollH) * scaledH
    const maxScrollTop = scrollH - clientH
    const scrollFraction = scrollContainer.scrollTop / maxScrollTop
    const top = scrollFraction * (scaledH - indicatorH)
    viewport.style.top = `${top}px`
    viewport.style.height = `${Math.max(8, indicatorH)}px`
  }

  // ── クリック/ドラッグでスクロール ──
  const scrollToY = (clientY: number): void => {
    const rect = wrapper.getBoundingClientRect()
    const scrollH = scrollContainer.scrollHeight
    const clientH = scrollContainer.clientHeight
    if (scrollH <= clientH) return
    const scaledH = clone.scrollHeight * effectiveScale
    if (scaledH <= 0) return
    const indicatorH = (clientH / scrollH) * scaledH
    const track = scaledH - indicatorH
    if (track <= 0) return
    // クリック位置をインジケータの中央に合わせる
    const fraction = Math.max(0, Math.min(1, (clientY - rect.top - indicatorH / 2) / track))
    scrollContainer.scrollTop = fraction * (scrollH - clientH)
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
  const qlEditor = editorRoot.querySelector<HTMLElement>('.ql-editor')
  if (qlEditor !== null) {
    const observer = new MutationObserver(scheduleSyncContent)
    observer.observe(qlEditor, { childList: true, subtree: true, characterData: true })
  }
  addEventListener('resize', () => {
    recalcScale()
    updateViewport()
  })

  // 初回描画
  syncContent()
}

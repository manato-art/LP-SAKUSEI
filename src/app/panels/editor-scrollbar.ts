/**
 * エディタ右側のカスタムスクロールバー（旧ミニマップの位置）。
 *
 * 指示: もともとミニマップがあった右端の帯に、
 *   「触れる・見える」常時表示のスクロールバーを置く。
 *
 * macOS のオーバーレイ・スクロールバーは操作時しか出ず、ネイティブの
 * `::-webkit-scrollbar` もコンテンツが溢れないと消える。そこで実物と同じ
 * 「常に見える灰色のつまみ（ドラッグ可）」を JS で描く。スクロール本体は
 * `.ql-container`（overflow-y:scroll）のままで、このバーはその scrollTop を
 * 読み書きするだけ。ミニマップと同じ alignToCanvas でキャンバス高さに追従する。
 */

/** バー帯の幅（触れる当たり判定込み）。ツールバー配置(指示135)でも参照する */
export const SCROLLBAR_BAR_WIDTH = 14
const BAR_WIDTH = SCROLLBAR_BAR_WIDTH
/** つまみの最小高さ（短くなり過ぎて掴めなくなるのを防ぐ） */
const MIN_THUMB_H = 36

/**
 * カスタムスクロールバーを生成してキャンバスへ差し込む。
 * @param editorRoot エディタのルート要素
 * @param scrollContainer 実際にスクロールする要素（.ql-container）
 */
export function mountEditorScrollbar(
  editorRoot: HTMLElement,
  scrollContainer: HTMLElement,
): void {
  if (editorRoot.querySelector('[data-clone-scrollbar]') !== null) return

  const canvasArea =
    editorRoot.querySelector<HTMLElement>('.quillEditorContentWrapper') ??
    scrollContainer.closest<HTMLElement>('[class*="quillEditorContentWrapper"]')
  if (canvasArea === null) return

  // ネイティブの webkit スクロールバーは隠す（このカスタムバーに一本化する）
  hideNativeScrollbar()

  // ── 帯（トラック） ──
  const track = document.createElement('div')
  track.setAttribute('data-clone-scrollbar', 'true')
  track.style.cssText = [
    'position:absolute',
    'top:0',
    'right:0',
    `width:${BAR_WIDTH}px`,
    'height:100%',
    'z-index:6',
    'background:transparent',
    'cursor:pointer',
    'user-select:none',
  ].join(';')

  // ── つまみ ──
  const thumb = document.createElement('div')
  thumb.style.cssText = [
    'position:absolute',
    'left:50%',
    'transform:translateX(-50%)',
    'width:6px',
    'top:0',
    `min-height:${MIN_THUMB_H}px`,
    'background:#c0c0c0',
    'border-radius:6px',
    'transition:background .15s',
  ].join(';')
  track.append(thumb)
  thumb.addEventListener('mouseenter', () => { thumb.style.background = '#999' })
  thumb.addEventListener('mouseleave', () => { if (!isDragging) thumb.style.background = '#c0c0c0' })

  canvasArea.append(track)

  // ── キャンバス（.ql-container）の位置に帯を合わせる（ミニマップと同じ手法） ──
  const alignToCanvas = (): void => {
    const top = scrollContainer.offsetTop
    const parentH = canvasArea.clientHeight
    const bottom = parentH - scrollContainer.offsetTop - scrollContainer.clientHeight
    track.style.top = `${top}px`
    track.style.bottom = `${Math.max(0, bottom)}px`
    track.style.height = 'auto'
    updateThumb()
  }

  // ── つまみの位置・高さを scrollContainer から算出 ──
  const updateThumb = (): void => {
    const scrollH = scrollContainer.scrollHeight
    const clientH = scrollContainer.clientHeight
    const trackH = track.clientHeight
    if (scrollH <= clientH || trackH <= 0) {
      // スクロール不要ならつまみは隠す（掴む対象が無いのに出すと紛らわしい）
      thumb.style.display = 'none'
      return
    }
    thumb.style.display = 'block'
    const thumbH = Math.max(MIN_THUMB_H, (clientH / scrollH) * trackH)
    const maxScrollTop = scrollH - clientH
    const scrollFraction = maxScrollTop > 0 ? scrollContainer.scrollTop / maxScrollTop : 0
    const thumbTop = scrollFraction * (trackH - thumbH)
    thumb.style.height = `${thumbH}px`
    thumb.style.top = `${thumbTop}px`
  }

  // ── ドラッグでスクロール ──
  let isDragging = false
  let dragStartY = 0
  let dragStartScrollTop = 0

  thumb.addEventListener('mousedown', (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    isDragging = true
    dragStartY = e.clientY
    dragStartScrollTop = scrollContainer.scrollTop
    thumb.style.background = '#999'
    document.body.style.userSelect = 'none'
  })

  document.addEventListener('mousemove', (e: MouseEvent) => {
    if (!isDragging) return
    const scrollH = scrollContainer.scrollHeight
    const clientH = scrollContainer.clientHeight
    const trackH = track.clientHeight
    const thumbH = Math.max(MIN_THUMB_H, (clientH / scrollH) * trackH)
    const travel = trackH - thumbH
    if (travel <= 0) return
    const deltaY = e.clientY - dragStartY
    const scrollDelta = (deltaY / travel) * (scrollH - clientH)
    scrollContainer.scrollTop = dragStartScrollTop + scrollDelta
  })

  document.addEventListener('mouseup', () => {
    if (!isDragging) return
    isDragging = false
    thumb.style.background = '#c0c0c0'
    document.body.style.userSelect = ''
  })

  // ── トラッククリックでその位置へジャンプ ──
  track.addEventListener('mousedown', (e: MouseEvent) => {
    if (e.target === thumb) return
    const scrollH = scrollContainer.scrollHeight
    const clientH = scrollContainer.clientHeight
    const trackH = track.clientHeight
    if (scrollH <= clientH || trackH <= 0) return
    const thumbH = Math.max(MIN_THUMB_H, (clientH / scrollH) * trackH)
    const rect = track.getBoundingClientRect()
    const clickY = e.clientY - rect.top - thumbH / 2
    const fraction = Math.max(0, Math.min(1, clickY / (trackH - thumbH)))
    scrollContainer.scrollTop = fraction * (scrollH - clientH)
  })

  // ── 追従: スクロール・リサイズ・本文変更 ──
  scrollContainer.addEventListener('scroll', updateThumb, { passive: true })
  addEventListener('resize', alignToCanvas)
  const qlEditor = editorRoot.querySelector<HTMLElement>('.ql-editor')
  if (qlEditor !== null) {
    const mo = new MutationObserver(() => {
      alignToCanvas()
      updateThumb()
    })
    mo.observe(qlEditor, { childList: true, subtree: true, characterData: true })
  }
  // ヘッダー画像・URLバーが後から差し込まれる → 複数タイミングで再計算
  requestAnimationFrame(alignToCanvas)
  setTimeout(alignToCanvas, 300)
  setTimeout(alignToCanvas, 800)
}

/** ネイティブの webkit スクロールバーを隠す（カスタムバーへ一本化） */
function hideNativeScrollbar(): void {
  if (document.getElementById('sb-hide-native-scrollbar') !== null) return
  const style = document.createElement('style')
  style.id = 'sb-hide-native-scrollbar'
  style.textContent =
    '.quillEditorContentWrapper .ql-container::-webkit-scrollbar { width: 0 !important; height: 0 !important; }'
  document.head.append(style)
}

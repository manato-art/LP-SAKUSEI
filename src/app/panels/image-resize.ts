/**
 * 指示㊵: エディタ内の画像をクリックしたとき、リサイズハンドルを表示して
 * ドラッグでサイズ変更できるようにする。
 *
 * 実物の見た目（スクショより）:
 * - 画像全体を囲む青い枠線
 * - 右下に1つだけ丸いドラッグハンドル（青い円）
 * - 画像の右下にサイズ表示バッジ（「570 x 320」）
 */
import type Quill from 'quill'

/** リサイズ中の状態 */
interface ResizeState {
  img: HTMLImageElement
  startX: number
  startY: number
  startWidth: number
  startHeight: number
}

/**
 * Quill エディタに画像リサイズ機能を追加する。
 * 画像をクリックするとリサイズUIが出る。エディタ外をクリックすると消える。
 */
export function wireImageResize(quill: Quill): void {
  const root = quill.root
  let overlay: HTMLDivElement | null = null
  let sizeBadge: HTMLDivElement | null = null
  let handle: HTMLDivElement | null = null
  let activeImg: HTMLImageElement | null = null
  let resizeState: ResizeState | null = null

  function removeOverlay(): void {
    if (overlay !== null) {
      overlay.remove()
      overlay = null
    }
    if (sizeBadge !== null) {
      sizeBadge.remove()
      sizeBadge = null
    }
    if (handle !== null) {
      handle.remove()
      handle = null
    }
    activeImg = null
  }

  function updateSizeBadge(img: HTMLImageElement): void {
    if (sizeBadge === null) return
    const w = Math.round(img.getBoundingClientRect().width)
    const h = Math.round(img.getBoundingClientRect().height)
    sizeBadge.textContent = `${w} x ${h}`
    // バッジは画像の右下内側に配置
    const imgRect = img.getBoundingClientRect()
    const rootRect = root.getBoundingClientRect()
    const badgeW = sizeBadge.offsetWidth
    const badgeH = sizeBadge.offsetHeight
    sizeBadge.style.left = `${imgRect.right - rootRect.left - badgeW - 8 + root.scrollLeft}px`
    sizeBadge.style.top = `${imgRect.bottom - rootRect.top - badgeH - 8 + root.scrollTop}px`
  }

  function positionOverlay(img: HTMLImageElement): void {
    if (overlay === null) return
    const imgRect = img.getBoundingClientRect()
    const rootRect = root.getBoundingClientRect()
    const left = imgRect.left - rootRect.left + root.scrollLeft
    const top = imgRect.top - rootRect.top + root.scrollTop
    overlay.style.left = `${left}px`
    overlay.style.top = `${top}px`
    overlay.style.width = `${imgRect.width}px`
    overlay.style.height = `${imgRect.height}px`

    // ハンドルは枠の右下角に配置
    if (handle !== null) {
      handle.style.left = `${left + imgRect.width - 6}px`
      handle.style.top = `${top + imgRect.height - 6}px`
    }
  }

  function showOverlay(img: HTMLImageElement): void {
    removeOverlay()
    activeImg = img
    root.style.position = 'relative'

    // 青い枠線のオーバーレイ
    overlay = document.createElement('div')
    overlay.style.cssText =
      'position:absolute;border:2px solid #0091FF;pointer-events:none;z-index:10;box-sizing:border-box'
    root.append(overlay)

    // 右下に1つだけ丸いハンドル（実物と同じ）
    handle = document.createElement('div')
    handle.style.cssText =
      'position:absolute;width:12px;height:12px;background:#0091FF;border-radius:50%;' +
      'pointer-events:auto;cursor:nwse-resize;z-index:11;border:2px solid #fff;box-sizing:border-box'
    root.append(handle)

    handle.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      resizeState = {
        img,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: img.getBoundingClientRect().width,
        startHeight: img.getBoundingClientRect().height,
      }
      document.body.style.cursor = 'nwse-resize'
      document.body.style.userSelect = 'none'
    })

    // サイズバッジ（「570 x 320」）
    sizeBadge = document.createElement('div')
    sizeBadge.style.cssText =
      'position:absolute;background:rgba(0,145,255,0.85);color:#fff;font-size:11px;' +
      'padding:2px 8px;border-radius:3px;pointer-events:none;z-index:12;white-space:nowrap;' +
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif'
    root.append(sizeBadge)

    positionOverlay(img)
    updateSizeBadge(img)
  }

  // クリックで画像を選択
  root.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'IMG') {
      e.preventDefault()
      showOverlay(target as HTMLImageElement)
    } else if (overlay !== null && !overlay.contains(target) && target !== handle) {
      removeOverlay()
    }
  })

  // ドラッグでリサイズ（右下ハンドルのみ → 右下方向が拡大）
  document.addEventListener('mousemove', (e: MouseEvent) => {
    if (resizeState === null) return
    const { img, startX, startWidth, startHeight } = resizeState
    const ratio = startHeight / startWidth

    const deltaX = e.clientX - startX
    const newWidth = Math.max(50, startWidth + deltaX)
    const newHeight = Math.round(newWidth * ratio)

    img.style.width = `${Math.round(newWidth)}px`
    img.style.height = `${newHeight}px`
    // img 属性の width/height も更新（Quill が HTML を保存するときに拾う）
    img.setAttribute('width', String(Math.round(newWidth)))
    img.setAttribute('height', String(newHeight))

    positionOverlay(img)
    updateSizeBadge(img)
  })

  document.addEventListener('mouseup', () => {
    if (resizeState === null) return
    resizeState = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  })

  // エディタ外のクリックで解除
  document.addEventListener('mousedown', (e: MouseEvent) => {
    if (activeImg === null) return
    const target = e.target as Node
    if (!root.contains(target) && target !== handle) {
      removeOverlay()
    }
  })
}

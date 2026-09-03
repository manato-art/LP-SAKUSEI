/**
 * 指示㊵: エディタ内の画像をクリックしたとき、リサイズハンドルを表示して
 * ドラッグでサイズ変更できるようにする。
 *
 * 仕組み:
 * - Quill のルート要素でクリックを監視
 * - img がクリックされたら四隅にハンドルを出す
 * - ハンドルのドラッグで画像の幅を変える（アスペクト比は保持）
 * - サイズ表示（「570 x 320」のようなバッジ）を画像の上に出す
 */
import type Quill from 'quill'

/** リサイズ中の状態 */
interface ResizeState {
  img: HTMLImageElement
  startX: number
  startY: number
  startWidth: number
  startHeight: number
  /** どの角を掴んでいるか */
  corner: 'se' | 'sw' | 'ne' | 'nw'
}

/**
 * Quill エディタに画像リサイズ機能を追加する。
 * 画像をクリックするとリサイズUIが出る。エディタ外をクリックすると消える。
 */
export function wireImageResize(quill: Quill): void {
  const root = quill.root
  let overlay: HTMLDivElement | null = null
  let sizeBadge: HTMLDivElement | null = null
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
    activeImg = null
  }

  function updateSizeBadge(img: HTMLImageElement): void {
    if (sizeBadge === null) return
    const w = Math.round(img.getBoundingClientRect().width)
    const h = Math.round(img.getBoundingClientRect().height)
    sizeBadge.textContent = `${w} x ${h}`
    // Position badge at bottom-right of image
    const imgRect = img.getBoundingClientRect()
    const rootRect = root.getBoundingClientRect()
    sizeBadge.style.left = `${imgRect.right - rootRect.left - sizeBadge.offsetWidth - 4 + root.scrollLeft}px`
    sizeBadge.style.top = `${imgRect.bottom - rootRect.top - sizeBadge.offsetHeight - 4 + root.scrollTop}px`
  }

  function positionOverlay(img: HTMLImageElement): void {
    if (overlay === null) return
    const imgRect = img.getBoundingClientRect()
    const rootRect = root.getBoundingClientRect()
    overlay.style.left = `${imgRect.left - rootRect.left + root.scrollLeft}px`
    overlay.style.top = `${imgRect.top - rootRect.top + root.scrollTop}px`
    overlay.style.width = `${imgRect.width}px`
    overlay.style.height = `${imgRect.height}px`
  }

  function showOverlay(img: HTMLImageElement): void {
    removeOverlay()
    activeImg = img

    // 青い枠線のオーバーレイ
    overlay = document.createElement('div')
    overlay.style.cssText =
      'position:absolute;border:2px solid #0091FF;pointer-events:none;z-index:10;box-sizing:border-box'
    root.style.position = 'relative'
    root.append(overlay)
    positionOverlay(img)

    // 四隅のハンドル
    const corners: ResizeState['corner'][] = ['nw', 'ne', 'sw', 'se']
    for (const corner of corners) {
      const handle = document.createElement('div')
      handle.dataset['corner'] = corner
      handle.style.cssText =
        'position:absolute;width:10px;height:10px;background:#0091FF;border-radius:2px;' +
        'pointer-events:auto;cursor:nwse-resize;z-index:11'
      // 位置
      if (corner.includes('n')) handle.style.top = '-5px'
      if (corner.includes('s')) handle.style.bottom = '-5px'
      if (corner.includes('w')) handle.style.left = '-5px'
      if (corner.includes('e')) handle.style.right = '-5px'
      // カーソル
      if (corner === 'ne' || corner === 'sw') handle.style.cursor = 'nesw-resize'

      handle.addEventListener('mousedown', (e: MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        resizeState = {
          img,
          startX: e.clientX,
          startY: e.clientY,
          startWidth: img.getBoundingClientRect().width,
          startHeight: img.getBoundingClientRect().height,
          corner,
        }
        document.body.style.cursor = handle.style.cursor
        document.body.style.userSelect = 'none'
      })
      overlay.append(handle)
    }

    // サイズバッジ
    sizeBadge = document.createElement('div')
    sizeBadge.style.cssText =
      'position:absolute;background:rgba(0,145,255,0.9);color:#fff;font-size:11px;' +
      'padding:2px 6px;border-radius:3px;pointer-events:none;z-index:12;white-space:nowrap;' +
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif'
    root.append(sizeBadge)
    updateSizeBadge(img)
  }

  // クリックで画像を選択
  root.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'IMG') {
      e.preventDefault()
      showOverlay(target as HTMLImageElement)
    } else if (overlay !== null && !overlay.contains(target)) {
      removeOverlay()
    }
  })

  // ドラッグでリサイズ
  document.addEventListener('mousemove', (e: MouseEvent) => {
    if (resizeState === null) return
    const { img, startX, startWidth, startHeight, corner } = resizeState
    const ratio = startHeight / startWidth

    // 右下・右上は右方向が拡大、左下・左上は左方向が拡大
    const xDir = corner.includes('e') ? 1 : -1
    const deltaX = (e.clientX - startX) * xDir
    const newWidth = Math.max(50, startWidth + deltaX)
    const newHeight = newWidth * ratio

    img.style.width = `${Math.round(newWidth)}px`
    img.style.height = `${Math.round(newHeight)}px`
    // img 属性の width/height も更新（Quill が HTML を保存するときに拾う）
    img.setAttribute('width', String(Math.round(newWidth)))
    img.setAttribute('height', String(Math.round(newHeight)))

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
    if (!root.contains(e.target as Node)) {
      removeOverlay()
    }
  })
}

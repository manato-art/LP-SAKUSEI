/**
 * 指示89: エディタ内の画像をクリックしたとき、四隅にリサイズハンドルを表示して
 * ドラッグで幅を変更できるようにする（高さは auto で比率維持）。
 *
 * UI:
 * - 画像全体を囲む青い枠線（選択枠）
 * - 四隅に丸いドラッグハンドル（青い円）
 * - 右下にサイズ表示バッジ（「570 × 320」）
 * - エディタ外クリックで選択解除
 * - 選んだまま Backspace / Delete で消す（2026-10-24。以前は Quill の文字のカーソルが前の場所のままで、
 *   Backspace は何も消えず、Delete はカーソルのあった所の文字を消していた）
 *
 * 実装上のポイント:
 * overlay 要素は **quill.container**（.ql-container = スクロールホスト）に置く。
 * quill.root（.ql-editor）に置くと Quill の MutationObserver が非 blot 要素として
 * 除去・ラップしてしまい、ハンドルが表示されない。
 * position:absolute をスクロール量込みで計算し、画像とともにスクロールする。
 */
import { keepAlignOnResize } from './media-align.ts'
import { isMediaDeleteKey } from './media-delete-key.ts'
import type Quill from 'quill'
import { attachImageActionBar } from './image-link.ts'
import { pageLife } from '../page-life.ts'

/** リサイズできる要素。画像も動画も「幅を変えて高さは比率維持」で同じ扱いにする。 */
export type ResizeTarget = HTMLImageElement | HTMLVideoElement

/** リサイズ中の状態 */
interface ResizeState {
  img: ResizeTarget
  startX: number
  startWidth: number
  /** 右側ハンドル = +1, 左側ハンドル = −1 */
  direction: 1 | -1
}

type Corner = 'nw' | 'ne' | 'sw' | 'se'

const CORNER_CURSORS: Readonly<Record<Corner, string>> = {
  nw: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  se: 'nwse-resize',
}

const CORNERS: readonly Corner[] = ['nw', 'ne', 'sw', 'se']

/** CSS を 1 回だけ注入 */
function injectResizeCss(): void {
  if (document.getElementById('sb-img-resize-css') !== null) return
  const s = document.createElement('style')
  s.id = 'sb-img-resize-css'
  s.textContent = `
    .sb-img-resize-wrap {
      position: absolute;
      border: 2px solid var(--sb-accent, #0091FF);
      pointer-events: none;
      z-index: 10;
      box-sizing: border-box;
    }
    .sb-img-resize-h {
      position: absolute;
      width: 12px;
      height: 12px;
      background: var(--sb-accent, #0091FF);
      border: 2px solid var(--sb-c-ffffff, #FFFFFF);
      border-radius: 50%;
      box-sizing: border-box;
      pointer-events: auto;
      z-index: 11;
    }
    .sb-img-resize-h-nw { top: -6px; left: -6px; cursor: nwse-resize; }
    .sb-img-resize-h-ne { top: -6px; right: -6px; cursor: nesw-resize; }
    .sb-img-resize-h-sw { bottom: -6px; left: -6px; cursor: nesw-resize; }
    .sb-img-resize-h-se { bottom: -6px; right: -6px; cursor: nwse-resize; }
    .sb-img-resize-badge {
      position: absolute;
      bottom: 8px;
      right: 8px;
      background: rgba(0,145,255,0.85);
      color: #FFFFFF;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 3px;
      pointer-events: none;
      white-space: nowrap;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
  `
  document.head.append(s)
}

/**
 * Quill エディタに画像リサイズ機能を追加する。
 * 画像をクリックするとリサイズ UI が出る。エディタ外をクリックすると消える。
 */
export function wireImageResize(quill: Quill): void {
  /** .ql-container（スクロールホスト。overlay の親） */
  const container = quill.container as HTMLElement
  /** .ql-editor（Quill 管理下の編集領域。画像はここに入る） */
  const root = quill.root

  let wrap: HTMLDivElement | null = null
  let activeImg: ResizeTarget | null = null
  let resizeState: ResizeState | null = null

  injectResizeCss()

  // ── ヘルパー ──────────────────────────────────────

  function removeOverlay(): void {
    wrap?.remove()
    wrap = null
    activeImg = null
  }

  /** wrap の位置・サイズを画像に合わせる */
  function reposition(): void {
    if (activeImg === null || wrap === null) return
    // Version 切替等で画像が DOM から消えた場合はクリーンアップ
    if (!activeImg.isConnected) {
      removeOverlay()
      return
    }
    const ir = activeImg.getBoundingClientRect()
    const cr = container.getBoundingClientRect()
    wrap.style.left = `${ir.left - cr.left + container.scrollLeft}px`
    wrap.style.top = `${ir.top - cr.top + container.scrollTop}px`
    wrap.style.width = `${ir.width}px`
    wrap.style.height = `${ir.height}px`
  }

  /** サイズバッジを現在の寸法で更新 */
  function updateBadge(): void {
    if (activeImg === null || wrap === null) return
    const badge = wrap.querySelector<HTMLElement>('[data-resize-badge]')
    if (badge === null) return
    const w = Math.round(activeImg.getBoundingClientRect().width)
    const h = Math.round(activeImg.getBoundingClientRect().height)
    badge.textContent = `${w} × ${h}`
  }

  // ── overlay 表示 ──────────────────────────────────

  function showOverlay(img: ResizeTarget): void {
    removeOverlay()
    activeImg = img
    // Quill core CSS で .ql-container は position:relative を持つが、
    // 採取 CSS のクラスが上書きしている可能性があるため明示的に設定する。
    container.style.position = 'relative'

    wrap = document.createElement('div')
    wrap.className = 'sb-img-resize-wrap'
    wrap.setAttribute('data-img-resize', 'true')

    // 四隅ハンドル
    for (const corner of CORNERS) {
      const h = document.createElement('div')
      h.className = `sb-img-resize-h sb-img-resize-h-${corner}`
      const isLeft = corner === 'nw' || corner === 'sw'
      h.addEventListener('mousedown', (e: MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        resizeState = {
          img,
          startX: e.clientX,
          startWidth: img.getBoundingClientRect().width,
          direction: isLeft ? -1 : 1,
        }
        document.body.style.cursor = CORNER_CURSORS[corner]
        document.body.style.userSelect = 'none'
      })
      wrap.append(h)
    }

    // サイズバッジ（「570 × 320」）
    const badge = document.createElement('div')
    badge.className = 'sb-img-resize-badge'
    badge.setAttribute('data-resize-badge', 'true')
    wrap.append(badge)

    // リンク設定・計測URLのアクションバーは画像だけ。
    // 動画の設定（ループ/自動再生/ミュート/複製）は右パネルに置いている
    // （動画の上に浮かせると本文に被って読めなくなるため）。
    if (img instanceof HTMLImageElement) attachImageActionBar(wrap, img, quill)

    container.append(wrap)
    reposition()
    updateBadge()
  }

  // ── イベントハンドラ ──────────────────────────────

  // エディタ内のクリック: 画像なら選択、それ以外なら解除
  root.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'IMG') {
      e.preventDefault()
      showOverlay(target as HTMLImageElement)
    } else if (target.tagName === 'VIDEO') {
      // 動画は preventDefault しない。再生/一時停止などの操作を邪魔しないため。
      showOverlay(target as HTMLVideoElement)
    } else if (wrap !== null) {
      removeOverlay()
    }
  })

  // ドラッグリサイズ（width のみ変更。height は auto で比率維持）
  // 画面全体への見張りは、画面を移ったら外す（前の編集画面をつかみ続けないように・page-life.ts）
  const life = pageLife()
  document.addEventListener('mousemove', (e: MouseEvent) => {
    if (resizeState === null) return
    const { img, startX, startWidth, direction } = resizeState
    const delta = (e.clientX - startX) * direction
    const newWidth = Math.max(30, Math.round(startWidth + delta))
    img.style.width = `${newWidth}px`
    img.style.height = 'auto'
    // 今の位置（左・中央・右）を保つ。以前は必ず真ん中の余白を付けていて、「配置」で寄せても動かなかった
    keepAlignOnResize(img)
    img.setAttribute('width', String(newWidth))
    img.removeAttribute('height')
    reposition()
    updateBadge()
  }, { signal: life })

  document.addEventListener('mouseup', () => {
    if (resizeState === null) return
    resizeState = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, { signal: life })

  // 選んだ画像・動画を Backspace / Delete で消す。Quill のキー操作（文字を消す）より先に受ける。
  // Widget の中の画像など、Quill の部品でないものは消さない（Widget は Widget編集で直す）
  root.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if (activeImg === null || !isMediaDeleteKey(e)) return
      const blot = quill.scroll.find(activeImg)
      if (blot === null) return
      e.preventDefault()
      e.stopPropagation()
      const index = quill.getIndex(blot)
      removeOverlay()
      quill.deleteText(index, 1, 'user')
      quill.setSelection(index, 0, 'silent')
    },
    true,
  )

  // エディタ外のクリックで選択解除
  document.addEventListener('mousedown', (e: MouseEvent) => {
    if (activeImg === null || wrap === null) return
    const target = e.target as Node
    // root 内（画像やテキスト）/ wrap 内（ハンドル）/ ポップオーバー内は解除しない
    if (!root.contains(target) && !wrap.contains(target)) {
      const popover = document.querySelector('[data-img-link-popover]')
      if (popover !== null && popover.contains(target)) return
      removeOverlay()
    }
  }, { signal: life })

  // スクロール追従（安全弁: absolute 配置なので通常は不要だが、edge case をカバー）
  container.addEventListener(
    'scroll',
    () => {
      if (activeImg !== null) reposition()
    },
    { passive: true },
  )
}

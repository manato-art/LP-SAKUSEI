/**
 * キャンバスに置いた動画の設定バー。
 *
 * 動画は挿入時に「常に再生（自動再生＋ループ＋ミュート）」で入る（指示⑬）。
 * ただし1回だけ見せたい動画もあるので、**ループ再生を後から切り替えられる**ようにする。
 *
 * 保存は DOM から直列化される（editor.ts の `serializeQuillBody`）ので、
 * `<video>` の属性を書き換えれば保存HTMLにそのまま入る。
 * 変更後に `quill.update()` を呼んで Quill 側にも知らせる（画像リンクと同じ手順）。
 */
import type Quill from 'quill'

const CSS_ID = 'sb-video-controls-css'

function injectCss(): void {
  if (document.getElementById(CSS_ID) !== null) return
  const s = document.createElement('style')
  s.id = CSS_ID
  s.textContent = `
    .sb-video-bar {
      position:absolute; z-index:60; display:flex; gap:6px; align-items:center;
      background:#1f2937; border-radius:8px; padding:5px 7px;
      box-shadow:0 3px 10px rgba(0,0,0,.24);
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,
        "Hiragino Sans","Hiragino Kaku Gothic ProN",sans-serif;
    }
    .sb-video-btn {
      display:inline-flex; align-items:center; gap:5px; border:1px solid #3d4655;
      background:#2b3443; color:#d7dce5; border-radius:6px; padding:5px 10px;
      font:inherit; font-size:11px; font-weight:600; cursor:pointer; white-space:nowrap;
    }
    .sb-video-btn:hover { background:#333d4e; }
    .sb-video-btn.on { background:#0091ff; border-color:#0091ff; color:#fff; }
    .sb-video-btn svg { flex-shrink:0; }
  `
  document.head.append(s)
}

/** ループを表すSVG（共通指示「UIは絵文字をやめSVGアイコンに」） */
const LOOP_ICON =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/>' +
  '<path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>'

/**
 * ループ切り替えが必要とする最小の形。`HTMLVideoElement` はこれを満たす。
 * こう切っておくと、DOMの無いテストからも切り替えの筋道を確かめられる
 * （このリポジトリは jsdom を入れない方針のため）。
 */
export interface LoopTarget {
  hasAttribute(name: string): boolean
  setAttribute(name: string, value: string): void
  removeAttribute(name: string): void
  loop: boolean
}

/** その動画がループ再生になっているか */
export function isLooping(video: LoopTarget): boolean {
  return video.hasAttribute('loop')
}

/**
 * ループのON/OFFを入れ替えて、切り替え後の状態を返す。
 * 属性と DOM プロパティの両方を触る（属性だけだと再生中の挙動が変わらない環境がある）。
 */
export function toggleLoop(video: LoopTarget): boolean {
  const next = !isLooping(video)
  if (next) video.setAttribute('loop', 'loop')
  else video.removeAttribute('loop')
  // eslint-disable-next-line no-param-reassign -- 対象要素の再生設定を変えるのがこの関数の責務
  video.loop = next
  return next
}

/**
 * 編集キャンバス内の `<video>` をクリックしたら設定バーを出す。
 * 画像のリサイズ枠（image-resize.ts）と同じく、クリックで出して外すだけの軽い作り。
 */
export function wireVideoControls(quill: Quill): void {
  injectCss()
  const container = quill.container as HTMLElement
  const root = quill.root

  let bar: HTMLDivElement | null = null
  let active: HTMLVideoElement | null = null

  const removeBar = (): void => {
    bar?.remove()
    bar = null
    active = null
  }

  const place = (): void => {
    if (bar === null || active === null) return
    const box = active.getBoundingClientRect()
    const host = container.getBoundingClientRect()
    bar.style.left = `${box.left - host.left + container.scrollLeft}px`
    // 動画の上に置く。上に余白が無ければ中へ入れる（画面外に出さない）
    const top = box.top - host.top + container.scrollTop
    bar.style.top = `${Math.max(2, top - 34)}px`
  }

  const showBar = (video: HTMLVideoElement): void => {
    removeBar()
    active = video
    bar = document.createElement('div')
    bar.className = 'sb-video-bar'

    const loopBtn = document.createElement('button')
    loopBtn.type = 'button'
    loopBtn.className = 'sb-video-btn'
    const paint = (on: boolean): void => {
      loopBtn.classList.toggle('on', on)
      loopBtn.innerHTML = `${LOOP_ICON}<span>ループ再生 ${on ? 'ON' : 'OFF'}</span>`
      loopBtn.title = on
        ? '繰り返し再生しています。押すと1回だけの再生に変わります。'
        : '1回だけ再生します。押すと繰り返し再生に変わります。'
    }
    paint(isLooping(video))
    loopBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      e.preventDefault()
      paint(toggleLoop(video))
      // Quill に変更を知らせる（保存はDOMから直列化されるので属性だけで足りる）
      quill.update()
    })

    bar.append(loopBtn)
    container.append(bar)
    place()
  }

  root.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'VIDEO') {
      // 再生/一時停止のクリックは邪魔しない。バーを出すだけ。
      showBar(target as HTMLVideoElement)
      return
    }
    if (bar !== null && !bar.contains(target)) removeBar()
  })

  container.addEventListener('scroll', place, { passive: true })
  window.addEventListener('resize', place)
}

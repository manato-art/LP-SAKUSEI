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
import { toast } from '../ui.ts'

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

/** アイコンは全てSVG（共通指示「UIは絵文字をやめSVGアイコンに」） */
const PLAY_ICON =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 4 13 8-13 8V4Z"/></svg>'
const MUTE_ICON =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 5 6M21 9l-5 6"/></svg>'
const SOUND_ICON =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M19 6a8 8 0 0 1 0 12"/></svg>'
const COPY_ICON =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>'

/** ループを表すSVG */
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
  autoplay: boolean
  muted: boolean
}

/** 切り替えられる再生設定 */
export type VideoFlag = 'loop' | 'autoplay' | 'muted'

/** その設定が入っているか */
export function hasFlag(video: LoopTarget, flag: VideoFlag): boolean {
  return video.hasAttribute(flag)
}

/**
 * 設定のON/OFFを入れ替えて、切り替え後の状態を返す。
 * 属性と DOM プロパティの両方を触る（属性だけだと再生中の挙動が変わらない環境がある）。
 */
export function toggleFlag(video: LoopTarget, flag: VideoFlag): boolean {
  const next = !hasFlag(video, flag)
  if (next) video.setAttribute(flag, flag)
  else video.removeAttribute(flag)
  // eslint-disable-next-line no-param-reassign -- 対象要素の再生設定を変えるのがこの関数の責務
  video[flag] = next
  return next
}

/** その動画がループ再生になっているか */
export function isLooping(video: LoopTarget): boolean {
  return hasFlag(video, 'loop')
}

/** ループのON/OFFを入れ替える */
export function toggleLoop(video: LoopTarget): boolean {
  return toggleFlag(video, 'loop')
}

/**
 * 音ありの自動再生はブラウザに止められる。
 * 「自動再生ONのままミュートを切った」ときだけ true を返し、呼び出し側が注意を出す。
 */
export function willBlockAutoplay(video: LoopTarget): boolean {
  return hasFlag(video, 'autoplay') && !hasFlag(video, 'muted')
}

/**
 * 動画をすぐ下に複製する。
 *
 * Quill の API ではなく DOM に直接差し込み、呼び出し側で `quill.update()` する。
 * `<video>` は sbvideo ブロットとして登録済みなので、Quill は差し込まれた要素を
 * 認識して自分の内容に取り込む（保存HTMLからの復元と同じ経路）。
 */
export function duplicateVideo(video: HTMLVideoElement): HTMLVideoElement {
  const copy = video.cloneNode(true) as HTMLVideoElement
  // クローンは属性しか引き継がないので、再生まわりのプロパティを揃え直す
  copy.loop = video.hasAttribute('loop')
  copy.autoplay = video.hasAttribute('autoplay')
  copy.muted = video.hasAttribute('muted')
  video.insertAdjacentElement('afterend', copy)
  return copy
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

    /** 再生設定のボタンを1つ作る */
    const flagBtn = (
      flag: VideoFlag,
      label: string,
      iconOn: string,
      iconOff: string,
      tip: (on: boolean) => string,
    ): HTMLButtonElement => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'sb-video-btn'
      const paint = (on: boolean): void => {
        btn.classList.toggle('on', on)
        btn.innerHTML = `${on ? iconOn : iconOff}<span>${label} ${on ? 'ON' : 'OFF'}</span>`
        btn.title = tip(on)
      }
      paint(hasFlag(video, flag))
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        e.preventDefault()
        paint(toggleFlag(video, flag))
        // 音ありの自動再生はブラウザが止める。黙って効かないままにしない。
        if (willBlockAutoplay(video)) {
          toast('音ありの自動再生はブラウザに止められます。ミュートを戻すか自動再生を切ってください', 'error')
        }
        // Quill に変更を知らせる（保存はDOMから直列化されるので属性だけで足りる）
        quill.update()
      })
      return btn
    }

    const loopBtn = flagBtn('loop', 'ループ再生', LOOP_ICON, LOOP_ICON, (on) =>
      on
        ? '繰り返し再生しています。押すと1回だけの再生に変わります。'
        : '1回だけ再生します。押すと繰り返し再生に変わります。',
    )
    const autoBtn = flagBtn('autoplay', '自動再生', PLAY_ICON, PLAY_ICON, (on) =>
      on
        ? '表示されたら自動で再生します。押すと手動再生に変わります。'
        : '見る人が再生ボタンを押すまで再生しません。',
    )
    const muteBtn = flagBtn('muted', 'ミュート', MUTE_ICON, SOUND_ICON, (on) =>
      on ? '音を出しません。押すと音が出るようになります。' : '音が出ます。自動再生と併用するとブラウザに止められます。',
    )

    const copyBtn = document.createElement('button')
    copyBtn.type = 'button'
    copyBtn.className = 'sb-video-btn'
    copyBtn.innerHTML = `${COPY_ICON}<span>複製</span>`
    copyBtn.title = 'この動画をすぐ下にもう1つ置きます（設定も引き継ぎます）'
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      e.preventDefault()
      duplicateVideo(video)
      quill.update()
      removeBar()
      toast('動画を複製しました')
    })

    bar.append(loopBtn, autoBtn, muteBtn, copyBtn)
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

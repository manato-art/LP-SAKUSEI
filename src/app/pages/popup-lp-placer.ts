/**
 * 「LPの上で決める」画面（指示39・2026-10-31 本人「ポップアップの表示位置なんだけど、実際にLPの中を自由に移動して決めたい。
 * ここまで読んだら表示とか、その際にここの位置に表示とか。実際のLPの中をさわりながら位置決めることができる感じ」
 * → 本人の選択「つまんで好きな位置（追従型と同じやり方）」「ここまで読んだら表示は離脱防止と追従型」）。
 *
 * スマホの大きさ（375×667）の LP を実際にスクロールし、「ここまで読んだら出す」を押すと、その時の読んだ割合を出すきっかけにする。
 * 同じ画面で、ポップアップをつまんで出す場所へ動かす（popup-free-drag.ts と同じ手）。「この内容で戻る」で編集中の形に入れる
 * （まだ配信には出ない。出すのは編集画面の「保存」＝本番に出るボタンは「保存」だけ・2026-10-31 案A）。
 * 読んだ割合は配信と同じ数え方（スクロールした量 ÷ スクロールできる量・delivery-popup-html.ts の scrolledPct）。
 * ポップアップの中身は、まわりと見た目が混ざらないよう shadow root に描く（スクリプトは動かさない＝見た目だけ）。
 */
import { el } from '../ui.ts'
import { attachFreeDrag } from '../panels/popup-free-drag.ts'
import { freeBoxPlace, type FreeKind, type FreePosition } from '../../shared/follow-free-place.ts'

/** LP の画面の大きさ（スマホ） */
const PHONE_W = 375
const PHONE_H = 667
/** 離脱防止・表示直後の箱の幅の上限（配信と同じ min(500px, 92vw)） */
const BOX_MAX = Math.min(500, Math.round(PHONE_W * 0.92))

/** 読んだ割合（0〜100 の整数）。LP が画面より短い（スクロールできない）ときは 100（配信もすぐ出す） */
export function scrollPctOf(scrollY: number, scrollHeight: number, viewHeight: number): number {
  const room = scrollHeight - viewHeight
  if (room <= 0) return 100
  return Math.min(100, Math.max(0, Math.round((scrollY / room) * 100)))
}

/** 割合から、その所までのスクロール量 */
export function scrollYForPct(pct: number, scrollHeight: number, viewHeight: number): number {
  return Math.max(0, Math.round((Math.max(0, scrollHeight - viewHeight) * pct) / 100))
}

const snap = (v: number): number => (v < 25 ? 0 : v > 75 ? 100 : 50)

/** 離脱防止・表示直後の、つまんで置く前の場所（9か所） */
export function gridPlaceOfExit(x: number, y: number): FreePosition {
  return { x: snap(x), y: snap(y) }
}

/** 追従型の、つまんで置く前の場所（表示位置） */
export function gridPlaceOfFollow(position: string): FreePosition {
  if (position === 'top') return { x: 50, y: 0 }
  if (position === 'bottom-right') return { x: 100, y: 100 }
  if (position === 'bottom-left') return { x: 0, y: 100 }
  return { x: 50, y: 100 }
}

export interface LpPlacerOptions {
  readonly title: string
  readonly lpUrl: Promise<string | null>
  readonly html: string
  readonly css: string
  /** 動き方（離脱防止・表示直後＝corner／追従型の帯＝bar／角＝corner） */
  readonly kind: FreeKind
  /** 離脱防止・表示直後の箱か（暗い幕・幅の上限） */
  readonly box: boolean
  /** いま置いてある場所（null＝つまんで置いていない） */
  readonly free: FreePosition | null
  /** つまんで置く前の場所（9か所・表示位置） */
  readonly grid: FreePosition
  /** 「ここまで読んだら出す」を使うか。使うなら、いま決めてある割合（null＝決めていない） */
  readonly scroll: { readonly pct: number | null } | null
  /**
   * 「この内容で戻る」を押したとき。place: undefined＝動かしていない／null＝元の位置（9か所）に戻した／値＝置いた場所。
   * scrollPct: undefined＝変えていない／値＝この割合まで読んだら出す
   */
  readonly onApply: (result: { readonly place: FreePosition | null | undefined; readonly scrollPct: number | undefined }) => void
}

export function openLpPlacer(options: LpPlacerOptions): void {
  const life = new AbortController()
  const overlay = el('div', {
    style:
      'position:fixed;inset:0;z-index:10000;background:rgba(17,24,39,.55);display:flex;align-items:center;justify-content:center;' +
      'padding:16px;box-sizing:border-box;font-family:"Hiragino Sans",sans-serif',
  })
  const panel = el('div', {
    style:
      'display:flex;gap:20px;align-items:stretch;background:#fff;border-radius:14px;padding:18px;max-width:100%;max-height:100%;' +
      'box-sizing:border-box;box-shadow:0 12px 40px rgba(0,0,0,.25);overflow:auto',
  })
  const close = (): void => {
    life.abort()
    overlay.remove()
  }

  // ── 左: スマホの大きさの LP（スクロールできる）＋ポップアップ ──
  const frame = el('div', {
    style: `position:relative;flex:0 0 auto;width:${PHONE_W}px;height:${PHONE_H}px;border:1px solid #D5D9E0;border-radius:18px;overflow:hidden;background:#fff`,
  })
  const lp = document.createElement('iframe')
  lp.title = 'LP'
  // LP の見え方に要るスクリプトは動かし、画面ごとの移動（top の書き換え）は止める（popup-underlay.ts と同じ）
  lp.setAttribute('sandbox', 'allow-scripts allow-same-origin')
  lp.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0'
  const dim = el('div', { style: 'position:absolute;inset:0;background:rgba(0,0,0,.4);pointer-events:none;z-index:1' })
  dim.hidden = !options.box
  const content = el('div', {
    style:
      `position:absolute;z-index:2;pointer-events:none;box-sizing:border-box;` +
      (options.kind === 'bar' ? 'width:100%' : `width:max-content;max-width:${options.box ? BOX_MAX : PHONE_W - 32}px;max-height:80%;overflow:hidden`),
  })
  const shadow = content.attachShadow({ mode: 'open' })
  // スクリプトは動かさない（innerHTML では動かない）。見た目だけ
  shadow.innerHTML = `<style>:host{display:block}${options.css}</style>${options.html}`
  frame.append(lp, dim, content)

  // ── 右: 説明と操作 ──
  const side = el('div', { style: 'display:flex;flex-direction:column;gap:14px;width:280px;font-size:13px;color:#1F2430' })
  side.append(el('h2', { text: options.title, style: 'margin:0;font-size:16px' }))
  const step = (text: string): HTMLElement => el('p', { text, style: 'margin:0;line-height:1.7;color:#3F4450' })

  let chosenPct: number | undefined
  if (options.scroll !== null) {
    side.append(step('① 左の LP をスクロールして、ポップアップを出したい所まで読み進めてください。'))
    const now = el('p', { style: 'margin:0;font-weight:700' })
    const set = el('p', { style: 'margin:0;color:#3F4450' })
    const paintSet = (): void => {
      const pct = chosenPct ?? options.scroll?.pct ?? null
      set.textContent = pct === null ? '出す所：まだ決めていません' : `出す所：LP の ${String(pct)}% まで読んだら出す`
    }
    paintSet()
    const here = el('button', { text: 'ここまで読んだら出す', class: 'ep-preset-add' })
    here.type = 'button'
    let current = 0
    const readNow = (): void => {
      const win = lp.contentWindow
      const doc = lp.contentDocument
      if (win === null || doc === null) return
      current = scrollPctOf(win.scrollY, doc.documentElement.scrollHeight, win.innerHeight)
      now.textContent = `今：LP の ${String(current)}% まで読んでいます`
    }
    here.addEventListener('click', () => {
      chosenPct = current
      paintSet()
    })
    lp.addEventListener('load', () => {
      const win = lp.contentWindow
      const doc = lp.contentDocument
      if (win === null || doc === null) return
      const start = options.scroll?.pct ?? null
      if (start !== null) win.scrollTo(0, scrollYForPct(start, doc.documentElement.scrollHeight, win.innerHeight))
      readNow()
      win.addEventListener('scroll', readNow, { signal: life.signal })
    })
    side.append(now, here, set)
  }
  side.append(
    step(
      `${options.scroll !== null ? '② ' : ''}ポップアップの横の「つまんで動かす」で、出す場所へ動かしてください（スマホと PC で同じ割合の場所に出ます）。` +
        'Ctrl（Mac は ⌘）を押しながら動かすと、真ん中の線が出てぴったり止まります。',
    ),
  )

  const showPopup = document.createElement('label')
  showPopup.style.cssText = 'display:inline-flex;align-items:center;gap:6px;cursor:pointer;color:#4B5563'
  const showBox = document.createElement('input')
  showBox.type = 'checkbox'
  showBox.checked = true
  showPopup.append(showBox, document.createTextNode('ポップアップを出して見る（外すと LP だけ見える）'))
  side.append(showPopup)

  const buttons = el('div', { style: 'display:flex;gap:8px;margin-top:auto' })
  const cancel = el('button', { text: 'やめる', class: 'ep-editor-btn-draft' })
  cancel.type = 'button'
  const apply = el('button', { text: 'この内容で戻る', class: 'ep-editor-btn-prod' })
  apply.type = 'button'
  buttons.append(cancel, apply)
  side.append(buttons)

  panel.append(frame, side)
  overlay.append(panel)
  document.body.append(overlay)

  // ── つまんで動かす（追従型と同じ手。置いていなければ9か所・表示位置の所） ──
  let place = options.free
  let touched = false
  const placeAt = (at: FreePosition): void => {
    const spot = freeBoxPlace(options.kind, { w: frame.clientWidth, h: frame.clientHeight }, { w: content.offsetWidth, h: content.offsetHeight }, at)
    content.style.position = 'absolute'
    content.style.left = `${spot.left}px`
    content.style.top = `${spot.top}px`
  }
  const drag = attachFreeDrag(
    frame,
    content,
    {
      kind: options.kind,
      get: () => place,
      set: (next) => {
        place = next
        touched = true
      },
    },
    () => placeAt(options.grid),
    life.signal,
  )
  drag.setShown(true)

  showBox.addEventListener('change', () => {
    content.style.visibility = showBox.checked ? '' : 'hidden'
    dim.hidden = !options.box || !showBox.checked
    drag.setShown(showBox.checked)
  })
  cancel.addEventListener('click', close)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })
  apply.addEventListener('click', () => {
    options.onApply({ place: touched ? place : undefined, scrollPct: chosenPct })
    close()
  })
  void options.lpUrl.then(
    (url) => {
      if (url !== null) lp.src = url
    },
    () => undefined,
  )
}

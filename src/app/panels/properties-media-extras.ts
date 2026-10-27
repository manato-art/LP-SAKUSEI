/**
 * 画像と動画の右の設定で共通の欄（2026-10-27 指示㉑ 本人「動画にもリンク入れたい」「画像でできること全部入れて」）。
 * リンク設定（行き先・開き方）・計測URL・アニメーション。もとは画像の設定（properties-image.ts）だけにあった。
 *
 * どの欄も「いま選んでいる画像・動画」に属性を書く（media-settings.ts の属性）。書き方は呼ぶ側が渡す:
 * 画像はそのまま書く・動画は書いたあと Quill に知らせて選び直す（properties-video.ts の withVideo）。
 */
import { ANIM_PRESETS, ANIM_SPEEDS } from '../anim/anim-presets.ts'
import { group, row } from './properties-parts.ts'
import { isTelHref, isTrackingLink, withTrackingParam } from '../../shared/link-html.ts'

export interface MediaExtrasDeps {
  /** いま選んでいる画像・動画 */
  readonly current: () => HTMLElement | null
  /** 画像・動画の属性を書き換える */
  readonly apply: (change: (el: HTMLElement) => void) => void
}

/** 欄と、選んだ画像・動画に表示を合わせる関数 */
export interface MediaSection {
  readonly el: HTMLElement
  readonly sync: (el: HTMLElement) => void
}

/** 計測の目印を付けられる行き先か（電話・ページ内の移動には付けない＝文字のリンクと同じ） */
const canTrack = (url: string): boolean => url !== '' && !isTelHref(url) && !url.startsWith('#')

/** 欄の URL とチェックから、画像・動画に付ける行き先 */
const mediaHref = (url: string, tracking: boolean): string => (canTrack(url) ? withTrackingParam(url, tracking) : url)

/**
 * リンク設定（行き先・計測リンクにする・開き方）。
 * 「計測リンクにする」（2026-10-27 指示⑳ 本人「計測のチェックを追加して・デフォルトはチェックなし」「一見、計測を変更できるかわからないので、
 * わかりやすいデザイン」）: 行全体を枠付きの押せる行にし、説明も添える。URL の欄には計測の目印を外したURLを出す
 */
export function buildMediaLinkGroup(deps: MediaExtrasDeps): MediaSection {
  const linkGroup = group('リンク設定')
  const linkUrlRow = row('URL')
  const linkUrlInput = document.createElement('input')
  linkUrlInput.className = 'sb-pr-input'
  linkUrlInput.placeholder = 'https://'
  const track = document.createElement('input')
  track.type = 'checkbox'
  track.setAttribute('data-media-link-track', '')
  const writeHref = (): void => {
    const url = linkUrlInput.value.trim()
    const tracking = track.checked
    deps.apply((el) => {
      if (url !== '') el.setAttribute('data-link-url', mediaHref(url, tracking))
      else el.removeAttribute('data-link-url')
    })
  }
  linkUrlInput.addEventListener('change', writeHref)
  linkUrlRow.append(linkUrlInput)

  // 計測リンクにする（行全体が押せる・枠と淡い地で「切り替えられる物」と分かるように）
  const trackRow = document.createElement('label')
  trackRow.style.cssText =
    'display:flex;align-items:flex-start;gap:8px;margin:2px 0 4px;padding:8px 10px;border:1px solid var(--sb-c-dddddd, #DDDDDD);' +
    'border-radius:6px;background:var(--sb-c-f5f6f8, #F5F6F8);cursor:pointer'
  track.style.cssText = 'width:16px;height:16px;margin:1px 0 0;flex-shrink:0;cursor:pointer;accent-color:var(--sb-accent, #0091FF)'
  const trackText = document.createElement('span')
  const trackTitle = document.createElement('span')
  trackTitle.textContent = '計測リンクにする'
  trackTitle.style.cssText = 'display:block;font-size:12px;font-weight:700;color:var(--sb-c-333333, #333333)'
  const trackNote = document.createElement('span')
  trackNote.textContent = '申し込みボタンなどは入れておきます。押された数が CLICK に入り、そのあとの申し込みが CV に結びつきます。'
  trackNote.style.cssText = 'display:block;margin-top:2px;font-size:10px;line-height:1.6;color:var(--sb-c-666666, #666666)'
  trackText.append(trackTitle, trackNote)
  trackRow.append(track, trackText)
  track.addEventListener('change', writeHref)

  const linkTargetRow = row('ターゲット')
  const linkTargetSelect = document.createElement('select')
  linkTargetSelect.className = 'sb-pr-select sb-link-target-select'
  for (const opt of [
    { value: '_blank', label: '新しいタブ (_blank)' },
    { value: '_self', label: '同じタブ (_self)' },
  ]) {
    const o = document.createElement('option')
    o.value = opt.value
    o.textContent = opt.label
    linkTargetSelect.append(o)
  }
  linkTargetSelect.addEventListener('change', () => {
    const target = linkTargetSelect.value
    deps.apply((el) => el.setAttribute('data-link-target', target))
  })
  linkTargetRow.append(linkTargetSelect)
  linkGroup.append(linkUrlRow, trackRow, linkTargetRow)

  return {
    el: linkGroup,
    sync: (el) => {
      const href = el.getAttribute('data-link-url') ?? ''
      // 新しいリンク（まだ行き先が無い）はチェックなしから
      track.checked = href !== '' && isTrackingLink(href, null)
      linkUrlInput.value = canTrack(href) ? withTrackingParam(href, false) : href
      linkTargetSelect.value = el.getAttribute('data-link-target') ?? '_blank'
    },
  }
}

/** 計測URL（押したときにリクエストを送る先・いくつでも） */
export function buildMediaTrackingGroup(deps: MediaExtrasDeps): MediaSection {
  const trackGroup = group('計測URL')
  const trackDesc = document.createElement('div')
  trackDesc.style.cssText = 'font-size:10px;color:#999999;line-height:1.5;margin-bottom:2px'
  trackDesc.textContent = 'クリック時にリクエストを送信するURL'

  const trackList = document.createElement('div')
  trackList.setAttribute('data-tracking-list', '')

  const trackAddBtn = document.createElement('button')
  trackAddBtn.type = 'button'
  trackAddBtn.style.cssText =
    'display:inline-flex;align-items:center;gap:4px;padding:4px 0;font-size:11px;' +
    'color:var(--sb-accent, #0091FF);background:none;border:none;cursor:pointer;font-family:inherit'
  trackAddBtn.textContent = '+ URLを追加'
  trackAddBtn.addEventListener('click', () => {
    if (deps.current() === null) return
    appendTrackingRow(trackList, deps, '')
    const inputs = trackList.querySelectorAll('input')
    const last = inputs[inputs.length - 1]
    if (last instanceof HTMLInputElement) last.focus()
  })

  trackGroup.append(trackDesc, trackList, trackAddBtn)
  return {
    el: trackGroup,
    sync: (el) => {
      trackList.innerHTML = ''
      for (const url of trackingUrlsOf(el)) appendTrackingRow(trackList, deps, url)
    },
  }
}

/** 計測URL（data-tracking-urls の JSON 配列。読めなければ無し） */
function trackingUrlsOf(el: HTMLElement): string[] {
  const raw = el.getAttribute('data-tracking-urls')
  if (raw === null || raw === '') return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === 'string' && u !== '') : []
  } catch {
    // 壊れた値は計測URL無しとして見せる（保存し直すと消える）
    return []
  }
}

/** 計測URLの欄の並びから data-tracking-urls を書く */
function syncTrackingUrls(list: HTMLElement, deps: MediaExtrasDeps): void {
  const urls: string[] = []
  for (const input of list.querySelectorAll<HTMLInputElement>('input[type="url"]')) {
    const v = input.value.trim()
    if (v !== '') urls.push(v)
  }
  deps.apply((el) => {
    if (urls.length === 0) el.removeAttribute('data-tracking-urls')
    else el.setAttribute('data-tracking-urls', JSON.stringify(urls))
  })
}

/** 計測URL入力行を1行追加 */
function appendTrackingRow(list: HTMLElement, deps: MediaExtrasDeps, value: string): void {
  const rowEl = document.createElement('div')
  rowEl.style.cssText = 'display:flex;align-items:center;gap:4px;margin-bottom:4px'

  const input = document.createElement('input')
  input.className = 'sb-pr-input'
  input.type = 'url'
  input.placeholder = 'https://tracking.example.com/'
  input.value = value
  input.style.cssText = 'flex:1;min-width:0'
  input.addEventListener('change', () => syncTrackingUrls(list, deps))

  const rmBtn = document.createElement('button')
  rmBtn.type = 'button'
  rmBtn.title = '削除'
  rmBtn.textContent = '✕'
  rmBtn.style.cssText =
    'flex-shrink:0;width:24px;height:24px;display:flex;align-items:center;' +
    'justify-content:center;border:none;background:none;color:#e5573f;' +
    'cursor:pointer;border-radius:4px;font-size:13px'
  rmBtn.addEventListener('mouseenter', () => {
    rmBtn.style.background = '#FEE'
  })
  rmBtn.addEventListener('mouseleave', () => {
    rmBtn.style.background = 'none'
  })
  rmBtn.addEventListener('click', () => {
    rowEl.remove()
    syncTrackingUrls(list, deps)
  })

  rowEl.append(input, rmBtn)
  list.append(rowEl)
}

/** アニメーション（CapCut風の入場エフェクト・種類・速さ・くり返し） */
export function buildMediaAnimGroup(deps: MediaExtrasDeps): MediaSection {
  const animGroup = group('アニメーション')
  const animGrid = document.createElement('div')
  animGrid.className = 'sb-pr-anim-grid'
  animGrid.setAttribute('data-img-anim-grid', 'true')
  const replay = (): void => {
    const el = deps.current()
    if (el === null || el.getAttribute('data-anim') === null) return
    el.classList.remove('sb-anim-run')
    void el.offsetWidth
    el.classList.add('sb-anim-run')
  }
  const speedSel = document.createElement('select')
  const loopChk = document.createElement('input')
  loopChk.type = 'checkbox'
  const setActive = (id: string): void => {
    for (const b of animGrid.querySelectorAll<HTMLElement>('.sb-pr-anim-btn')) {
      b.classList.toggle('active', b.getAttribute('data-anim-id') === id)
    }
  }
  const applyAnim = (id: string): void => {
    deps.apply((el) => {
      if (id === '') {
        el.removeAttribute('data-anim')
        el.removeAttribute('data-anim-speed')
        el.removeAttribute('data-anim-loop')
        el.classList.remove('sb-anim-run')
        return
      }
      el.setAttribute('data-anim', id)
      el.setAttribute('data-anim-speed', speedSel.value || 'normal')
      if (loopChk.checked) el.setAttribute('data-anim-loop', '1')
      else el.removeAttribute('data-anim-loop')
    })
    setActive(id)
    replay()
  }
  const mkBtn = (label: string, id: string): HTMLElement => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'sb-pr-anim-btn'
    b.setAttribute('data-anim-id', id)
    b.textContent = label
    b.title = label
    b.addEventListener('click', () => applyAnim(id))
    return b
  }
  animGrid.append(mkBtn('なし', ''))
  for (const p of ANIM_PRESETS) animGrid.append(mkBtn(p.label, p.id))
  animGroup.append(animGrid)

  const animCtl = document.createElement('div')
  animCtl.className = 'sb-pr-anim-ctl'
  speedSel.className = 'sb-pr-select'
  speedSel.style.flex = '1'
  for (const s of ANIM_SPEEDS) {
    const o = document.createElement('option')
    o.value = s.id
    o.textContent = `速度: ${s.label}`
    if (s.id === 'normal') o.selected = true
    speedSel.append(o)
  }
  speedSel.addEventListener('change', () => {
    const speed = speedSel.value
    deps.apply((el) => {
      if (el.getAttribute('data-anim') !== null) el.setAttribute('data-anim-speed', speed)
    })
    replay()
  })
  const replayBtn = document.createElement('button')
  replayBtn.type = 'button'
  replayBtn.className = 'sb-pr-anim-replay'
  replayBtn.textContent = '▶ プレビュー'
  replayBtn.addEventListener('click', replay)
  animCtl.append(speedSel, replayBtn)
  animGroup.append(animCtl)

  // ループ設定（くり返し再生）
  const loopRow = document.createElement('label')
  loopRow.className = 'sb-pr-anim-loop'
  const loopTxt = document.createElement('span')
  loopTxt.textContent = 'ループ再生（くり返す）'
  loopRow.append(loopChk, loopTxt)
  loopChk.addEventListener('change', () => {
    const on = loopChk.checked
    deps.apply((el) => {
      if (el.getAttribute('data-anim') === null) return
      if (on) el.setAttribute('data-anim-loop', '1')
      else el.removeAttribute('data-anim-loop')
    })
    replay()
  })
  animGroup.append(loopRow)

  return {
    el: animGroup,
    sync: (el) => {
      setActive(el.getAttribute('data-anim') ?? '')
      speedSel.value = el.getAttribute('data-anim-speed') ?? 'normal'
      loopChk.checked = el.getAttribute('data-anim-loop') === '1'
    },
  }
}

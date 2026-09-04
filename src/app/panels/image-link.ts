/**
 * 画像のリンク設定（遷移先URL + 計測用URL）。
 *
 * 画像をクリックしてリサイズオーバーレイが出ている間、
 * オーバーレイ下部にアクションバーを表示する:
 *   - 「リンク設定」→ 遷移先URLを入力するポップオーバー
 *   - 「計測URL」→ 計測用URL（複数）を管理するポップオーバー
 *
 * データの保存先:
 *   - 遷移先URL → img の `data-link-url` 属性
 *   - 新しいタブで開く → img の `data-link-target` 属性（`_blank` or `_self`）
 *   - 計測URL → img の `data-tracking-urls` 属性（JSON配列）
 *
 * 配信ページ（delivery.ts）では、これらの属性を読んで
 * `<a>` タグでラップ＋計測ピクセル発火に変換する。
 */
import type Quill from 'quill'
import { T, el, toast } from '../ui.ts'

// ── CSS 注入（1回だけ） ─────────────────────────────────

function injectCss(): void {
  if (document.getElementById('sb-img-link-css') !== null) return
  const s = document.createElement('style')
  s.id = 'sb-img-link-css'
  s.textContent = `
    .sb-img-action-bar {
      position: absolute;
      display: flex;
      gap: 4px;
      z-index: 12;
      pointer-events: auto;
      left: 50%;
      transform: translateX(-50%);
    }
    .sb-img-action-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      font-size: 11px;
      font-family: ${T.font};
      color: #fff;
      background: rgba(0,0,0,0.7);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      white-space: nowrap;
      line-height: 1.4;
    }
    .sb-img-action-btn:hover {
      background: rgba(0,0,0,0.85);
    }
    .sb-img-action-btn svg {
      width: 12px;
      height: 12px;
      flex-shrink: 0;
    }
    .sb-img-action-btn.has-value {
      background: rgba(0,145,255,0.85);
    }
    .sb-img-link-popover {
      position: fixed;
      z-index: 1300;
      background: ${T.surface};
      border: 1px solid #DDD;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      padding: 16px;
      min-width: 340px;
      max-width: 420px;
      font-family: ${T.font};
      font-size: 13px;
    }
    .sb-img-link-popover h4 {
      margin: 0 0 12px;
      font-size: 14px;
      font-weight: 600;
      color: ${T.text};
    }
    .sb-img-link-popover label {
      display: block;
      margin-bottom: 4px;
      font-size: 12px;
      color: #666;
    }
    .sb-img-link-popover input[type="url"],
    .sb-img-link-popover input[type="text"] {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      font-size: 13px;
      font-family: ${T.font};
      box-sizing: border-box;
      outline: none;
    }
    .sb-img-link-popover input:focus {
      border-color: ${T.primary};
    }
    .sb-img-link-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
    }
    .sb-img-link-row input {
      flex: 1;
      min-width: 0;
    }
    .sb-img-link-remove-btn {
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: none;
      color: #E5573F;
      cursor: pointer;
      border-radius: 4px;
      font-size: 16px;
    }
    .sb-img-link-remove-btn:hover {
      background: #FEE;
    }
    .sb-img-link-add-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 0;
      font-size: 12px;
      color: ${T.primary};
      background: none;
      border: none;
      cursor: pointer;
      font-family: ${T.font};
    }
    .sb-img-link-add-btn:hover {
      text-decoration: underline;
    }
    .sb-img-link-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
    }
  `
  document.head.append(s)
}

// ── SVG アイコン ────────────────────────────────────────

const LINK_ICON = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.5 9.5l3-3M7 4l.5-.5a3.536 3.536 0 015 5L12 9M9 12l-.5.5a3.536 3.536 0 01-5-5L4 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const TRACK_ICON = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/></svg>`

// ── アクションバー（リサイズオーバーレイの下に表示） ────

/**
 * リサイズオーバーレイ（wrap）にアクションバーを追加する。
 * 呼び出し元（image-resize.ts の showOverlay）が overlay を作った直後に呼ぶ。
 */
export function attachImageActionBar(wrap: HTMLDivElement, img: HTMLImageElement, quill: Quill): void {
  injectCss()

  const bar = document.createElement('div')
  bar.className = 'sb-img-action-bar'
  bar.style.bottom = '-28px'

  // ── リンク設定ボタン ──
  const linkBtn = document.createElement('button')
  linkBtn.type = 'button'
  linkBtn.className = 'sb-img-action-btn'
  const hasLink = (img.getAttribute('data-link-url') ?? '') !== ''
  if (hasLink) linkBtn.classList.add('has-value')
  linkBtn.innerHTML = `${LINK_ICON} リンク`
  linkBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    openLinkPopover(linkBtn, img, quill, () => {
      // 値変更後にボタンの色を更新
      const hasVal = (img.getAttribute('data-link-url') ?? '') !== ''
      linkBtn.classList.toggle('has-value', hasVal)
    })
  })

  // ── 計測URLボタン ──
  const trackBtn = document.createElement('button')
  trackBtn.type = 'button'
  trackBtn.className = 'sb-img-action-btn'
  const trackUrls = readTrackingUrls(img)
  if (trackUrls.length > 0) trackBtn.classList.add('has-value')
  trackBtn.innerHTML = `${TRACK_ICON} 計測${trackUrls.length > 0 ? ` (${trackUrls.length})` : ''}`
  trackBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    openTrackingPopover(trackBtn, img, quill, () => {
      const urls = readTrackingUrls(img)
      trackBtn.classList.toggle('has-value', urls.length > 0)
      trackBtn.innerHTML = `${TRACK_ICON} 計測${urls.length > 0 ? ` (${urls.length})` : ''}`
    })
  })

  bar.append(linkBtn, trackBtn)
  wrap.append(bar)
}

// ── データの読み書き ────────────────────────────────────

function readTrackingUrls(img: HTMLImageElement): string[] {
  const raw = img.getAttribute('data-tracking-urls')
  if (raw === null || raw === '') return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter((u): u is string => typeof u === 'string' && u !== '')
  } catch { /* invalid JSON → empty */ }
  return []
}

function writeTrackingUrls(img: HTMLImageElement, urls: readonly string[]): void {
  const clean = urls.filter((u) => u.trim() !== '')
  if (clean.length === 0) {
    img.removeAttribute('data-tracking-urls')
  } else {
    img.setAttribute('data-tracking-urls', JSON.stringify(clean))
  }
}

// ── ポップオーバーの配置計算 ─────────────────────────────

function positionPopover(popover: HTMLElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect()
  const popH = popover.offsetHeight
  const popW = popover.offsetWidth

  // 基本: ボタンの下に表示
  let top = rect.bottom + 6
  let left = rect.left + rect.width / 2 - popW / 2

  // 画面下にはみ出す場合は上に
  if (top + popH > window.innerHeight - 8) {
    top = rect.top - popH - 6
  }
  // 左右のはみ出し補正
  if (left < 8) left = 8
  if (left + popW > window.innerWidth - 8) left = window.innerWidth - 8 - popW

  popover.style.top = `${top}px`
  popover.style.left = `${left}px`
}

// ── リンク設定ポップオーバー ─────────────────────────────

function openLinkPopover(anchor: HTMLElement, img: HTMLImageElement, quill: Quill, onChange: () => void): void {
  closeAllPopovers()

  const currentUrl = img.getAttribute('data-link-url') ?? ''
  const currentTarget = img.getAttribute('data-link-target') ?? '_blank'

  const popover = document.createElement('div')
  popover.className = 'sb-img-link-popover'
  popover.setAttribute('data-img-link-popover', '')

  const title = el('h4', { text: '遷移先URL' })

  const urlLabel = el('label', { text: 'URL' })
  const urlInput = document.createElement('input')
  urlInput.type = 'url'
  urlInput.placeholder = 'https://example.com/lp'
  urlInput.value = currentUrl
  urlInput.style.marginBottom = '12px'

  const targetWrap = el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:4px' })
  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.id = 'sb-link-new-tab'
  checkbox.checked = currentTarget === '_blank'
  const checkLabel = el('label', { text: '新しいタブで開く', style: 'margin:0;cursor:pointer' })
  checkLabel.setAttribute('for', 'sb-link-new-tab')
  targetWrap.append(checkbox, checkLabel)

  const footer = el('div', { class: 'sb-img-link-footer' })

  // 解除ボタン（リンクが設定されている場合のみ）
  if (currentUrl !== '') {
    const removeBtn = el('button', {
      text: 'リンク解除',
      style: `padding:7px 14px;border:1px solid #E5573F;border-radius:6px;background:#fff;color:#E5573F;font-size:13px;cursor:pointer;font-family:${T.font}`,
    })
    removeBtn.type = 'button'
    removeBtn.addEventListener('click', () => {
      img.removeAttribute('data-link-url')
      img.removeAttribute('data-link-target')
      quill.update()
      onChange()
      closeAllPopovers()
      toast('リンクを解除しました')
    })
    footer.append(removeBtn)
  }

  const saveBtn = el('button', {
    text: '設定',
    style: `padding:7px 18px;border:none;border-radius:6px;background:${T.primary};color:#fff;font-size:13px;cursor:pointer;font-family:${T.font}`,
  })
  saveBtn.type = 'button'
  saveBtn.addEventListener('click', () => {
    const url = urlInput.value.trim()
    if (url !== '' && !isValidUrl(url)) {
      toast('正しいURLを入力してください', 'error')
      return
    }
    if (url === '') {
      img.removeAttribute('data-link-url')
      img.removeAttribute('data-link-target')
    } else {
      img.setAttribute('data-link-url', url)
      img.setAttribute('data-link-target', checkbox.checked ? '_blank' : '_self')
    }
    quill.update()
    onChange()
    closeAllPopovers()
    if (url !== '') toast('リンクを設定しました')
  })
  footer.append(saveBtn)

  popover.append(title, urlLabel, urlInput, targetWrap, footer)
  document.body.append(popover)
  positionPopover(popover, anchor)
  urlInput.focus()

  // 外側クリックで閉じる
  requestAnimationFrame(() => {
    document.addEventListener('mousedown', handleOutsideClick)
  })
}

// ── 計測URLポップオーバー ────────────────────────────────

function openTrackingPopover(anchor: HTMLElement, img: HTMLImageElement, quill: Quill, onChange: () => void): void {
  closeAllPopovers()

  const urls = readTrackingUrls(img)
  // 最低1行は空で表示
  if (urls.length === 0) urls.push('')

  const popover = document.createElement('div')
  popover.className = 'sb-img-link-popover'
  popover.setAttribute('data-img-link-popover', '')

  const title = el('h4', { text: '計測用URL' })
  const desc = el('div', {
    text: 'クリック時にリクエストを送信するURLを設定します。',
    style: 'font-size:11px;color:#888;margin-bottom:12px;line-height:1.5',
  })

  const listWrap = document.createElement('div')
  listWrap.setAttribute('data-tracking-list', '')

  function renderRows(): void {
    listWrap.innerHTML = ''
    for (let i = 0; i < urls.length; i++) {
      const row = el('div', { class: 'sb-img-link-row' })
      const input = document.createElement('input')
      input.type = 'url'
      input.placeholder = `https://tracking.example.com/pixel?id=${i + 1}`
      input.value = urls[i] ?? ''
      input.addEventListener('input', () => {
        urls[i] = input.value
      })

      const removeBtn = document.createElement('button')
      removeBtn.type = 'button'
      removeBtn.className = 'sb-img-link-remove-btn'
      removeBtn.textContent = '✕'
      removeBtn.title = '削除'
      removeBtn.addEventListener('click', () => {
        urls.splice(i, 1)
        if (urls.length === 0) urls.push('')
        renderRows()
      })

      row.append(input, removeBtn)
      listWrap.append(row)
    }
  }
  renderRows()

  const addBtn = document.createElement('button')
  addBtn.type = 'button'
  addBtn.className = 'sb-img-link-add-btn'
  addBtn.textContent = '+ URLを追加'
  addBtn.addEventListener('click', () => {
    urls.push('')
    renderRows()
    // 最後の input にフォーカス
    const inputs = listWrap.querySelectorAll('input')
    const last = inputs[inputs.length - 1]
    if (last instanceof HTMLInputElement) last.focus()
  })

  const footer = el('div', { class: 'sb-img-link-footer' })
  const saveBtn = el('button', {
    text: '設定',
    style: `padding:7px 18px;border:none;border-radius:6px;background:${T.primary};color:#fff;font-size:13px;cursor:pointer;font-family:${T.font}`,
  })
  saveBtn.type = 'button'
  saveBtn.addEventListener('click', () => {
    const valid = urls.filter((u) => u.trim() !== '')
    for (const u of valid) {
      if (!isValidUrl(u)) {
        toast('正しいURLを入力してください', 'error')
        return
      }
    }
    writeTrackingUrls(img, valid)
    quill.update()
    onChange()
    closeAllPopovers()
    if (valid.length > 0) toast(`計測URL ${valid.length}件を設定しました`)
  })
  footer.append(saveBtn)

  popover.append(title, desc, listWrap, addBtn, footer)
  document.body.append(popover)
  positionPopover(popover, anchor)

  requestAnimationFrame(() => {
    document.addEventListener('mousedown', handleOutsideClick)
  })
}

// ── 共通ユーティリティ ──────────────────────────────────

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function handleOutsideClick(e: MouseEvent): void {
  const target = e.target as Node
  const popover = document.querySelector('[data-img-link-popover]')
  if (popover !== null && !popover.contains(target)) {
    closeAllPopovers()
  }
}

function closeAllPopovers(): void {
  for (const p of document.querySelectorAll('[data-img-link-popover]')) p.remove()
  document.removeEventListener('mousedown', handleOutsideClick)
}

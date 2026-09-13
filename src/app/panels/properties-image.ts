/**
 * 画像を選んだときの右プロパティパネル（properties-panel.ts から分離・指示101）。
 *
 * 幅・配置・リンク・計測タグの付け外しなど、画像1枚ぶんの設定を受け持つ。
 */
import type Quill from 'quill'
import { ANIM_PRESETS, ANIM_SPEEDS } from '../anim/anim-presets.ts'
import { group, row } from './properties-parts.ts'

const IMG_SVG = {
  replace: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
  remove: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
}
export function buildImageBody(
  quill: Quill,
  getImg: () => HTMLImageElement | null,
  setImg: (img: HTMLImageElement | null) => void,
): HTMLElement {
  const container = document.createElement('div')
  container.className = 'sb-props-body'
  container.style.display = 'none'
  container.setAttribute('data-image-body', 'true')

  // ── サムネイルプレビュー ──
  const previewGroup = group('プレビュー')
  const previewBox = document.createElement('div')
  previewBox.style.cssText =
    'width:100%;max-height:140px;border:1px solid var(--sb-c-e5e5ea, #E5E5EA);border-radius:4px;overflow:hidden;background:var(--sb-c-f5f6f8, #F5F6F8);display:flex;align-items:center;justify-content:center'
  const previewImg = document.createElement('img')
  previewImg.style.cssText = 'max-width:100%;max-height:136px;object-fit:contain'
  previewBox.append(previewImg)
  previewGroup.append(previewBox)

  // ── 画像ソース ──
  const srcRow = row('ソース')
  const srcField = document.createElement('div')
  srcField.className = 'sb-url-field'
  srcField.style.cssText = 'flex:1;font-size:10px;color:#999999;cursor:default;height:26px;line-height:26px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:1px solid var(--sb-c-e5e5ea, #E5E5EA);border-radius:4px;padding:0 6px;background:var(--sb-c-f5f6f8, #F5F6F8)'
  srcRow.append(srcField)

  // ── alt テキスト ──
  const altRow = row('alt')
  const altInput = document.createElement('input')
  altInput.className = 'sb-pr-input'
  altInput.placeholder = '代替テキスト'
  altInput.addEventListener('change', () => {
    const img = getImg()
    if (img !== null) img.alt = altInput.value
  })
  altRow.append(altInput)

  // ── 幅 × 高さ ──
  const sizeGroup = group('サイズ')
  const sizeGrid = document.createElement('div')
  sizeGrid.style.cssText = 'display:grid;grid-template-columns:auto 1fr auto auto 1fr auto;gap:3px;align-items:center'

  const wLabel = document.createElement('span')
  wLabel.className = 'sb-pr-size-label'
  wLabel.textContent = 'W'
  const wInput = document.createElement('input')
  wInput.className = 'sb-pr-size-input'
  wInput.type = 'number'
  wInput.min = '1'
  const wUnit = document.createElement('span')
  wUnit.className = 'sb-pr-size-unit'
  wUnit.textContent = 'px'

  const hLabel = document.createElement('span')
  hLabel.className = 'sb-pr-size-label'
  hLabel.textContent = 'H'
  const hInput = document.createElement('input')
  hInput.className = 'sb-pr-size-input'
  hInput.type = 'number'
  hInput.min = '1'
  const hUnit = document.createElement('span')
  hUnit.className = 'sb-pr-size-unit'
  hUnit.textContent = 'px'

  wInput.addEventListener('change', () => {
    const img = getImg()
    if (img === null) return
    const w = parseInt(wInput.value, 10)
    if (Number.isNaN(w) || w < 1) return
    img.style.width = `${w}px`
  })
  hInput.addEventListener('change', () => {
    const img = getImg()
    if (img === null) return
    const h = parseInt(hInput.value, 10)
    if (Number.isNaN(h) || h < 1) return
    img.style.height = `${h}px`
  })

  sizeGrid.append(wLabel, wInput, wUnit, hLabel, hInput, hUnit)
  sizeGroup.append(sizeGrid)

  // ── リンク設定 ──
  const linkGroup = group('リンク設定')
  const linkUrlRow = row('URL')
  const linkUrlInput = document.createElement('input')
  linkUrlInput.className = 'sb-pr-input'
  linkUrlInput.placeholder = 'https://'
  linkUrlInput.addEventListener('change', () => {
    const img = getImg()
    if (img === null) return
    if (linkUrlInput.value.trim() !== '') {
      img.setAttribute('data-link-url', linkUrlInput.value.trim())
    } else {
      img.removeAttribute('data-link-url')
    }
  })
  linkUrlRow.append(linkUrlInput)

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
    const img = getImg()
    if (img !== null) img.setAttribute('data-link-target', linkTargetSelect.value)
  })
  linkTargetRow.append(linkTargetSelect)
  linkGroup.append(linkUrlRow, linkTargetRow)

  // ── 計測URL ──
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
    const img = getImg()
    if (img === null) return
    appendTrackingRow(trackList, img, '')
    const inputs = trackList.querySelectorAll('input')
    const last = inputs[inputs.length - 1]
    if (last instanceof HTMLInputElement) last.focus()
  })

  trackGroup.append(trackDesc, trackList, trackAddBtn)

  // ── アクション ──
  const actGroup = group('アクション')
  actGroup.style.gap = '6px'
  actGroup.style.marginTop = '2px'

  const replaceBtn = document.createElement('button')
  replaceBtn.type = 'button'
  replaceBtn.className = 'sb-pr-action'
  replaceBtn.innerHTML = `${IMG_SVG.replace}画像を差し替え`
  replaceBtn.addEventListener('click', () => {
    const img = getImg()
    if (img === null) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.style.display = 'none'
    document.body.append(input)
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      input.remove()
      if (file === undefined) return
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          img.src = reader.result
          previewImg.src = reader.result
        }
      }
      reader.readAsDataURL(file)
    })
    input.click()
  })

  const removeBtn = document.createElement('button')
  removeBtn.type = 'button'
  removeBtn.className = 'sb-pr-action danger'
  removeBtn.innerHTML = `${IMG_SVG.remove}画像を削除`
  removeBtn.addEventListener('click', () => {
    const img = getImg()
    if (img === null) return
    // Quill の Blot として削除（DOM直接削除だと Quill のデルタと不整合になる）
    const blot = quill.scroll.find(img)
    if (blot !== null) {
      const index = quill.getIndex(blot)
      quill.deleteText(index, 1, 'user')
    } else {
      img.remove()
    }
    setImg(null)
    container.style.display = 'none'
  })

  actGroup.append(replaceBtn, removeBtn)

  // ── 組み立て ──
  // ── アニメーション（画像用・CapCut風の入場エフェクト） ──
  const animGroup = group('アニメーション')
  const animGrid = document.createElement('div')
  animGrid.className = 'sb-pr-anim-grid'
  animGrid.setAttribute('data-img-anim-grid', 'true')
  const replayImgAnim = (): void => {
    const img = getImg()
    if (img === null || img.getAttribute('data-anim') === null) return
    img.classList.remove('sb-anim-run')
    void img.offsetWidth
    img.classList.add('sb-anim-run')
  }
  const speedSelImg = document.createElement('select')
  const setActiveImg = (id: string): void => {
    for (const b of animGrid.querySelectorAll<HTMLElement>('.sb-pr-anim-btn')) {
      b.classList.toggle('active', b.getAttribute('data-anim-id') === id)
    }
  }
  const applyImgAnim = (id: string): void => {
    const img = getImg()
    if (img === null) return
    if (id === '') {
      img.removeAttribute('data-anim')
      img.removeAttribute('data-anim-speed')
      img.removeAttribute('data-anim-loop')
      img.classList.remove('sb-anim-run')
      setActiveImg('')
      return
    }
    img.setAttribute('data-anim', id)
    img.setAttribute('data-anim-speed', speedSelImg.value || 'normal')
    if (loopChkImg.checked) img.setAttribute('data-anim-loop', '1')
    else img.removeAttribute('data-anim-loop')
    setActiveImg(id)
    replayImgAnim()
  }
  const loopChkImg = document.createElement('input')
  loopChkImg.type = 'checkbox'
  const mkImgAnimBtn = (label: string, id: string): HTMLElement => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'sb-pr-anim-btn'
    b.setAttribute('data-anim-id', id)
    b.textContent = label
    b.title = label
    b.addEventListener('click', () => applyImgAnim(id))
    return b
  }
  animGrid.append(mkImgAnimBtn('なし', ''))
  for (const p of ANIM_PRESETS) animGrid.append(mkImgAnimBtn(p.label, p.id))
  animGroup.append(animGrid)
  const animCtl = document.createElement('div')
  animCtl.className = 'sb-pr-anim-ctl'
  speedSelImg.className = 'sb-pr-select'
  speedSelImg.style.flex = '1'
  for (const s of ANIM_SPEEDS) {
    const o = document.createElement('option')
    o.value = s.id
    o.textContent = `速度: ${s.label}`
    if (s.id === 'normal') o.selected = true
    speedSelImg.append(o)
  }
  speedSelImg.addEventListener('change', () => {
    const img = getImg()
    if (img !== null && img.getAttribute('data-anim') !== null) {
      img.setAttribute('data-anim-speed', speedSelImg.value)
      replayImgAnim()
    }
  })
  const replayBtnImg = document.createElement('button')
  replayBtnImg.type = 'button'
  replayBtnImg.className = 'sb-pr-anim-replay'
  replayBtnImg.textContent = '▶ プレビュー'
  replayBtnImg.addEventListener('click', replayImgAnim)
  animCtl.append(speedSelImg, replayBtnImg)
  animGroup.append(animCtl)

  // ループ設定（くり返し再生）
  const loopRowImg = document.createElement('label')
  loopRowImg.className = 'sb-pr-anim-loop'
  const loopTxtImg = document.createElement('span')
  loopTxtImg.textContent = 'ループ再生（くり返す）'
  loopRowImg.append(loopChkImg, loopTxtImg)
  loopChkImg.addEventListener('change', () => {
    const img = getImg()
    if (img === null || img.getAttribute('data-anim') === null) return
    if (loopChkImg.checked) img.setAttribute('data-anim-loop', '1')
    else img.removeAttribute('data-anim-loop')
    replayImgAnim()
  })
  animGroup.append(loopRowImg)

  container.append(previewGroup, srcRow, altRow, sizeGroup, animGroup, linkGroup, trackGroup, actGroup)

  // データ属性で内部要素への参照を保持（refreshImageBody で使う）
  container.dataset['ready'] = 'true'

  return container
}
/** 画像プロパティを最新の画像状態で更新 */
export function refreshImageBody(container: HTMLElement, img: HTMLImageElement): void {
  const previewImg = container.querySelector<HTMLImageElement>('.sb-pg img')
  if (previewImg !== null) previewImg.src = img.src

  const srcField = container.querySelector<HTMLElement>('.sb-url-field')
  if (srcField !== null) {
    const src = img.src
    srcField.textContent = src.startsWith('data:') ? `(データURL・${Math.round(src.length / 1024)}KB)` : src
    srcField.title = src.startsWith('data:') ? 'Base64エンコード画像' : src
  }

  const altInput = container.querySelector<HTMLInputElement>('input[placeholder="代替テキスト"]')
  if (altInput !== null) altInput.value = img.alt

  const sizeInputs = container.querySelectorAll<HTMLInputElement>('.sb-pr-size-input')
  if (sizeInputs[0] !== undefined) sizeInputs[0].value = String(img.naturalWidth || img.width)
  if (sizeInputs[1] !== undefined) sizeInputs[1].value = String(img.naturalHeight || img.height)

  const linkInput = container.querySelector<HTMLInputElement>('input[placeholder="https://"]')
  if (linkInput !== null) linkInput.value = img.getAttribute('data-link-url') ?? ''

  const targetSelect = container.querySelector<HTMLSelectElement>('.sb-link-target-select')
  if (targetSelect !== null) targetSelect.value = img.getAttribute('data-link-target') ?? '_blank'

  // アニメーション同期（現在の画像の data-anim / data-anim-speed をUIへ反映）
  const curAnim = img.getAttribute('data-anim') ?? ''
  for (const b of container.querySelectorAll<HTMLElement>('[data-img-anim-grid] .sb-pr-anim-btn')) {
    b.classList.toggle('active', b.getAttribute('data-anim-id') === curAnim)
  }
  const animSpeedSel = container.querySelector<HTMLSelectElement>('.sb-pr-anim-ctl select')
  if (animSpeedSel !== null) animSpeedSel.value = img.getAttribute('data-anim-speed') ?? 'normal'
  const animLoopChk = container.querySelector<HTMLInputElement>('.sb-pr-anim-loop input[type="checkbox"]')
  if (animLoopChk !== null) animLoopChk.checked = img.getAttribute('data-anim-loop') === '1'

  // 計測URL
  const trackList = container.querySelector<HTMLElement>('[data-tracking-list]')
  if (trackList !== null) {
    trackList.innerHTML = ''
    const raw = img.getAttribute('data-tracking-urls')
    if (raw !== null && raw !== '') {
      try {
        const parsed: unknown = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          const urls = parsed.filter((u): u is string => typeof u === 'string' && u !== '')
          for (const url of urls) {
            appendTrackingRow(trackList, img, url)
          }
        }
      } catch { /* invalid JSON → skip */ }
    }
  }
}
/** 計測URLリストから img の data-tracking-urls 属性を同期 */
function syncTrackingUrls(list: HTMLElement, img: HTMLImageElement): void {
  const urls: string[] = []
  for (const input of list.querySelectorAll<HTMLInputElement>('input[type="url"]')) {
    const v = input.value.trim()
    if (v !== '') urls.push(v)
  }
  if (urls.length === 0) {
    img.removeAttribute('data-tracking-urls')
  } else {
    img.setAttribute('data-tracking-urls', JSON.stringify(urls))
  }
}
/** 計測URL入力行を1行追加 */
function appendTrackingRow(list: HTMLElement, img: HTMLImageElement, value: string): void {
  const rowEl = document.createElement('div')
  rowEl.style.cssText = 'display:flex;align-items:center;gap:4px;margin-bottom:4px'

  const input = document.createElement('input')
  input.className = 'sb-pr-input'
  input.type = 'url'
  input.placeholder = 'https://tracking.example.com/'
  input.value = value
  input.style.cssText = 'flex:1;min-width:0'
  input.addEventListener('change', () => syncTrackingUrls(list, img))

  const rmBtn = document.createElement('button')
  rmBtn.type = 'button'
  rmBtn.title = '削除'
  rmBtn.textContent = '✕'
  rmBtn.style.cssText =
    'flex-shrink:0;width:24px;height:24px;display:flex;align-items:center;' +
    'justify-content:center;border:none;background:none;color:#e5573f;' +
    'cursor:pointer;border-radius:4px;font-size:13px'
  rmBtn.addEventListener('mouseenter', () => { rmBtn.style.background = '#FEE' })
  rmBtn.addEventListener('mouseleave', () => { rmBtn.style.background = 'none' })
  rmBtn.addEventListener('click', () => {
    rowEl.remove()
    syncTrackingUrls(list, img)
  })

  rowEl.append(input, rmBtn)
  list.append(rowEl)
}

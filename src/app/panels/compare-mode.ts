/**
 * 比較モードパネル（フローティング・ドラッグ移動可能）
 *
 * エディタの上にフローティングパネルとして表示。
 * 「…」ボタンでドラッグ移動できる。
 * 実物 SquadBeyond の比較モード UI を再現。
 */
import { toast } from '../ui.ts'
import { renderCompareHeatmap } from './compare-heatmap.ts'
import {
  ICON_BENCHMARK,
  ICON_CLOSE,
  ICON_COPY,
  ICON_DOTS,
  ICON_EXTERNAL,
  ICON_EYE,
  ICON_HEATMAP,
  ICON_HISTORY,
  ICON_QR,
  ICON_VERSION,
  injectOtherVersionsStyles,
  injectStyles,
} from './compare-mode-styles.ts'
import { MIN_H, MIN_W } from './compare-mode-metrics.ts'

/* ──────────────────── SVG アイコン ──────────────────── */











/* ──────────────────── タブ定義 ──────────────────── */

interface TabDef {
  readonly label: string
  readonly icon: string
}

const TABS: readonly TabDef[] = [
  { label: 'プレビュー', icon: ICON_EYE },
  { label: 'ヒートマップ', icon: ICON_HEATMAP },
  { label: '他のVersion', icon: ICON_VERSION },
  { label: '更新履歴・\n復元', icon: ICON_HISTORY },
  { label: 'ベンチマーク', icon: ICON_BENCHMARK },
]

/* ──────────────────── デバイス定義 ──────────────────── */

interface DeviceDef {
  readonly label: string
  readonly width: number
  readonly height: number
}

const DEVICES: readonly DeviceDef[] = [
  { label: 'iPhone SE (第1世代) (320×568)', width: 320, height: 568 },
  { label: 'Galaxy S22 / S23 / S24 (360×780)', width: 360, height: 780 },
  { label: 'iPhone SE (第2/3世代) (375×667)', width: 375, height: 667 },
  { label: 'iPhone 12 / 13 / 14 (390×844)', width: 390, height: 844 },
  { label: 'iPhone 15 / 15 Pro / 16 (393×852)', width: 393, height: 852 },
  { label: 'iPhone 16 Pro / 17 (402×874)', width: 402, height: 874 },
  { label: 'Pixel 7 / 8 (412×915)', width: 412, height: 915 },
  { label: 'iPhone 15 Plus / 15 Pro Max / 16 Plus (430×932)', width: 430, height: 932 },
  { label: 'iPhone 16 Pro Max / 17 Pro Max (440×956)', width: 440, height: 956 },
  { label: '小型ノートPC (1024×768)', width: 1024, height: 768 },
  { label: 'ノートPC (1280×800)', width: 1280, height: 800 },
  { label: 'デスクトップ (1440×900)', width: 1440, height: 900 },
  { label: 'デスクトップ (フルHD) (1920×1080)', width: 1920, height: 1080 },
]

/** デフォルト選択デバイスのインデックス（iPhone 16 Pro / 17） */
const DEFAULT_DEVICE_INDEX = 5

/* ──────────────────── CSS 注入 ──────────────────── */


/* ──────────────────── 状態 ──────────────────── */

/** 「他のVersion」タブ用の1バージョン分の情報 */
export interface CompareVersionInfo {
  uid: string
  name: string
  /** 配信割合（%） */
  ratio: number
  /** プレビュー用の完成HTML */
  html: string
}

export interface ComparePanelDeps {
  /** このページ（beyondページ）の UID。ヒートマップの取得に使う */
  abTestUid: string
  /** 現在 Version の HTML 本文を返す */
  getCurrentHtml: () => string
  /** 現在 Version の UID */
  getVersionUid: () => string
  /** 指示138: このページに入っている全 Version（サムネ＋配信割合＋プレビュー用に使う） */
  getVersions: () => readonly CompareVersionInfo[]
}

let panelEl: HTMLElement | null = null
/** 閉じたときの位置・サイズを記憶し、再度開いたときに復元する */
let savedPanelRect: { top: number; right: number; width: number; height: number } | null = null

/* ──────────────────── 公開 API ──────────────────── */

export function isComparePanelOpen(): boolean {
  return panelEl !== null
}

export function toggleComparePanel(root: HTMLElement, deps: ComparePanelDeps): void {
  if (panelEl !== null) {
    closeComparePanel()
  } else {
    openComparePanel(root, deps)
  }
}

export function closeComparePanel(): void {
  if (cleanupPhoneResize !== null) {
    cleanupPhoneResize()
    cleanupPhoneResize = null
  }
  if (panelEl !== null) {
    // 閉じる前に位置・サイズを記憶
    const rect = panelEl.getBoundingClientRect()
    savedPanelRect = {
      top: rect.top,
      right: window.innerWidth - rect.right,
      width: rect.width,
      height: rect.height,
    }
    panelEl.remove()
    panelEl = null
  }
}

/** Version 切り替え時にプレビューを更新する */
export function refreshComparePreview(html: string): void {
  if (panelEl === null) return
  const iframe = panelEl.querySelector<HTMLIFrameElement>('[data-cmp-iframe]')
  if (iframe !== null) {
    iframe.srcdoc = wrapHtmlForPreview(html)
  }
}

/* ──────────────────── 内部 ──────────────────── */

function openComparePanel(root: HTMLElement, deps: ComparePanelDeps): void {
  injectStyles()

  panelEl = buildPanel(deps)

  if (savedPanelRect !== null) {
    // 前回閉じた位置・サイズを復元
    panelEl.style.top = `${savedPanelRect.top}px`
    panelEl.style.right = `${savedPanelRect.right}px`
    panelEl.style.width = `${savedPanelRect.width}px`
    panelEl.style.height = `${savedPanelRect.height}px`
  } else {
    // 初回: 右レールの左端を基準に初期位置を決める
    const sideToolbar = root.querySelector<HTMLElement>('[class*="_sideToolbarWrapper_"]')
    const toolbarRect = sideToolbar?.getBoundingClientRect()
    const initRight = toolbarRect !== undefined ? window.innerWidth - toolbarRect.left + 4 : 80
    const initTop = toolbarRect?.top ?? 60
    panelEl.style.top = `${initTop}px`
    panelEl.style.right = `${initRight}px`
    // パネル高さ: ビューポートいっぱい（上下8pxだけ余白）
    panelEl.style.height = `${window.innerHeight - initTop - 8}px`
  }

  document.body.append(panelEl)
}

function buildPanel(deps: ComparePanelDeps): HTMLElement {
  const panel = document.createElement('div')
  panel.className = 'sb-cmp-panel'
  panel.setAttribute('data-compare-panel', '')

  // ── ヘッダ ──
  const header = document.createElement('div')
  header.className = 'sb-cmp-header'

  const title = document.createElement('span')
  title.className = 'sb-cmp-title'
  title.textContent = '比較モード'

  const dotsBtn = document.createElement('button')
  dotsBtn.className = 'sb-cmp-hdr-btn sb-cmp-drag-handle'
  dotsBtn.innerHTML = ICON_DOTS
  dotsBtn.title = 'ドラッグで移動'
  wireDrag(dotsBtn, panel)

  const closeBtn = document.createElement('button')
  closeBtn.className = 'sb-cmp-hdr-btn'
  closeBtn.innerHTML = `${ICON_CLOSE}<span>閉じる</span>`
  closeBtn.addEventListener('click', closeComparePanel)

  header.append(title, dotsBtn, closeBtn)
  panel.append(header)

  // ── タブ ──
  const tabBar = document.createElement('div')
  tabBar.className = 'sb-cmp-tabs'

  const contentArea = document.createElement('div')
  contentArea.className = 'sb-cmp-content'

  let activeTabIndex = 0

  for (let i = 0; i < TABS.length; i += 1) {
    const tab = TABS[i]
    if (tab === undefined) continue
    const btn = document.createElement('button')
    btn.className = `sb-cmp-tab${i === 0 ? ' active' : ''}`

    const iconSpan = document.createElement('span')
    iconSpan.className = 'sb-cmp-tab-icon'
    iconSpan.innerHTML = tab.icon

    const labelSpan = document.createElement('span')
    labelSpan.textContent = tab.label

    btn.append(iconSpan, labelSpan)
    tabBar.append(btn)

    btn.addEventListener('click', () => {
      if (i === activeTabIndex) return
      activeTabIndex = i
      for (const t of tabBar.querySelectorAll('.sb-cmp-tab')) {
        t.classList.remove('active')
      }
      btn.classList.add('active')
      renderTabContent(contentArea, i, deps)
    })
  }

  panel.append(tabBar)

  // ── コンテンツエリア ──
  renderTabContent(contentArea, 0, deps)
  panel.append(contentArea)

  // ── 四隅リサイズハンドル ──
  for (const corner of ['tl', 'tr', 'bl', 'br'] as const) {
    const handle = document.createElement('div')
    handle.className = `sb-cmp-resize sb-cmp-resize-${corner}`
    wireResize(handle, panel, corner)
    panel.append(handle)
  }

  return panel
}

/* ──────────────────── ドラッグ移動 ──────────────────── */

function wireDrag(handle: HTMLElement, panel: HTMLElement): void {
  let startX = 0
  let startY = 0
  let startLeft = 0
  let startTop = 0

  function onMouseMove(e: MouseEvent): void {
    e.preventDefault()
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    panel.style.left = `${startLeft + dx}px`
    panel.style.top = `${startTop + dy}px`
    // right を解除して left 基準に切り替える
    panel.style.right = 'auto'
  }

  function onMouseUp(): void {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    handle.style.cursor = 'grab'
  }

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault()
    const rect = panel.getBoundingClientRect()
    startX = e.clientX
    startY = e.clientY
    startLeft = rect.left
    startTop = rect.top
    // right → left に切り替え（ドラッグ中は left 基準のほうが直感的）
    panel.style.left = `${rect.left}px`
    panel.style.right = 'auto'
    handle.style.cursor = 'grabbing'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  })
}

/* ──────────────────── リサイズ（四隅ドラッグ） ──────────────────── */

type Corner = 'tl' | 'tr' | 'bl' | 'br'

function wireResize(handle: HTMLElement, panel: HTMLElement, corner: Corner): void {
  let startX = 0
  let startY = 0
  let startRect = { left: 0, top: 0, width: 0, height: 0 }

  function onMouseMove(e: MouseEvent): void {
    e.preventDefault()
    const dx = e.clientX - startX
    const dy = e.clientY - startY

    let newLeft = startRect.left
    let newTop = startRect.top
    // 4隅どの場合も下で必ず入れるので、ここでは初期値を置かない
    let newW: number
    let newH: number

    if (corner === 'tl') {
      newW = startRect.width - dx
      newH = startRect.height - dy
      newLeft = startRect.left + dx
      newTop = startRect.top + dy
    } else if (corner === 'tr') {
      newW = startRect.width + dx
      newH = startRect.height - dy
      newTop = startRect.top + dy
    } else if (corner === 'bl') {
      newW = startRect.width - dx
      newH = startRect.height + dy
      newLeft = startRect.left + dx
    } else {
      // br
      newW = startRect.width + dx
      newH = startRect.height + dy
    }

    // 最小サイズ制約
    if (newW < MIN_W) {
      if (corner === 'tl' || corner === 'bl') newLeft = startRect.left + startRect.width - MIN_W
      newW = MIN_W
    }
    if (newH < MIN_H) {
      if (corner === 'tl' || corner === 'tr') newTop = startRect.top + startRect.height - MIN_H
      newH = MIN_H
    }

    panel.style.left = `${newLeft}px`
    panel.style.top = `${newTop}px`
    panel.style.right = 'auto'
    panel.style.width = `${newW}px`
    panel.style.height = `${newH}px`
  }

  function onMouseUp(): void {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = panel.getBoundingClientRect()
    startX = e.clientX
    startY = e.clientY
    startRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
    // left 基準に統一
    panel.style.left = `${rect.left}px`
    panel.style.right = 'auto'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  })
}

/* ──────────────────── タブコンテンツ ──────────────────── */

function renderTabContent(
  container: HTMLElement,
  tabIndex: number,
  deps: ComparePanelDeps,
): void {
  container.innerHTML = ''

  // 指示138: 「他のVersion」タブ（index 2）は、このページの全 Version を
  // 左にサムネ＋配信割合で常時表示し、選ぶとスマホ画面でプレビューできるようにする。
  if (tabIndex === 2) {
    renderOtherVersions(container, deps)
    return
  }

  // ヒートマップタブ（index 1）はレポート画面と同じ描画を使う
  if (tabIndex === 1) {
    void renderCompareHeatmap(container, {
      abTestUid: deps.abTestUid,
      versionUid: deps.getVersionUid(),
      getCurrentHtml: deps.getCurrentHtml,
    })
    return
  }

  if (tabIndex !== 0) {
    const tabDef = TABS[tabIndex]
    const placeholder = document.createElement('div')
    placeholder.className = 'sb-cmp-placeholder'
    placeholder.innerHTML = `
      ${tabDef?.icon ?? ''}
      <div>${tabDef?.label.replace('\n', '') ?? ''} は準備中です</div>
    `
    container.append(placeholder)
    return
  }

  // ── プレビュータブ ──
  const versionUid = deps.getVersionUid()

  // URL バー
  const urlBar = document.createElement('div')
  urlBar.className = 'sb-cmp-url-bar'

  const urlLabel = document.createElement('span')
  urlLabel.className = 'sb-cmp-url-label'
  urlLabel.textContent = '確認'

  const previewUrl = `${location.origin}/preview/${versionUid}`
  const urlText = document.createElement('span')
  urlText.className = 'sb-cmp-url-text'
  urlText.textContent = previewUrl
  urlText.title = previewUrl

  const copyBtn = document.createElement('button')
  copyBtn.className = 'sb-cmp-url-btn'
  copyBtn.innerHTML = ICON_COPY
  copyBtn.title = 'URLをコピー'
  copyBtn.addEventListener('click', () => {
    void navigator.clipboard.writeText(previewUrl).then(() => toast('コピーしました'))
  })

  const qrBtn = document.createElement('button')
  qrBtn.className = 'sb-cmp-url-btn'
  qrBtn.innerHTML = ICON_QR
  qrBtn.title = 'QRコード'
  qrBtn.addEventListener('click', () => toast('QRコードは準備中です', 'error'))

  const extBtn = document.createElement('button')
  extBtn.className = 'sb-cmp-url-btn'
  extBtn.innerHTML = ICON_EXTERNAL
  extBtn.title = '別タブで開く'
  extBtn.addEventListener('click', () => {
    const url =
      `${location.origin}${location.pathname}` +
      `#/ab_tests/${versionUid}/articles/${versionUid}/previews`
    window.open(url, '_blank', 'noopener')
  })

  urlBar.append(urlLabel, urlText, copyBtn, qrBtn, extBtn)
  container.append(urlBar)

  // デバイスセレクタ
  const deviceRow = document.createElement('div')
  deviceRow.className = 'sb-cmp-device'

  const deviceSelect = document.createElement('select')
  deviceSelect.className = 'sb-cmp-device-select'
  for (let di = 0; di < DEVICES.length; di += 1) {
    const d = DEVICES[di]
    if (d === undefined) continue
    const opt = document.createElement('option')
    opt.value = `${d.width}x${d.height}`
    opt.textContent = d.label
    if (di === DEFAULT_DEVICE_INDEX) opt.selected = true
    deviceSelect.append(opt)
  }

  deviceRow.append(deviceSelect)
  container.append(deviceRow)

  // フォンフレーム
  const phoneArea = document.createElement('div')
  phoneArea.className = 'sb-cmp-phone-area'

  const currentDevice = DEVICES[DEFAULT_DEVICE_INDEX] ?? DEVICES[0]
  if (currentDevice === undefined) return
  phoneArea.append(buildPhoneMockup(deps.getCurrentHtml(), currentDevice, phoneArea))
  container.append(phoneArea)

  // デバイス変更
  deviceSelect.addEventListener('change', () => {
    const [w, h] = deviceSelect.value.split('x').map(Number)
    const dev = DEVICES.find((d) => d.width === w && d.height === h) ?? DEVICES[0]
    if (dev === undefined) return
    phoneArea.innerHTML = ''
    phoneArea.append(buildPhoneMockup(deps.getCurrentHtml(), dev, phoneArea))
  })
}

/* ──────────────────── 他のVersion タブ（指示138） ──────────────────── */

/**
 * 指示138: このページに入っている全 Version を左にサムネ＋配信割合で常時表示し、
 * 選ぶと右のスマホ画面でその Version をプレビューできるようにする。
 */
function renderOtherVersions(container: HTMLElement, deps: ComparePanelDeps): void {
  injectOtherVersionsStyles()

  const versions = deps.getVersions()
  if (versions.length === 0) {
    const placeholder = document.createElement('div')
    placeholder.className = 'sb-cmp-placeholder'
    placeholder.innerHTML = '<div>このページには Version がありません</div>'
    container.append(placeholder)
    return
  }

  const currentUid = deps.getVersionUid()
  // 初期選択は「現在 Version」。無ければ先頭。
  let selectedUid =
    versions.some((v) => v.uid === currentUid) ? currentUid : (versions[0] as CompareVersionInfo).uid
  let device = DEVICES[DEFAULT_DEVICE_INDEX] ?? (DEVICES[0] as DeviceDef)

  const layout = document.createElement('div')
  layout.className = 'sb-cmp-ov-layout'

  // ── 左: Version 一覧（サムネ＋配信割合・常時表示） ──
  const listCol = document.createElement('div')
  listCol.className = 'sb-cmp-ov-list'

  // ── 右: 選択 Version のプレビュー ──
  const previewCol = document.createElement('div')
  previewCol.className = 'sb-cmp-ov-preview'

  const deviceRow = document.createElement('div')
  deviceRow.className = 'sb-cmp-device'
  const deviceSelect = document.createElement('select')
  deviceSelect.className = 'sb-cmp-device-select'
  for (let di = 0; di < DEVICES.length; di += 1) {
    const d = DEVICES[di]
    if (d === undefined) continue
    const opt = document.createElement('option')
    opt.value = `${d.width}x${d.height}`
    opt.textContent = d.label
    if (di === DEFAULT_DEVICE_INDEX) opt.selected = true
    deviceSelect.append(opt)
  }
  deviceRow.append(deviceSelect)

  const phoneArea = document.createElement('div')
  phoneArea.className = 'sb-cmp-phone-area'

  const rebuildPhone = (): void => {
    const v = versions.find((x) => x.uid === selectedUid)
    if (v === undefined) return
    phoneArea.innerHTML = ''
    phoneArea.append(buildPhoneMockup(v.html, device, phoneArea))
  }

  deviceSelect.addEventListener('change', () => {
    const [w, h] = deviceSelect.value.split('x').map(Number)
    device = DEVICES.find((d) => d.width === w && d.height === h) ?? (DEVICES[0] as DeviceDef)
    rebuildPhone()
  })

  previewCol.append(deviceRow, phoneArea)

  // Version カードを並べる
  const cards = new Map<string, HTMLElement>()
  versions.forEach((v, idx) => {
    const card = document.createElement('button')
    card.type = 'button'
    card.className = 'sb-cmp-ov-card'
    if (v.uid === selectedUid) card.classList.add('active')

    // サムネ（LP先頭を縮小表示した iframe）
    const thumb = document.createElement('div')
    thumb.className = 'sb-cmp-ov-thumb'
    const tf = document.createElement('iframe')
    tf.className = 'sb-cmp-ov-thumb-frame'
    tf.setAttribute('scrolling', 'no')
    tf.setAttribute('tabindex', '-1')
    tf.setAttribute('aria-hidden', 'true')
    tf.srcdoc = wrapHtmlForPreview(v.html)
    thumb.append(tf)

    // ラベル（Version名＋配信割合）
    const meta = document.createElement('div')
    meta.className = 'sb-cmp-ov-meta'
    const name = document.createElement('div')
    name.className = 'sb-cmp-ov-name'
    name.textContent = v.name !== '' ? v.name : `Version ${idx + 1}`
    const ratio = document.createElement('div')
    ratio.className = 'sb-cmp-ov-ratio'
    ratio.textContent = `配信割合 ${v.ratio}%`
    meta.append(name, ratio)

    card.append(thumb, meta)
    card.addEventListener('click', () => {
      if (selectedUid === v.uid) return
      selectedUid = v.uid
      for (const [, c] of cards) c.classList.remove('active')
      card.classList.add('active')
      rebuildPhone()
    })
    cards.set(v.uid, card)
    listCol.append(card)
  })

  layout.append(listCol, previewCol)
  container.append(layout)

  // 初期プレビュー
  rebuildPhone()
}


/* ──────── ResizeObserver クリーンアップ ──────── */
let cleanupPhoneResize: (() => void) | null = null

/**
 * スマホモック構築。
 * 1:1 で組み立て → CSS transform で全体を縮小 → ResizeObserver でパネルリサイズに追従。
 * 常にスマホ全体が見える（見切れない）。
 */
function buildPhoneMockup(html: string, device: DeviceDef, phoneArea: HTMLElement): HTMLElement {
  // 前の Observer を切断
  if (cleanupPhoneResize !== null) {
    cleanupPhoneResize()
    cleanupPhoneResize = null
  }

  const isPhone = device.width < 768
  const bezelPadX = isPhone ? 8 : 4
  const bezelPadY = isPhone ? 12 : 4
  const notchH = isPhone ? 22 : 0

  // ── 1:1 でフォン構造を構築 ──
  const phone = document.createElement('div')
  phone.className = 'sb-cmp-phone'
  phone.style.width = `${device.width}px`
  if (!isPhone) {
    phone.style.borderRadius = '12px'
    phone.style.padding = '4px'
  }

  if (isPhone) {
    const notch = document.createElement('div')
    notch.className = 'sb-cmp-phone-notch'
    phone.append(notch)
  }

  const screen = document.createElement('div')
  screen.className = 'sb-cmp-phone-screen'
  screen.style.width = `${device.width}px`
  screen.style.height = `${device.height}px`
  if (!isPhone) screen.style.borderRadius = '8px'

  const iframe = document.createElement('iframe')
  iframe.setAttribute('data-cmp-iframe', '')
  iframe.title = 'LPプレビュー'
  iframe.srcdoc = wrapHtmlForPreview(html)
  iframe.style.width = `${device.width}px`
  iframe.style.height = `${device.height}px`
  // iframe は 1:1（phone 全体を transform するので個別スケール不要）

  screen.append(iframe)
  phone.append(screen)

  // ── ラッパー（phone の視覚サイズを layout に反映する） ──
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'display:inline-block;flex-shrink:0'
  wrapper.append(phone)

  // phone の自然サイズ（1:1）
  const phoneNatW = device.width + bezelPadX * 2
  const phoneNatH = device.height + bezelPadY * 2 + notchH

  // ── パネルサイズに合わせてスマホ全体を縮小 ──
  function fitToArea(): void {
    const areaW = phoneArea.clientWidth - 20
    const areaH = phoneArea.clientHeight - 40
    if (areaW <= 0 || areaH <= 0) return

    const scale = Math.min(1, areaW / phoneNatW, areaH / phoneNatH)
    phone.style.transform = `scale(${scale})`
    phone.style.transformOrigin = 'top left'
    // ラッパーに縮小後の寸法を設定（layout 上のサイズ）
    wrapper.style.width = `${phoneNatW * scale}px`
    wrapper.style.height = `${phoneNatH * scale}px`
  }

  const ro = new ResizeObserver(fitToArea)
  ro.observe(phoneArea)
  cleanupPhoneResize = () => ro.disconnect()
  // 初回サイズ計算（レイアウト確定後に実行）
  requestAnimationFrame(fitToArea)

  return wrapper
}

/** Quill の HTML 本文をプレビュー用の完全なページに包む */
function wrapHtmlForPreview(bodyHtml: string): string {
  // ヘッダー画像コメントを<img>タグに展開
  let headerHtml = ''
  let body = bodyHtml
  const m = bodyHtml.match(/^<!--header-image:(.+?)-->/)
  if (m !== null) {
    headerHtml = `<img src="${m[1] ?? ''}" style="display:block;width:100%;object-fit:cover;position:sticky;top:0;z-index:10;max-height:120px" alt="ヘッダー画像">`
    body = bodyHtml.slice(m[0].length)
  }
  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif;
  font-size:14px;line-height:1.6;color:#333;background:#fff}
img,video{max-width:100%;height:auto;display:block}
a{color:#1a73e8}
</style>
</head><body>
${headerHtml}<div class="article-body">${body}</div>
</body></html>`
}

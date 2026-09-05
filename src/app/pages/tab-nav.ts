/**
 * beyondページの6タブ（基本情報 / Version / ポップアップ / レポート / 切り替え / 中間ページ）の配線。
 *
 * `setupHorizTabs` はキャプチャ DOM の nav を**一切使わず**、新規 DOM でタブバーを
 * 構築する。採取 CSS との干渉を根本的に排除するため。
 */
import { tabHashRoutes } from './basic-info-form.ts'
import { splitTestSettingsHash, redirectPagesHash } from './beyond-nav.ts'

export type TabId = 'info' | 'version' | 'popup' | 'report' | 'split-test' | 'redirect'

const TAB_IDS: readonly TabId[] = ['info', 'version', 'popup', 'report', 'split-test', 'redirect']

const TAB_LABELS: Readonly<Record<TabId, string>> = {
  info: '基本情報',
  version: 'Version',
  popup: '離脱防止ポップ',
  report: 'レポート',
  'split-test': '切り替え',
  redirect: '中間ページ',
}

/** 4タブ（採取DOM内）のIDリスト。切り替え/中間ページは採取DOMに無い */
type CapturedTabId = 'info' | 'version' | 'popup' | 'report'
const CAPTURED_TAB_IDS: readonly CapturedTabId[] = ['info', 'version', 'popup', 'report']

/**
 * 採取 DOM 内のタブアンカー（a#info, a#version, …）の href を書き換える。
 * setupHorizTabs より**先に**呼ぶこと（href を読み取って新規タブに移すため）。
 */
export function wireAbTestTabs(root: HTMLElement, abTestUid: string, folderUid: string): void {
  const routes = tabHashRoutes(folderUid, abTestUid)
  for (const id of CAPTURED_TAB_IDS) {
    const anchors = root.querySelectorAll<HTMLAnchorElement>(`a[id="${id}"]`)
    if (anchors.length === 0) {
      console.warn('[tab-nav] タブ', id, 'が土台に見つかりませんでした')
      continue
    }
    for (const anchor of anchors) {
      anchor.setAttribute('href', routes[id])
    }
  }
}

/** 全6タブのルートを構築する（4タブ + 切り替え + 中間ページ） */
function allTabRoutes(
  folderUid: string,
  abTestUid: string,
): Partial<Record<TabId, string>> {
  return {
    ...tabHashRoutes(folderUid, abTestUid),
    'split-test': splitTestSettingsHash(abTestUid, 'devices'),
    redirect: redirectPagesHash(folderUid, abTestUid),
  }
}

/** CSS を1回だけ注入 */
function injectTabBarCss(): void {
  if (document.getElementById('sb-tab-bar-css') !== null) return
  const style = document.createElement('style')
  style.id = 'sb-tab-bar-css'
  style.textContent = `
    .sb-tab-bar {
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 0 16px;
      height: 40px;
      border-bottom: none;
      background: #0091ff;
      flex-shrink: 0;
    }
    /* 指示86: 採取CSSに負けないよう !important で統一 */
    .sb-tab-bar a {
      display: inline-block !important;
      padding: 8px 16px !important;
      font-size: 13px !important;
      font-weight: 500 !important;
      color: rgba(255,255,255,.7) !important;
      text-decoration: none !important;
      border-radius: 6px 6px 0 0 !important;
      cursor: pointer !important;
      line-height: 1.4 !important;
      transition: color 0.15s, background 0.15s !important;
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      white-space: nowrap !important;
    }
    .sb-tab-bar a:hover {
      color: #fff !important;
      background: rgba(255,255,255,.1) !important;
    }
    .sb-tab-bar a.sb-tab-active {
      color: #1a1a1a !important;
      background: #fff !important;
      font-weight: 500 !important;
    }
    /* 採取物の3アイコン → ヘッダー行に新規DOM版を配置済み→非表示 */
    [class*="_linksContainer_"], [class*="_links_dcd38"] {
      display: none !important;
    }
    /* ── パンくずリスト ── */
    .sb-breadcrumb-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 12px;
      background: #fff;
      flex-shrink: 0;
      height: 48px;
      border-bottom: 1px solid #e5e5ea;
    }
    .sb-breadcrumb {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #555;
      flex-shrink: 0;
    }
    .sb-breadcrumb-icon {
      flex-shrink: 0;
      width: 14px;
      height: 14px;
      opacity: 0.6;
    }
    .sb-breadcrumb-name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sb-breadcrumb-sep {
      color: #bbb;
      flex-shrink: 0;
    }
    .sb-breadcrumb-row-right {
      display: flex;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
      margin-left: 12px;
    }
  `
  document.head.append(style)
}

/** フォルダアイコン SVG（シンプル版） */
const FOLDER_SVG = `<svg class="sb-breadcrumb-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 4a1 1 0 011-1h3.586a1 1 0 01.707.293L8 4h5a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" fill="#9B9B9B"/></svg>`

/** ドキュメントアイコン SVG */
const DOC_SVG = `<svg class="sb-breadcrumb-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 2a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V5.414a1 1 0 00-.293-.707L10.293 2.293A1 1 0 009.586 2H4z" fill="#9B9B9B"/><path d="M5 7h6M5 9h6M5 11h4" stroke="#fff" stroke-width=".8" stroke-linecap="round"/></svg>`

/**
 * タブバーの下にパンくずリスト行を構築する。
 * 採取 DOM の _currentAbTest_ は非表示にし、新規 DOM で描画する。
 *
 * @returns パンくず行の右端コンテナ（VersionフィルタなどページごとのUIを追加できる）
 */
export function setupBreadcrumb(
  root: HTMLElement,
  folderName: string,
  title: string,
  _folderUid?: string,
): HTMLElement | null {
  if (root.querySelector('.sb-breadcrumb-row') !== null) return root.querySelector('.sb-breadcrumb-row-right')

  // ── 採取 DOM の LP 情報を非表示にする ──
  const currentAbTest = root.querySelector<HTMLElement>('[class*="_currentAbTest_"]')
  if (currentAbTest !== null) currentAbTest.style.display = 'none'
  // actionItems（戻るボタン+フォルダドロップダウン）も非表示にする
  const actionItems = root.querySelector<HTMLElement>('[class*="_actionItems_"]')
  if (actionItems !== null) actionItems.style.display = 'none'

  // ── パンくず行を構築 ──
  const row = document.createElement('div')
  row.className = 'sb-breadcrumb-row'

  const crumb = document.createElement('div')
  crumb.className = 'sb-breadcrumb'

  // 戻るボタン（フォルダ一覧へ）
  const backHref = '#/folders'
  const back = document.createElement('a')
  back.style.cssText = 'cursor:pointer;color:#888;font-size:16px;text-decoration:none;line-height:1;margin-right:4px'
  back.textContent = '←'
  back.href = backHref
  crumb.append(back)

  // フォルダアイコン + フォルダ名（クリックでフォルダ一覧へ戻る）
  const folderLink = document.createElement('a')
  folderLink.href = backHref
  folderLink.style.cssText = 'display:inline-flex;align-items:center;gap:4px;text-decoration:none;color:inherit;cursor:pointer'
  const folderIconSpan = document.createElement('span')
  folderIconSpan.innerHTML = FOLDER_SVG
  folderLink.append(folderIconSpan)
  const folderLabel = document.createElement('span')
  folderLabel.className = 'sb-breadcrumb-name'
  folderLabel.textContent = folderName || '板名'
  folderLink.append(folderLabel)
  crumb.append(folderLink)

  // セパレータ
  const sep = document.createElement('span')
  sep.className = 'sb-breadcrumb-sep'
  sep.textContent = '>'
  crumb.append(sep)

  // ドキュメントアイコン + LP名
  const docIconSpan = document.createElement('span')
  docIconSpan.innerHTML = DOC_SVG
  crumb.append(docIconSpan)
  const titleLabel = document.createElement('span')
  titleLabel.className = 'sb-breadcrumb-name'
  titleLabel.style.fontWeight = '600'
  titleLabel.style.color = '#333'
  titleLabel.textContent = title || '検証'
  crumb.append(titleLabel)

  row.append(crumb)

  // 右端コンテナ（ページごとに追加できる）
  const right = document.createElement('div')
  right.className = 'sb-breadcrumb-row-right'
  row.append(right)

  // タブバーの直後に挿入
  const tabBar = root.querySelector('.sb-tab-bar')
  if (tabBar !== null) {
    tabBar.after(row)
  } else {
    const navWrapper = root.querySelector<HTMLElement>('[class*="_navArticleWrapper_"]')
    if (navWrapper !== null) navWrapper.append(row)
    else root.prepend(row)
  }

  return right
}

/**
 * 採取 DOM の縦タブナビを全て非表示にし、新規 DOM で水平タブバーを構築する。
 *
 * 1. wireAbTestTabs が設定した href を採取アンカーから読み取る
 * 2. 採取ナビ（縦・水平両方）を全て display:none
 * 3. 新規 div.sb-tab-bar を作り navArticleWrapper 先頭に挿入
 *
 * @param root 採取物のルート要素
 * @param activeTab 現在のページに対応するタブ
 * @param ids  abTestUid / folderUid — 切り替え / 中間ページタブの href 構築に必要
 */
export function setupHorizTabs(
  root: HTMLElement,
  activeTab: TabId,
  ids?: { abTestUid: string; folderUid: string },
): void {
  // 既に設置済みなら何もしない（二重描画防止）
  if (root.querySelector('.sb-tab-bar') !== null) return

  injectTabBarCss()

  // ── 1. 全6タブの href を構築 ──
  // ids が渡されている場合は allTabRoutes で正しいハッシュルートを構築する。
  // 採取DOMのアンカーには焼き付いた UID（非ハッシュURL）が入っているため、
  // そこから読むと遷移が壊れる。
  const hrefs: Partial<Record<TabId, string>> = ids !== undefined
    ? allTabRoutes(ids.folderUid, ids.abTestUid)
    : {}
  // ids が無い場合のフォールバック: 採取DOMから読む（従来互換）
  if (ids === undefined) {
    for (const id of CAPTURED_TAB_IDS) {
      const anchor = root.querySelector<HTMLAnchorElement>(`a[id="${id}"]`)
      if (anchor !== null) hrefs[id] = anchor.getAttribute('href') ?? ''
    }
  }

  // ── 2. 採取ナビを全て非表示 ──
  for (const nav of root.querySelectorAll<HTMLElement>('nav')) {
    const hasTab = nav.querySelector('a[id="info"], a[id="version"], a[id="popup"], a[id="report"]') !== null
    if (hasTab) nav.style.display = 'none'
  }

  // ── 3. 新規タブバーを構築 ──
  const bar = document.createElement('div')
  bar.className = 'sb-tab-bar'

  for (const id of TAB_IDS) {
    const link = document.createElement('a')
    link.textContent = TAB_LABELS[id]
    const href = hrefs[id]
    if (href !== undefined) link.href = href
    if (id === activeTab) link.classList.add('sb-tab-active')
    bar.append(link)
  }

  // navArticleWrapper 先頭に挿入（なければ root 先頭）
  const navWrapper = root.querySelector<HTMLElement>('[class*="_navArticleWrapper_"]')
  if (navWrapper !== null) {
    navWrapper.prepend(bar)
    // ── 4. navWrapper をタブバー追加に対応させる（全ページ共通） ──
    // 採取 CSS の固定 height ではタブバー分が足りず見切れる → auto に
    navWrapper.style.height = 'auto'
    navWrapper.style.paddingTop = '8px'
    navWrapper.style.background = '#fff'
    navWrapper.style.position = 'sticky'
    navWrapper.style.top = '0'
    navWrapper.style.zIndex = '50'
    navWrapper.style.borderBottom = '1px solid #e5e5ea'
  } else {
    root.prepend(bar)
  }
}

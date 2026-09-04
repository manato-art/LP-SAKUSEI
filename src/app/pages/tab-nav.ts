/**
 * beyondページの4タブ（基本情報 / Version / ポップアップ / レポート）の配線。
 *
 * `setupHorizTabs` はキャプチャ DOM の nav を**一切使わず**、新規 DOM でタブバーを
 * 構築する。採取 CSS との干渉を根本的に排除するため。
 */
import { tabHashRoutes } from './basic-info-form.ts'

export type TabId = 'info' | 'version' | 'popup' | 'report'

const TAB_IDS: readonly TabId[] = ['info', 'version', 'popup', 'report']

const TAB_LABELS: Readonly<Record<TabId, string>> = {
  info: '基本情報',
  version: 'Version',
  popup: 'ポップアップ',
  report: 'レポート',
}

/**
 * 採取 DOM 内のタブアンカー（a#info, a#version, …）の href を書き換える。
 * setupHorizTabs より**先に**呼ぶこと（href を読み取って新規タブに移すため）。
 */
export function wireAbTestTabs(root: HTMLElement, abTestUid: string, folderUid: string): void {
  const routes = tabHashRoutes(folderUid, abTestUid)
  for (const id of TAB_IDS) {
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
      padding: 6px 8px 5px;
      border-bottom: 1px solid #e0e0e0;
      background: #fff;
      flex-shrink: 0;
    }
    .sb-tab-bar a {
      display: inline-block;
      padding: 5px 16px;
      font-size: 13px;
      font-weight: 400;
      color: #888;
      text-decoration: none;
      border-radius: 6px;
      cursor: pointer;
      line-height: 1.4;
      transition: color 0.15s, background 0.15s;
    }
    .sb-tab-bar a:hover {
      color: #333;
      background: #f0f0f2;
    }
    .sb-tab-bar a.sb-tab-active {
      color: #fff;
      background: #1a7af8;
      font-weight: 600;
    }
  `
  document.head.append(style)
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
 */
export function setupHorizTabs(root: HTMLElement, activeTab: TabId): void {
  // 既に設置済みなら何もしない（二重描画防止）
  if (root.querySelector('.sb-tab-bar') !== null) return

  injectTabBarCss()

  // ── 1. wireAbTestTabs が書き込んだ href を読み取る ──
  const hrefs: Partial<Record<TabId, string>> = {}
  for (const id of TAB_IDS) {
    const anchor = root.querySelector<HTMLAnchorElement>(`a[id="${id}"]`)
    if (anchor !== null) hrefs[id] = anchor.getAttribute('href') ?? ''
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
  } else {
    root.prepend(bar)
  }
}

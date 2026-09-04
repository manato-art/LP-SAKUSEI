/**
 * beyondページの4タブ（基本情報 / Version / ポップアップ / レポート）の配線。
 *
 * タブのマークアップは**採取した実DOMのまま**（PC用 `hidden md:flex` とSP用 `md:hidden` の2組）。
 * 各アンカーは実物の `id`（info / version / popup / report）で識別できるので、
 * `href` をクローンのハッシュルートへ張り替えるだけにする。
 *
 * `setupHorizTabs` は縦ナビを非表示にし、非表示の水平ナビを上部バーに移行して
 * ピル型アクティブタブとして表示する。全ページ共通で呼べる。
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
 * @param root 採取した土台を差し込んだ要素
 * @param folderUid 「基本情報」タブの遷移先に必要（実物の href もフォルダ配下）
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

/**
 * 水平タブCSS（ピル型アクティブ）を1回だけ注入。
 * editor.ts からも他ページからも呼べる。
 */
export function injectHorizTabsCss(): void {
  if (document.getElementById('sb-horiz-tabs-css') !== null) return
  const style = document.createElement('style')
  style.id = 'sb-horiz-tabs-css'
  style.textContent = `
    .sb-horiz-tabs { display:flex!important; width:100%!important; padding:0 0 0 4px!important; margin:0 0 4px!important; border-bottom:1px solid #e5e5ea!important; overflow:visible!important; height:auto!important; min-height:0!important; }
    .sb-horiz-tabs ul { display:flex!important; flex-direction:row!important; list-style:none!important; margin:0!important; padding:0!important; gap:0!important; height:auto!important; }
    .sb-horiz-tabs li { display:block!important; margin:0!important; padding:0!important; height:auto!important; }
    .sb-horiz-tabs a { display:inline-flex!important; align-items:center!important; gap:4px!important; padding:4px 14px!important; font-size:13px!important; color:#666!important; text-decoration:none!important; white-space:nowrap!important; border-bottom:none!important; border-radius:6px!important; margin:2px 2px 4px!important; transition:color 0.15s, background 0.15s!important; height:auto!important; background:transparent!important; }
    .sb-horiz-tabs a:hover { color:#333!important; background:#f0f0f0!important; }
    .sb-horiz-tabs a.sb-tab-active { color:#fff!important; background:#1a7af8!important; font-weight:600!important; }
    .sb-horiz-tabs a svg { display:none!important; }
  `
  document.head.append(style)
}

/**
 * 縦タブナビを非表示にし、水平タブを上部に設置する（全ページ共通）。
 *
 * 採取物の構造:
 *   - 可視の `nav`（縦にタブが並ぶサイドバー）→ display:none にする
 *   - 非表示の `nav`（水平バージョン, display:none）→ 上部バーに移して水平タブとして表示
 *
 * navArticleWrapper が見つかれば先頭に prepend、なければ root 先頭に挿入する。
 *
 * @param root 採取物のルート要素
 * @param activeTab 現在のページに対応するタブ
 */
export function setupHorizTabs(root: HTMLElement, activeTab: TabId): void {
  injectHorizTabsCss()

  // タブアンカー（a#info, a#version, …）を含む nav を探す
  const allNavs = root.querySelectorAll<HTMLElement>('nav')
  let hiddenNav: HTMLElement | null = null

  for (const nav of allNavs) {
    const hasTabAnchor = nav.querySelector('a[id="info"], a[id="version"], a[id="popup"], a[id="report"]') !== null
    if (!hasTabAnchor) continue

    const cs = getComputedStyle(nav)
    if (cs.display === 'none') {
      hiddenNav = nav
    } else {
      // 可視の縦ナビ → 上に移行したので非表示
      nav.style.display = 'none'
    }
  }

  if (hiddenNav !== null) {
    // 水平ナビとして表示
    hiddenNav.className = 'sb-horiz-tabs'
    // navArticleWrapper があれば先頭に prepend、なければ root 先頭
    const navWrapper = root.querySelector<HTMLElement>('[class*="_navArticleWrapper_"]')
    if (navWrapper !== null) {
      navWrapper.prepend(hiddenNav)
    } else {
      root.prepend(hiddenNav)
    }

    // テキスト改行を除去し、アクティブタブをマーク
    const links = hiddenNav.querySelectorAll<HTMLElement>('a')
    for (const link of links) {
      // アイコンは非表示（テキストのみ）
      const iconSpan = link.querySelector<HTMLElement>('span.hidden')
      if (iconSpan !== null) iconSpan.style.display = 'none'
      // テキスト改行除去
      for (const child of link.childNodes) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const el = child as HTMLElement
          el.style.whiteSpace = 'nowrap'
          if (el.textContent !== null) el.textContent = el.textContent.replace(/\n/g, '')
        }
      }
      // アクティブタブ
      const text = link.textContent?.trim().replace(/\n/g, '') ?? ''
      const activeLabel = TAB_LABELS[activeTab]
      if (text === activeLabel) {
        link.classList.add('sb-tab-active')
      } else {
        link.classList.remove('sb-tab-active')
      }
    }
  }
}

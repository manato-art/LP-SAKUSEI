/**
 * 共通シェル（サイドバー＋コンテンツ領域）。
 * サイドバーは**採取した実マークアップ**をそのまま使う（企画書 §11 土台）。
 * リンク先だけクローンのルートへ張り替える。
 */
import sidebarHtml from './templates/sidebar.html?raw'

export interface Route {
  path: string
  render: (container: HTMLElement, params: URLSearchParams) => void | Promise<void>
}

/** サイドバーの各項目に、クローン側のルートを割り当てる（実物のナビ順・§6-3） */
const NAV_TARGETS: readonly { label: string; href: string }[] = [
  { label: 'ダッシ', href: '#/dashboard' },
  { label: 'AI', href: '#/sb_ai' },
  { label: 'タスク', href: '#/tasks' },
  { label: 'ページ', href: '#/folders' },
  { label: 'CV速報', href: '#/conversions' },
  { label: 'ツール', href: '#/tools' },
  { label: '外部連携', href: '#/teams/ad_accounts' },
  { label: 'ドメイン', href: '#/teams/domains' },
  { label: '拡張機能', href: '#/addon/option-list' },
  { label: 'レポー', href: '#/report-exclusions' },
  { label: 'イベン', href: '#/seminar' },
  { label: 'ランキ', href: '#/rankings' },
]

let shellRoot: HTMLElement | null = null
let contentRoot: HTMLElement | null = null

export function mountShell(): { content: HTMLElement } {
  const app = document.querySelector<HTMLElement>('#root')
  if (app === null) throw new Error('#root が見つかりません')

  if (shellRoot === null) {
    app.innerHTML = ''
    const wrapper = document.createElement('div')
    wrapper.style.cssText = 'display:flex;min-height:100vh;background:#ECECEC'

    const nav = document.createElement('div')
    nav.innerHTML = sidebarHtml
    wireSidebar(nav)

    const content = document.createElement('div')
    content.style.cssText = 'flex:1;min-width:0'

    wrapper.append(nav, content)
    app.append(wrapper)
    shellRoot = wrapper
    contentRoot = content
  }
  return { content: contentRoot as HTMLElement }
}

/** 採取したサイドバーのリンクをクローンのルートへ張り替える */
function wireSidebar(nav: HTMLElement): void {
  for (const item of nav.querySelectorAll<HTMLElement>('[data-testid="list-menu-item"]')) {
    const text = (item.textContent ?? '').trim()
    const target = NAV_TARGETS.find((t) => text.startsWith(t.label))
    if (target === undefined) continue
    item.style.cursor = 'pointer'
    item.addEventListener('click', () => {
      location.hash = target.href.slice(1)
    })
  }
  // 採取物に残っているaタグは、クローンの外へ出ないように無効化する
  for (const anchor of nav.querySelectorAll('a')) {
    anchor.addEventListener('click', (e) => e.preventDefault())
  }
}

/** 現在地のハイライト（実物は選択中の項目に背景色が付く） */
export function markActiveNav(pathPrefix: string): void {
  if (shellRoot === null) return
  for (const item of shellRoot.querySelectorAll<HTMLElement>('[data-testid="list-menu-item"]')) {
    const text = (item.textContent ?? '').trim()
    const target = NAV_TARGETS.find((t) => text.startsWith(t.label))
    const active = target !== undefined && pathPrefix.startsWith(target.href.slice(1))
    item.style.background = active ? '#FDF3E3' : ''
  }
}

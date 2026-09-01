/**
 * 共通シェル（サイドバー＋コンテンツ領域）。
 * サイドバーは**採取した実マークアップ**をそのまま使う（企画書 §11 土台）。
 * リンク先だけクローンのルートへ張り替える。
 */
import { NAV_ACTIVE_CLASS, NAV_INACTIVE_CLASS } from './shell-nav.ts'
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

/**
 * シェル（サイドバー）を撤去して #root を空にする。
 * 配信ページのような「サイドバーを出さない公開ページ」を全画面で描くときに使う。
 * 次に mountShell が呼ばれると作り直される。
 */
export function resetShell(): void {
  const app = document.querySelector<HTMLElement>('#root')
  if (app !== null) app.innerHTML = ''
  shellRoot = null
  contentRoot = null
}

/**
 * 採取したサイドバーのリンクをクローンのルートへ張り替える。
 *
 * - **クリックはイベント委譲**で受ける（項目の子[アイコン/ラベル]どこを押しても効く・再描画にも強い）。
 *   実機で「タップしても移動できない」のは、狭い折りたたみレールで押す位置がシビアだったため。
 * - **折りたたみ＋ホバー展開**（指示④）: 既定は幅の狭いアイコンのみ、マウスを載せると広がってラベルが出る。
 */
function wireSidebar(nav: HTMLElement): void {
  injectRailStyles()

  // レール本体（採取物の最外要素）に、折りたたみ/展開用の目印クラスを付ける。
  const rail = nav.firstElementChild as HTMLElement | null
  rail?.classList.add(RAIL_CLASS)

  // 各項目のラベル（アイコンでない方の子）に目印を付けて、折りたたみ時は隠す。
  for (const item of nav.querySelectorAll<HTMLElement>('[data-testid="list-menu-item"]')) {
    const text = (item.textContent ?? '').trim()
    if (NAV_TARGETS.some((t) => text.startsWith(t.label))) item.style.cursor = 'pointer'
    const label = labelChildOf(item)
    label?.classList.add(RAIL_LABEL_CLASS)
  }

  // クリックは1つの委譲ハンドラで受ける（項目内のどこを押しても、対応ルートへ遷移）。
  nav.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null
    const item = target?.closest<HTMLElement>('[data-testid="list-menu-item"]')
    if (item === null || item === undefined) return
    const text = (item.textContent ?? '').trim()
    const navTarget = NAV_TARGETS.find((t) => text.startsWith(t.label))
    if (navTarget === undefined) return
    event.preventDefault()
    location.hash = navTarget.href.slice(1)
  })
  // 採取物に残っているaタグは、クローンの外へ出ないように無効化する
  for (const anchor of nav.querySelectorAll('a')) {
    anchor.addEventListener('click', (e) => e.preventDefault())
  }
}

/** 折りたたみ/展開・ラベルの目印クラス（JSで付与するのでスタイルは採取クラスに依存しない） */
const RAIL_CLASS = 'sb-rail'
const RAIL_LABEL_CLASS = 'sb-rail-label'

/** 項目の子のうち「アイコンでない方」＝ラベル（テキストを持ち、svg/imgを含まない）を返す */
function labelChildOf(item: HTMLElement): HTMLElement | null {
  for (const child of item.querySelectorAll<HTMLElement>(':scope > *')) {
    if (child.querySelector('svg, img') !== null) continue
    if ((child.textContent ?? '').trim() !== '') return child
  }
  return null
}

/**
 * 折りたたみ（アイコンのみ）＋ホバー展開のCSSを1回だけ差し込む。
 * ホバーできる環境（デスクトップ）でのみ展開する。タッチ端末は折りたたみのまま
 * アイコンをタップして遷移する（委譲ハンドラで確実に動く）。
 */
function injectRailStyles(): void {
  if (document.getElementById('sb-rail-styles') !== null) return
  const style = document.createElement('style')
  style.id = 'sb-rail-styles'
  style.textContent = [
    `.${RAIL_CLASS}{transition:width .18s ease;overflow:hidden;will-change:width}`,
    `.${RAIL_CLASS} .${RAIL_LABEL_CLASS}{opacity:0;max-width:0;white-space:nowrap;overflow:hidden;`,
    `transition:opacity .16s ease,max-width .18s ease}`,
    `@media (hover:hover){`,
    `.${RAIL_CLASS}:hover{width:232px !important}`,
    `.${RAIL_CLASS}:hover .${RAIL_LABEL_CLASS}{opacity:1;max-width:170px}`,
    `}`,
  ].join('')
  document.head.append(style)
}

/** 現在地のハイライト（実物は選択中の項目に背景色が付く） */
export function markActiveNav(pathPrefix: string): void {
  if (shellRoot === null) return
  for (const item of shellRoot.querySelectorAll<HTMLElement>('[data-testid="list-menu-item"]')) {
    const text = (item.textContent ?? '').trim()
    const target = NAV_TARGETS.find((t) => text.startsWith(t.label))
    const active = target !== undefined && pathPrefix.startsWith(target.href.slice(1))
    // 実物はクラスの入れ替えで選択状態を表す。色を直書きすると実物とズレる
    // （手書きの色は実物の rgb(255, 249, 229) と違っていた）。
    item.classList.toggle(NAV_ACTIVE_CLASS, active)
    item.classList.toggle(NAV_INACTIVE_CLASS, !active)
  }
}

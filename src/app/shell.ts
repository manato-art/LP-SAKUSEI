/**
 * 共通シェル（サイドバー＋コンテンツ領域）。
 * サイドバーは**採取した実マークアップ**をそのまま使う（企画書 §11 土台）。
 * リンク先だけクローンのルートへ張り替える。
 */
import { NAV_ACTIVE_CLASS, NAV_INACTIVE_CLASS } from './shell-nav.ts'
import { toast } from './ui.ts'
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
  // 外部連携はアコーディオン親（指示⑯）。直接遷移しないので NAV_TARGETS から外す。
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

  // 外部連携のアコーディオン配線（指示⑯）
  wireAccordion(nav)

  // 設定リンクをサイドバー下部に追加（FAQ: 設定・管理）
  appendSettingsLink(nav)

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

// ── 外部連携アコーディオン（指示⑯） ──

/** アコーディオン親のラベル。NAV_TARGETS から外れた「外部連携」を専用ハンドラで受ける。 */
const ACCORDION_LABEL = '外部連携'

/** アコーディオンのサブ項目。href が null の項目はトーストを出す（指示⑰: CV計測連携は未実装）。 */
const ACCORDION_ITEMS: readonly { label: string; href: string | null }[] = [
  { label: '広告媒体連携', href: '#/teams/ad_accounts' },
  { label: 'CV計測連携', href: null },
]

/** chevron-down SVG（10x10）。閉じ状態では CSS で -90deg 回転して右向きになる。 */
const CHEVRON_SVG = [
  '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">',
  '<path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" stroke-width="1.5"',
  ' stroke-linecap="round" stroke-linejoin="round"/></svg>',
].join('')

/** アコーディオンのDOM参照（markActiveNav から参照する） */
let accordionSubMenu: HTMLElement | null = null
let accordionChevron: HTMLElement | null = null
let accordionParentItem: HTMLElement | null = null
let isAccordionOpen = false

function toggleAccordion(): void {
  isAccordionOpen = !isAccordionOpen
  accordionSubMenu?.classList.toggle('sb-accordion-open', isAccordionOpen)
  accordionChevron?.classList.toggle('sb-accordion-collapsed', !isAccordionOpen)
}

/**
 * 「外部連携」項目をアコーディオンに仕立てる（指示⑯）。
 * クリックでサブメニュー（広告媒体連携 / CV計測連携）を開閉し、
 * サブ項目クリックで遷移またはトーストを出す。
 */
function wireAccordion(nav: HTMLElement): void {
  for (const item of nav.querySelectorAll<HTMLElement>('[data-testid="list-menu-item"]')) {
    const text = (item.textContent ?? '').trim()
    if (!text.startsWith(ACCORDION_LABEL)) continue

    accordionParentItem = item
    item.style.cursor = 'pointer'

    // ラベル末尾にシェブロン（開閉矢印）を追加
    const label = labelChildOf(item)
    if (label !== null) {
      const chevronSpan = document.createElement('span')
      chevronSpan.className = 'sb-accordion-chevron sb-accordion-collapsed'
      chevronSpan.innerHTML = CHEVRON_SVG
      label.append(chevronSpan)
      accordionChevron = chevronSpan
    }

    // サブメニュー（<ul>）を作成。既定は閉じた状態（CSS で max-height:0）。
    const subMenu = document.createElement('ul')
    subMenu.className = 'sb-accordion-sub'

    for (const sub of ACCORDION_ITEMS) {
      const li = document.createElement('li')
      li.className = 'sb-accordion-item'
      // CSS ::before で丸ビュレット。ラベルは rail-label で折りたたみ時に隠す。
      const labelSpan = document.createElement('span')
      labelSpan.className = RAIL_LABEL_CLASS
      labelSpan.textContent = sub.label
      li.append(labelSpan)

      if (sub.href !== null) {
        const href = sub.href
        li.addEventListener('click', (e) => {
          e.stopPropagation()
          location.hash = href.slice(1)
        })
      } else {
        const itemLabel = sub.label
        li.addEventListener('click', (e) => {
          e.stopPropagation()
          toast(`${itemLabel}は準備中です`)
        })
      }

      subMenu.append(li)
    }

    // 親 <li> の末尾にサブメニューを挿入
    const parentLi = item.closest('li')
    if (parentLi !== null) parentLi.append(subMenu)
    accordionSubMenu = subMenu

    // 親クリックで開閉トグル
    item.addEventListener('click', (e) => {
      e.stopPropagation()
      e.preventDefault()
      toggleAccordion()
    })

    break
  }
}

/** サイドバー下部に「設定」リンクを追加（FAQ: 設定・管理） */
function appendSettingsLink(nav: HTMLElement): void {
  const rail = nav.firstElementChild as HTMLElement | null
  if (rail === null) return

  const settingsItem = document.createElement('div')
  settingsItem.style.cssText = [
    'position:absolute;bottom:16px;left:0;right:0;padding:8px 12px',
    'cursor:pointer;display:flex;align-items:center;gap:8px',
  ].join(';')

  // 歯車SVGアイコン
  const icon = document.createElement('span')
  icon.innerHTML = [
    '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">',
    '<path d="M8.325 2.317a1.63 1.63 0 013.35 0 1.724 1.724 0 002.573 1.066 1.63 1.63 0 012.369 2.369',
    ' 1.724 1.724 0 001.065 2.572 1.63 1.63 0 010 3.35 1.724 1.724 0 00-1.066 2.573',
    ' 1.63 1.63 0 01-2.369 2.369 1.724 1.724 0 00-2.572 1.065 1.63 1.63 0 01-3.35 0',
    ' 1.724 1.724 0 00-2.573-1.066 1.63 1.63 0 01-2.369-2.369 1.724 1.724 0 00-1.065-2.572',
    ' 1.63 1.63 0 010-3.35 1.724 1.724 0 001.066-2.573A1.63 1.63 0 015.752 3.383',
    ' 1.724 1.724 0 008.325 2.317z"',
    ' stroke="#888" stroke-width="1.5"/>',
    '<circle cx="10" cy="10" r="2.5" stroke="#888" stroke-width="1.5"/>',
    '</svg>',
  ].join('')
  icon.style.cssText = 'display:flex;align-items:center;flex-shrink:0'

  const label = document.createElement('span')
  label.textContent = '設定'
  label.className = RAIL_LABEL_CLASS

  settingsItem.append(icon, label)
  settingsItem.addEventListener('click', () => {
    location.hash = '/settings/account'
  })
  settingsItem.addEventListener('mouseenter', () => {
    settingsItem.style.background = 'rgba(0,0,0,.04)'
  })
  settingsItem.addEventListener('mouseleave', () => {
    settingsItem.style.background = 'transparent'
  })

  // レールにposition:relativeを付ける（absoluteの基準にする）
  rail.style.position = 'relative'
  rail.append(settingsItem)
}

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
    // ── アコーディオン ──
    `.sb-accordion-chevron{display:inline-flex;align-items:center;margin-left:4px;`,
    `transition:transform .18s ease}`,
    `.sb-accordion-chevron.sb-accordion-collapsed{transform:rotate(-90deg)}`,
    `.sb-accordion-sub{list-style:none;margin:0;padding:0;overflow:hidden;`,
    `max-height:0;opacity:0;transition:max-height .22s ease,opacity .16s ease}`,
    `@media (hover:hover){`,
    `.${RAIL_CLASS}:hover .sb-accordion-sub.sb-accordion-open{max-height:120px;opacity:1}`,
    `}`,
    `.sb-accordion-item{display:flex;align-items:center;padding:5px 8px 5px 40px;`,
    `cursor:pointer;font-size:13px;color:#666;white-space:nowrap;overflow:hidden}`,
    `.sb-accordion-item:hover{background:rgba(0,0,0,.04)}`,
    `.sb-accordion-item.sb-accordion-item-active{color:#333;font-weight:500}`,
    `.sb-accordion-item::before{content:'';display:inline-block;width:5px;height:5px;`,
    `border-radius:50%;background:currentColor;margin-right:8px;flex-shrink:0}`,
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

  // ── アコーディオン親のハイライトと自動展開（指示⑯） ──
  if (accordionParentItem !== null) {
    const accordionActive = ACCORDION_ITEMS.some(
      (ai) => ai.href !== null && pathPrefix.startsWith(ai.href.slice(1)),
    )
    accordionParentItem.classList.toggle(NAV_ACTIVE_CLASS, accordionActive)
    accordionParentItem.classList.toggle(NAV_INACTIVE_CLASS, !accordionActive)
    // アコーディオン配下のルートにいるなら自動で開く
    if (accordionActive && !isAccordionOpen) toggleAccordion()
  }

  // ── アコーディオンのサブ項目ハイライト ──
  if (accordionSubMenu !== null) {
    const subLis = accordionSubMenu.querySelectorAll<HTMLElement>('.sb-accordion-item')
    let idx = 0
    for (const ai of ACCORDION_ITEMS) {
      const li = subLis[idx]
      if (li !== undefined) {
        const subActive = ai.href !== null && pathPrefix.startsWith(ai.href.slice(1))
        li.classList.toggle('sb-accordion-item-active', subActive)
      }
      idx += 1
    }
  }
}

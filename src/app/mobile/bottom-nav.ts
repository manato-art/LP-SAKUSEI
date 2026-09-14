/**
 * スマホの下部タブバー（2026-09-13・本人指示）。
 *
 * PCの細いレールは親指が届かず、ラベルも「ダッ…」と切れて読めない。
 * スマホでは画面の下に5つだけ並べ、残りは「その他」のシートにまとめる。
 * アイコンはSVG（絵文字は使わない）。ホームバーのぶんの余白も空ける。
 */
import { T, el } from '../ui.ts'
import { BOTTOM_NAV_HEIGHT } from './mobile-css.ts'

const NAV_ID = 'sb-bottom-nav'
const SHEET_ID = 'sb-more-sheet'

export interface BottomNavItem {
  label: string
  href: string
  icon: string
}

const stroke = 'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"'
const svg = (body: string): string =>
  `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">${body}</svg>`

/** 下に並べる5つ。いちばん使う「ページ」を先頭に置く。 */
export const BOTTOM_NAV_ITEMS: readonly BottomNavItem[] = [
  {
    label: 'ページ',
    href: '#/folders',
    icon: svg(`<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" ${stroke}/><path d="M14 3v5h5" ${stroke}/>`),
  },
  {
    label: 'ダッシュボード',
    href: '#/dashboard',
    icon: svg(`<rect x="3" y="3" width="7" height="7" rx="2" ${stroke}/><rect x="14" y="3" width="7" height="7" rx="2" ${stroke}/><rect x="3" y="14" width="7" height="7" rx="2" ${stroke}/><rect x="14" y="14" width="7" height="7" rx="2" ${stroke}/>`),
  },
  {
    label: 'CV速報',
    href: '#/conversions',
    icon: svg(`<path d="M13 2L4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5z" ${stroke}/>`),
  },
  {
    label: 'ツール',
    href: '#/teams/tags',
    icon: svg(`<circle cx="12" cy="12" r="3" ${stroke}/><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1A1.7 1.7 0 008.9 19a1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1A1.7 1.7 0 005 8.9a1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9.5a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9v.1a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" ${stroke}/>`),
  },
  {
    label: 'その他',
    href: '',
    icon: svg(`<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>`),
  },
]

/** 「その他」に入れる行 */
export const MORE_ITEMS: readonly { label: string; href: string }[] = [
  { label: 'タスク', href: '#/tasks' },
  { label: 'ドメイン', href: '#/teams/domains' },
  { label: 'レポート除外', href: '#/report-exclusions' },
  { label: '広告媒体連携', href: '#/teams/ad_accounts' },
  { label: 'CV計測連携', href: '#/teams/asp_accounts' },
  { label: 'マイページ', href: '#/settings/account' },
  { label: '設定', href: '#/settings/account' },
]

/**
 * その画面で下部タブバーを出すか。
 * LPエディタは画面の高さを全部使い、自前の操作列を下に持っているので出さない
 * （重なって押せなくなる）。エディタからはパンくずの「←」で戻る。
 */
export function showsBottomNav(hash: string): boolean {
  const current = hash.replace(/^#/, '')
  return !/^\/ab_tests\/[^/]+\/articles/.test(current)
}

/** 今のURLが、そのタブの担当か */
export function isActiveTab(hash: string, href: string): boolean {
  if (href === '') return false
  const route = href.replace(/^#/, '')
  const current = hash.replace(/^#/, '')
  if (route === '/folders') return current === '' || current.startsWith('/folders') || current.startsWith('/ab_tests')
  if (route === '/teams/tags') return current.startsWith('/teams/tags') || current.startsWith('/teams/bulk_replaces') || current.startsWith('/teams/media') || current.startsWith('/teams/inspections')
  return current.startsWith(route)
}

function closeSheet(): void {
  document.getElementById(SHEET_ID)?.remove()
}

/** 「その他」のシートを出す */
function openMoreSheet(): void {
  closeSheet()
  const overlay = el('div', {
    style: [
      'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.4)',
      'display:flex;align-items:flex-end',
    ].join(';'),
  })
  overlay.id = SHEET_ID
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeSheet()
  })

  const sheet = el('div', {
    style: [
      `background:${T.surface};width:100%;border-radius:16px 16px 0 0`,
      'padding:8px 0 calc(8px + env(safe-area-inset-bottom,0px))',
      `font-family:${T.font};max-height:70vh;overflow-y:auto`,
    ].join(';'),
  })
  sheet.append(
    el('div', {
      style: `width:36px;height:4px;border-radius:2px;background:${T.line};margin:8px auto 12px`,
    }),
  )
  for (const item of MORE_ITEMS) {
    const row = el('div', {
      text: item.label,
      class: 'sb-mobile-tap',
      style: [
        `padding:14px 20px;font-size:15px;color:${T.text}`,
        'display:flex;align-items:center;cursor:pointer',
      ].join(';'),
    })
    row.addEventListener('click', () => {
      closeSheet()
      location.hash = item.href.replace(/^#/, '')
    })
    sheet.append(row)
  }
  overlay.append(sheet)
  document.body.append(overlay)
}

/** 下部タブバーを作る（無ければ足す）。今いる画面に合わせて色を塗り直す。 */
export function mountBottomNav(): void {
  let nav = document.getElementById(NAV_ID)
  if (nav === null) {
    nav = el('nav', {
      style: [
        `position:fixed;left:0;right:0;bottom:0;z-index:9000;background:${T.surface}`,
        `border-top:1px solid ${T.line};display:flex`,
        'padding-bottom:env(safe-area-inset-bottom,0px)',
        `font-family:${T.font}`,
      ].join(';'),
    })
    nav.id = NAV_ID
    for (const item of BOTTOM_NAV_ITEMS) {
      const tab = el('button', {
        style: [
          `flex:1;min-width:0;height:${BOTTOM_NAV_HEIGHT}px;border:none;background:transparent`,
          'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px',
          `cursor:pointer;color:${T.sub};font-family:${T.font};padding:0`,
        ].join(';'),
      })
      tab.type = 'button'
      tab.dataset['href'] = item.href
      tab.innerHTML = `${item.icon}<span style="font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">${item.label}</span>`
      tab.addEventListener('click', () => {
        if (item.href === '') {
          openMoreSheet()
          return
        }
        closeSheet()
        location.hash = item.href.replace(/^#/, '')
      })
      nav.append(tab)
    }
    document.body.append(nav)
  }
  paintBottomNav(nav)
}

/** 今いる画面のタブに色を付ける */
function paintBottomNav(nav: HTMLElement): void {
  for (const tab of nav.querySelectorAll<HTMLElement>('[data-href]')) {
    const active = isActiveTab(location.hash, tab.dataset['href'] ?? '')
    tab.style.color = active ? 'var(--sb-accent, #0091FF)' : T.sub
  }
}

/**
 * 上のタブ（基本情報 / Version / … / レポート）は横に長く、今いるタブが
 * 画面の外にあると見えない。押せる位置まで寄せる（2026-09-14 実機で発覚）。
 */
export function scrollActiveTabIntoView(): void {
  const active = document.querySelector<HTMLElement>('.topnav .topnav-tab.active, .topnav-tab.active')
  if (active === null) return
  const row = active.parentElement
  if (row === null || row.scrollWidth <= row.clientWidth + 1) return
  const target = active.offsetLeft - (row.clientWidth - active.offsetWidth) / 2
  row.scrollTo({ left: Math.max(0, target), behavior: 'auto' })
}

/** スマホでなくなったら片付ける */
export function unmountBottomNav(): void {
  closeSheet()
  document.getElementById(NAV_ID)?.remove()
}

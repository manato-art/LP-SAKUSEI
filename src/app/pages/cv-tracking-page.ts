/**
 * CV計測連携ページ（実SB「外部連携 > CV計測連携」= /teams/asp_accounts）。
 *
 * 実SBを採取して再現: カート / ASP / 計測 の3タブに、連携可能なサービスのカタログを並べ、
 * 選ぶと右側に詳細＋連携ボタン（カート/計測＝連携を申請する、ASP＝連携要望を出す）を出す。
 * クローンは実際の外部接続を持たないため、連携ボタンはモック（トーストで受付表示）。
 * カタログ3種は実SB(app.squadbeyond.com/teams/asp_accounts)から採取した一覧。
 */
import { toast } from '../ui.ts'

const CART: readonly string[] = [
  'ecforce', 'Shopify', 'サブスクストア', 'たまごリピート', 'メルリッツ', 'リピスト', '楽楽リピート', '売れるD2Cつくーる',
]

const ASP: readonly string[] = [
  '@tension', '3G', 'a-msp', 'A8.net', 'ACCESSTRADE', 'AD-LAVI', 'AD.TRACK', 'adco', 'ADLIST', 'Adlocate',
  'ADVack', 'advantage', 'afb', 'afi-thor', 'AFRo', 'AllAdIn', 'ARROWS', 'B.connect', 'Bulk Ad', 'Circuit X',
  'COMPAFFILIATE', 'DaFFee', 'DAICON link', 'dap', 'Deep track', 'discovery', 'famAD', 'felmat', 'finebind', 'Fタグ',
  'Gain', 'graxis', 'i-counter', 'i-mobileASP', 'introduction', 'JANet', 'Link-A', 'M-ads', 'marketb', 'Medipartner',
  'mintASP', 'MIRAKU', 'Mobee2', 'MONKEY', 'MSP', 'muneee', 'Partager', 'pe-k', 'popInASP', 'project ad',
  'psalm', 'QUORIZa', 'RAMP', 'RENTRACKS', 'RESULT PLUS', 'Sample Affiliate', 'SCAN', 'since2018', 'SIXPACK-C', 'SLVRbullet',
  'Squad ASP', 'STORK', 'SUNNY', 'TAGGOD', 'Tempura-Link', 'threeate', 'TOSHO Affilate', 'twowin', 'UZOUASP', 'VALUE COMMERCE',
  'Vent', 'Virgin', 'WILDCARD', 'xmax', 'Zucks', 'アフィリエイトワン', 'グリーンプラス', 'クリスタルブック', 'サムライアドウェイズ', 'トリックトラック',
  'プレミアアフィリエイト', 'モノノフリンク', 'リトルウィン',
]

const KEISOKU: readonly string[] = [
  'AD EBiS', 'AFAD', 'AFFILICODE', 'BOTCHAN', 'CATS', 'LINE友達追加CV計測', 'Lステップ', '売れるメディアプラットフォーム',
]

type TabKey = 'cart' | 'asp' | 'keisoku'
const TABS: readonly { key: TabKey; label: string; items: readonly string[]; action: string }[] = [
  { key: 'cart', label: 'カート', items: CART, action: '連携を申請する' },
  { key: 'asp', label: 'ASP', items: ASP, action: '連携要望を出す' },
  { key: 'keisoku', label: '計測', items: KEISOKU, action: '連携を申請する' },
]

export function renderCvTracking(container: HTMLElement): void {
  injectStyles()
  container.innerHTML = ''
  container.style.cssText = 'flex:1;min-width:0'
  const page = h('div', 'cvt-page')
  container.append(page)

  // 上部タブ
  const tabbar = h('div', 'cvt-tabs')
  page.append(tabbar)
  const body = h('div', 'cvt-body')
  page.append(body)

  let activeTab: TabKey = 'cart'
  let selected: string | null = null
  let query = ''

  const renderTabs = (): void => {
    tabbar.innerHTML = ''
    for (const t of TABS) {
      const btn = h('button', 'cvt-tab' + (t.key === activeTab ? ' active' : ''), t.label) as HTMLButtonElement
      btn.type = 'button'
      btn.addEventListener('click', () => {
        activeTab = t.key
        selected = null
        query = ''
        renderTabs()
        renderBody()
      })
      tabbar.append(btn)
    }
  }

  const renderBody = (): void => {
    body.innerHTML = ''
    const tab = TABS.find((t) => t.key === activeTab)!
    // 左: 検索＋一覧
    const listCol = h('div', 'cvt-list-col')
    const search = document.createElement('input')
    search.className = 'cvt-search'
    search.type = 'text'
    search.placeholder = '検索..'
    search.value = query
    search.addEventListener('input', () => {
      query = search.value
      renderList()
    })
    listCol.append(search)
    const list = h('div', 'cvt-list')
    listCol.append(list)

    const renderList = (): void => {
      list.innerHTML = ''
      const q = query.trim().toLowerCase()
      const items = tab.items.filter((n) => q === '' || n.toLowerCase().includes(q))
      for (const name of items) {
        const item = h('div', 'cvt-item' + (name === selected ? ' active' : ''))
        item.append(h('span', 'cvt-item-dot'), h('span', 'cvt-item-name', name))
        item.addEventListener('click', () => {
          selected = name
          renderList()
          renderDetail()
        })
        list.append(item)
      }
      if (items.length === 0) list.append(h('div', 'cvt-empty', '該当するサービスがありません'))
    }

    // 右: 詳細
    const detailCol = h('div', 'cvt-detail-col')
    const renderDetail = (): void => {
      detailCol.innerHTML = ''
      if (selected === null) {
        detailCol.append(h('div', 'cvt-empty', '連携するサービスを選択してください'))
        return
      }
      detailCol.append(h('div', 'cvt-detail-title', selected))
      const btn = h('button', 'cvt-connect', tab.action) as HTMLButtonElement
      btn.type = 'button'
      btn.addEventListener('click', () => {
        toast(`${selected}: ${tab.action}を受け付けました（モック）`)
      })
      detailCol.append(btn)
    }

    body.append(listCol, detailCol)
    renderList()
    renderDetail()
  }

  renderTabs()
  renderBody()
}

function h(tag: string, cls: string, text?: string): HTMLElement {
  const el = document.createElement(tag)
  el.className = cls
  if (text !== undefined) el.textContent = text
  return el
}

function injectStyles(): void {
  if (document.getElementById('cvt-page-css') !== null) return
  const style = document.createElement('style')
  style.id = 'cvt-page-css'
  style.textContent = `
    .cvt-page { display:flex; flex-direction:column; height:calc(100vh - 40px); background:#fff; font-family:"Hiragino Sans","Noto Sans JP",sans-serif; }
    .cvt-tabs { display:flex; gap:18px; padding:0 20px; height:48px; align-items:center; border-bottom:1px solid #e6e8ec; flex-shrink:0; }
    .cvt-tab { background:none; border:none; padding:0 2px; height:48px; font-size:14px; color:#8a94a6; cursor:pointer; border-bottom:2px solid transparent; }
    .cvt-tab.active { color:#1a2233; font-weight:700; border-bottom-color:#0091ff; }
    .cvt-body { display:grid; grid-template-columns:280px 1fr; flex:1; min-height:0; }
    .cvt-list-col { display:flex; flex-direction:column; border-right:1px solid #eef0f3; min-height:0; }
    .cvt-search { margin:12px; padding:9px 12px; font-size:13px; border:1px solid #d6dae1; border-radius:8px; outline:none; }
    .cvt-search:focus { border-color:#0091ff; }
    .cvt-list { flex:1; overflow-y:auto; }
    .cvt-item { display:flex; align-items:center; gap:10px; padding:12px 16px; cursor:pointer; border-bottom:1px solid #f4f5f7; font-size:13.5px; color:#2f3a4d; }
    .cvt-item:hover { background:#f5f8ff; }
    .cvt-item.active { background:#eaf5ff; color:#0091ff; font-weight:600; }
    .cvt-item-dot { width:20px; height:20px; border-radius:50%; background:#e6e8ec; flex-shrink:0; }
    .cvt-item.active .cvt-item-dot { background:#0091ff; }
    .cvt-detail-col { display:flex; flex-direction:column; align-items:center; padding:48px 24px; gap:20px; }
    .cvt-detail-title { font-size:22px; font-weight:700; color:#1a2233; }
    .cvt-connect { padding:9px 22px; font-size:13px; font-weight:600; color:#fff; background:#0091ff; border:none; border-radius:8px; cursor:pointer; }
    .cvt-connect:hover { background:#007ee0; }
    .cvt-empty { color:#8a94a6; font-size:13px; padding:32px 8px; text-align:center; }
  `
  document.head.append(style)
}

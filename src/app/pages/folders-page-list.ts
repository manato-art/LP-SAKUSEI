/**
 * ページ一覧の行（folders.ts から分離）。
 *
 * 採取した実マークアップの行を雛形に、モックのページを1件ずつ描き直す。
 * 行の組み立て・その場での名前変更・「…」メニュー（複製/アーカイブ等）を受け持つ。
 *
 * 依存は一方向にしてある: このファイルは folders.ts を import しない。
 */
import { api, type AbTest } from '../api.ts'
import { T, el, toast } from '../ui.ts'
import { AD_STATUS_LABELS, type PageContext } from './folders-shared.ts'
import { applyListMetrics } from './folders-list-metrics.ts'
import { FOLDERS_HOOK } from './folders-substrate.ts'
import {
  expandDetailPanel,
  updateDetailPanelForAbTest,
  wireRealDetailPanel,
} from './folders-detail-panel.ts'

/**
 * 採取した実一覧（KPI列つきの行＋右の詳細パネル）を土台に、モックのbeyondページへ配線する。
 *
 * - 実の行マークアップ（KPI列・アイコン・配信ステータス）はそのまま見せる（見た目は実物どおり）。
 * - 行のクリック → その行に割り当てたモックのbeyondページのエディタへ。モック件数より
 *   採取の行が多いぶんは round-robin で割り当て、0件なら実の行を隠して空状態を出す。
 * - 右パネルの「パラメータ付きURL」→ クローンのURL発行モーダル、「コピー」→ クリップボード。
 */
export function renderRealList(body: HTMLElement, context: PageContext): void {
  const area = body.querySelector<HTMLElement>(FOLDERS_HOOK.listArea)
  if (area === null) {
    console.warn('[folders]', FOLDERS_HOOK.listArea, 'が土台に見つかりませんでした')
    return
  }
  wireRealPageRows(area, context, body)
  wireRealDetailPanel(body, context)
  // 指示㊾: 最初のページの情報をパネルに反映（初期値を採取物のままにしない）
  const firstAbTest = context.abTests[0]
  if (firstAbTest !== undefined) updateDetailPanelForAbTest(body, firstAbTest, context)
}
/**
 * 一覧の実マークアップ（KPI列つきの行）を雛形に、**モックのbeyondページを1件ずつ描き直す**。
 *
 * 以前は採取物の行（サンプルの匿名データ）をそのまま見せてクリックだけ配線していたが、
 * それだとユーザーが実際に作ったページ（例: めぐり）が一覧に出ず消えたように見えた。
 * ここでは実の行を雛形として複製し、名前・ステータス・媒体をモックの値へ差し替え、
 * 行クリックでそのページのエディタへ飛ばす。KPI値は採取の「準備中・¥0」がそのまま残る
 * （モックの準備中ページは実績0なので、これは正しい表示）。
 */
function wireRealPageRows(area: HTMLElement, context: PageContext, body?: HTMLElement): void {
  const container = area.querySelector<HTMLElement>(FOLDERS_HOOK.pageRowList)
  if (container === null) {
    console.warn('[folders]', FOLDERS_HOOK.pageRowList, 'が土台に見つかりませんでした')
    return
  }
  // 実の行ラッパー（`list-menu-item` を内包する直下要素）を集める。ヘッダやグループ行は残す。
  const rowWrappers = Array.from(container.children).filter(
    (child): child is HTMLElement =>
      child.querySelector('[data-testid="list-menu-item"]') !== null,
  )
  const anchor = rowWrappers[0]
  if (anchor === undefined) return

  // 配線前のクリーンな1枚を雛形として控える
  const template = anchor.cloneNode(true) as HTMLElement

  // フォルダ見出しをモックのフォルダ名に合わせる
  if (context.folder !== null) {
    const groupName = area.querySelector<HTMLElement>(FOLDERS_HOOK.groupName)
    if (groupName !== null) groupName.textContent = context.folder.name
  }

  const fragment = document.createDocumentFragment()
  for (const abTest of context.abTests) {
    const row = buildPageRow(template, abTest)
    // 指示㊾: ホバー/クリックで詳細パネルをそのページの情報に更新
    if (body !== undefined) {
      row.addEventListener('mouseenter', () => updateDetailPanelForAbTest(body, abTest, context))
    }
    fragment.append(row)
  }
  // モックが0件のときは雛形を1枚だけ残さず、行を空にして正直に（採取の空状態は未採取）
  anchor.before(fragment)
  for (const wrapper of rowWrappers) wrapper.remove()

  // 採取物に残る無限スクロールのローディング（`role="progressbar"`）は、
  // クローンの一覧が全件そろっているので永遠に回り続ける。畳んで消す。
  for (const spinner of container.querySelectorAll<HTMLElement>('[role="progressbar"]')) {
    const wrapper = spinner.closest<HTMLElement>(`${FOLDERS_HOOK.pageRowList} > div`)
    ;(wrapper ?? spinner).style.display = 'none'
  }

  // KPI列（PV/Click/CV…）を選択中の集計期間の実データで埋める。
  // 採取物の静的な数字のままだと、実際の計測結果が一覧に出ないため。
  void applyListMetrics(area)
}
/** 雛形の実行を複製し、名前・ステータス・媒体をモック値へ差し替えてクリックを配線する。 */
function buildPageRow(template: HTMLElement, abTest: AbTest): HTMLElement {
  const row = template.cloneNode(true) as HTMLElement
  // 集計期間の実装（KPI列を実データで埋める）ために、行と beyondページを対応づける目印。
  row.dataset['abTestUid'] = abTest.uid
  // 指示㉞: 行同士の境界が薄くて分かりづらいので、はっきりした仕切り線を足す。
  row.style.borderBottom = '1px solid #E3E6EA'
  const status = AD_STATUS_LABELS[abTest.ad_status] ?? abTest.ad_status

  const title = row.querySelector<HTMLElement>(FOLDERS_HOOK.pageTitle)
  if (title !== null) {
    title.textContent = abTest.title
    wireInlineRename(title, abTest)
  }
  for (const node of row.querySelectorAll<HTMLElement>(
    `${FOLDERS_HOOK.pageStatusInline}, ${FOLDERS_HOOK.pageStatusKpi}`,
  )) {
    node.textContent = status
  }
  const media = row.querySelector<HTMLElement>(FOLDERS_HOOK.pageMedia)
  if (media !== null) media.textContent = abTest.media?.name ?? '媒体未設定'

  const item = row.querySelector<HTMLElement>('[data-testid="list-menu-item"]')
  if (item !== null) item.style.cursor = 'pointer'

  // ページ行ホバーアクション（分析/ヒートマップ/レポート/バージョン/…メニュー）
  wirePageRowActions(row, abTest)

  row.addEventListener('click', (event) => {
    // 行内のインライン操作（ボタン・入力・アクションバー）を押したときはエディタへ飛ばさない
    const target = event.target as HTMLElement
    if (target.closest('button') !== null || target.closest('input') !== null || target.closest('.sb-page-actions') !== null) return
    location.hash = `/ab_tests/${abTest.uid}/articles`
  })
  return row
}
/**
 * ページ名（タイトル）をクリックでインライン編集する（指示㉓）。
 * クリック → テキストが input に変わる（黄色背景・青ボーダー）→ Enter/blur で確定 → API更新。
 */
function wireInlineRename(titleEl: HTMLElement, abTest: AbTest): void {
  const el$ = titleEl  // eslint-safe alias（no-param-reassign 回避）
  el$.style.cursor = 'text'
  el$.addEventListener('click', (e) => {
    e.stopPropagation()
    // 既に編集中なら何もしない
    if (el$.querySelector('input') !== null) return

    const currentName = (el$.textContent ?? '').trim()
    const input = document.createElement('input')
    input.type = 'text'
    input.value = currentName
    input.style.cssText = [
      'width:100%;box-sizing:border-box;padding:4px 8px',
      'border:2px solid var(--sb-accent, #0091FF);border-radius:4px',
      'background:#FFFDE7',
      `font-size:inherit;font-family:${T.font}`,
      'outline:none',
    ].join(';')

    el$.replaceChildren(input)
    input.focus()
    input.select()

    const commit = (): void => {
      const newName = input.value.trim()
      if (newName === '' || newName === currentName) {
        el$.replaceChildren(document.createTextNode(currentName))
        return
      }
      el$.replaceChildren(document.createTextNode(newName))
      void api.updateAbTest(abTest.uid, { title: newName }).then(
        () => toast('ページ名を更新しました'),
        () => {
          el$.replaceChildren(document.createTextNode(currentName))
          toast('ページ名の更新に失敗しました', 'error')
        },
      )
    }

    input.addEventListener('blur', commit)
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.isComposing) {
        ev.preventDefault()
        input.blur()
      }
      if (ev.key === 'Escape') {
        el$.replaceChildren(document.createTextNode(currentName))
      }
    })
  })
}
/**
 * ページ行のホバーアクションバー（指示㉒）。
 * 実物は行ホバー時に「分析 / ヒートマップ / レポート / バージョン / ... / 歯車」が出る。
 * 採取物にはこのバーが無い（ホバー時だけ描画されるため）ので、自前で追加する。
 */
function wirePageRowActions(row: HTMLElement, abTest: AbTest): void {
  const item = row.querySelector<HTMLElement>('[data-testid="list-menu-item"]')
  if (item === null) return

  const bar = el('div', {
    style: [
      'position:absolute;top:8px;right:8px',
      'display:flex;gap:4px;opacity:0;transition:opacity 0.15s',
      'pointer-events:none;z-index:10',
    ].join(';'),
  })
  bar.classList.add('sb-page-actions')

  // 行をposition:relativeにしてバーをabsoluteで配置
  ;(item.style as CSSStyleDeclaration).position = 'relative'

  const navButtons: { label: string; hash: string; bg: string; color: string }[] = [
    { label: '分析', hash: `/ab_tests/${abTest.uid}/reports`, bg: '#6C63FF', color: '#FFF' },
    { label: 'ヒートマップ', hash: `/ab_tests/${abTest.uid}/reports`, bg: '#444', color: '#FFF' },
    { label: 'レポート', hash: `/ab_tests/${abTest.uid}/reports`, bg: 'var(--sb-accent, #0091FF)', color: '#FFF' },
    { label: 'バージョン', hash: `/ab_tests/${abTest.uid}/articles`, bg: '#7B61FF', color: '#FFF' },
  ]

  for (const nav of navButtons) {
    const btn = el('button', {
      text: nav.label,
      style: [
        `background:${nav.bg};color:${nav.color}`,
        'border:none;border-radius:4px;padding:4px 10px',
        `font-size:11px;cursor:pointer;font-family:${T.font}`,
        'white-space:nowrap',
      ].join(';'),
    })
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      location.hash = nav.hash
    })
    bar.append(btn)
  }

  // 三点メニュー（…）
  const moreBtn = el('button', {
    text: '···',
    style: [
      `background:${T.surface};color:${T.text}`,
      'border:1px solid #DDD;border-radius:4px;padding:4px 8px',
      `font-size:13px;cursor:pointer;font-family:${T.font}`,
      'font-weight:700',
    ].join(';'),
  })
  moreBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    openPageMoreMenu(moreBtn, abTest)
  })
  bar.append(moreBtn)

  // 歯車アイコン
  const gearBtn = el('button', {
    style: [
      `background:${T.surface};color:${T.sub}`,
      'border:1px solid #DDD;border-radius:4px;padding:4px 6px',
      'cursor:pointer;display:flex;align-items:center',
    ].join(';'),
  })
  gearBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 00-.48-.41h-3.84a.48.48 0 00-.48.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87a.48.48 0 00.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1115.6 12 3.6 3.6 0 0112 15.6z"/></svg>'
  gearBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    // 基本情報ページへ
    location.hash = `/ab_tests/${abTest.uid}/basic_info`
  })
  bar.append(gearBtn)

  item.append(bar)

  // ホバーで表示/非表示 + 指示61: 黄色ハイライト + 指示65: 畳んだパネルを再展開
  row.addEventListener('mouseenter', () => {
    bar.style.opacity = '1'
    bar.style.pointerEvents = 'auto'
    if (item !== null) item.style.backgroundColor = '#FFFDE7'
    // 指示65: 畳まれた詳細パネルを再展開
    expandDetailPanel(document.body)
  })
  row.addEventListener('mouseleave', () => {
    bar.style.opacity = '0'
    bar.style.pointerEvents = 'none'
    if (item !== null) item.style.backgroundColor = ''
  })
}
/** ページ行の三点メニュー（…）の中身（指示㉒） */
let pageMoreMenuEl: HTMLElement | null = null
function openPageMoreMenu(anchor: HTMLElement, abTest: AbTest): void {
  if (pageMoreMenuEl !== null) {
    pageMoreMenuEl.remove()
    pageMoreMenuEl = null
    return
  }

  const menu = el('div', {
    style: [
      'position:fixed;z-index:9999',
      `background:${T.surface};border-radius:8px`,
      'box-shadow:0 4px 16px rgba(0,0,0,.15)',
      'min-width:180px;padding:4px 0',
      `font-family:${T.font};font-size:13px`,
    ].join(';'),
  })

  const items: { label: string; action: () => void }[] = [
    {
      label: 'お気に入りに追加',
      action: () => toast('お気に入り機能はフォルダ単位です'),
    },
    {
      label: 'フォルダ移動',
      action: () => toast('フォルダ移動は未実装です（採取物なし）', 'error'),
    },
    {
      label: '別フォルダへ複製',
      action: () => toast('別フォルダへ複製は未実装です（採取物なし）', 'error'),
    },
    {
      label: 'beyondページ複製',
      action: () => toast('beyondページ複製は未実装です（採取物なし）', 'error'),
    },
    {
      label: 'ステータスを終了にする',
      action: () => {
        void api.updateAbTest(abTest.uid, { ad_status: 'finished' }).then(
          () => {
            toast('ステータスを終了に変更しました')
            dispatchEvent(new HashChangeEvent('hashchange'))
          },
          () => toast('ステータスの変更に失敗しました', 'error'),
        )
      },
    },
  ]

  for (const item of items) {
    const row = el('div', {
      text: item.label,
      style: `padding:10px 16px;cursor:pointer;color:${T.text};white-space:nowrap`,
    })
    row.addEventListener('mouseenter', () => { row.style.background = 'rgba(0,0,0,.04)' })
    row.addEventListener('mouseleave', () => { row.style.background = 'transparent' })
    row.addEventListener('click', (e) => {
      e.stopPropagation()
      menu.remove()
      pageMoreMenuEl = null
      item.action()
    })
    menu.append(row)
  }

  const rect = anchor.getBoundingClientRect()
  menu.style.top = `${rect.bottom + 4}px`
  menu.style.right = `${window.innerWidth - rect.right}px`
  document.body.append(menu)
  pageMoreMenuEl = menu

  requestAnimationFrame(() => {
    const close = (): void => {
      menu.remove()
      pageMoreMenuEl = null
      document.removeEventListener('click', close)
    }
    document.addEventListener('click', close)
  })
}

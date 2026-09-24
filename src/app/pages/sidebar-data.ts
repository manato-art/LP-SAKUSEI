/**
 * サイドバーのデータ画面（指示⑮・ユーザー承認の「モックで機能自作」）。
 *
 * 実本体の採取が許可経路外でできないため、これらはモックAPIのデータを土台に**機能する画面**を自作する
 * （実物とは見た目が多少ズレる旨をヘッダに明記）。対象:
 *   CV速報 / ドメイン / レポート除外 / ランキング / イベント・セミナー
 * どれもモックの実エンドポイント（/conversions, /teams/domains, /report-exclusions,
 * /ab_tests/rankings）を叩いて描く。空ならそのまま空状態を出す。
 *
 * ダッシュボードだけは「全体 / 各ページ」の切り替えを持って厚くなったので別ファイル
 * （`dashboard-page.ts`）。共通の部品は `data-ui.ts`。
 */
import { T, el, emptyState, toast } from '../ui.ts'
import { api } from '../api.ts'
import {
  QUICK_DOMAIN_EXISTING_DOMAIN_WARNING,
  QUICK_DOMAIN_NEED_DOMAIN_NOTE,
  quickDomainSteps,
} from '../quick-domain-note.ts'
import {
  DATA_HEAD_CLASS,
  DATA_ROW_CLASS,
  DATA_TABLE_CLASS,
  getJson,
  pageShell,
  postJson,
  smallBtn,
  textInput,
} from './data-ui.ts'

/* ────────────── CV速報 ──────────────
 * ページ送り・CSV全件・自動更新を足して大きくなったので cv-flash-page.ts に分けた（2026-09-24）。
 * 取り込み側（main.ts・テスト）はここからのままでよいように、ここから出し直す。 */
export { conversionsCsv, cvTime, lastUpdatedLabel, renderConversions } from './cv-flash-page.ts'

/* ────────────── ドメイン ────────────── */
interface DomainRow {
  uid?: string
  host?: string
  status?: string
  ssl?: boolean
  kind?: 'quick' | 'custom'
}
/**
 * クイックドメインの土台の設定欄と、DNS側でやることの案内。
 * ここで設定した土台の下に、フォルダごとのドメインを即発行できる（本体のフリードメインにあたる仕組み）。
 */
function quickDomainSection(container: HTMLElement, base: string): HTMLElement {
  const box = el('div', {
    style: `border:1px solid var(--sb-c-e6e6e6, #E6E6E6);border-radius:8px;padding:16px;margin-bottom:20px;background:${T.bg}`,
  })
  box.append(
    el('div', {
      text: 'クイックドメインの土台',
      style: `font-size:14px;font-weight:700;color:${T.text};margin-bottom:6px`,
    }),
    el('div', {
      text: 'ここにドメインを1本だけ設定し、そのドメインをこのシステムへワイルドカードで向けておくと、フォルダごとのドメインをその場で発行できます（ドメインの追加購入もDNS作業も要りません）。',
      style: `font-size:12px;color:${T.sub};line-height:1.7;margin-bottom:12px`,
    }),
  )

  if (base === '') {
    const warn = el('div', {
      style: [
        'border-left:3px solid var(--sb-warn-line, #DD6B20);background:var(--sb-warn-bg, #FFF7ED);border-radius:4px',
        'padding:12px 14px;margin-bottom:14px;font-size:12px;line-height:1.8',
        `color:${T.text}`,
      ].join(';'),
    })
    warn.append(
      el('div', { text: 'ドメインの取得が必要です', style: 'font-weight:700;margin-bottom:4px' }),
      el('div', { text: QUICK_DOMAIN_NEED_DOMAIN_NOTE }),
      el('div', { text: QUICK_DOMAIN_EXISTING_DOMAIN_WARNING, style: `color:${T.sub};margin-top:6px` }),
    )
    box.append(warn)
  }

  const bar = el('div', { style: 'display:flex;gap:8px;align-items:center;margin-bottom:12px' })
  const input = textInput('example.com')
  input.value = base
  const saveBtn = smallBtn('保存')
  saveBtn.addEventListener('click', () => {
    saveBtn.textContent = '保存中...'
    void api.setQuickDomain(input.value.trim()).then(
      (result) => {
        saveBtn.textContent = '保存'
        toast(result.quick_domain.base === '' ? '土台ドメインを未設定にしました' : '土台ドメインを保存しました')
        void renderDomains(container)
      },
      (error: Error) => {
        saveBtn.textContent = '保存'
        toast(error.message, 'error')
      },
    )
  })
  bar.append(input, saveBtn)
  box.append(bar)

  const list = el('div', { style: `font-size:12px;color:${T.sub};line-height:1.9` })
  list.append(el('div', { text: 'DNS側でやること', style: `color:${T.text};font-weight:600;margin-bottom:4px` }))
  quickDomainSteps(base).forEach((step, index) => {
    list.append(el('div', { text: `${index + 1}. ${step}` }))
  })
  box.append(list)
  return box
}

export async function renderDomains(container: HTMLElement): Promise<void> {
  const content = pageShell(
    container,
    'ドメイン',
    '※クローンが自作した画面です。クイックドメイン（自動発行）と独自ドメインの一覧を表示します。',
  )

  const quick = await api.quickDomain().catch(() => ({ quick_domain: { base: '' } }))
  content.append(quickDomainSection(container, quick.quick_domain.base))

  // ドメイン追加フォーム
  const addBar = el('div', { style: 'display:flex;gap:8px;margin-bottom:16px;align-items:center' })
  const hostInput = textInput('example.com')
  const addBtn = smallBtn('ドメインを追加')
  addBtn.addEventListener('click', () => {
    const host = hostInput.value.trim()
    if (host === '') {
      toast('ドメイン名を入力してください', 'error')
      return
    }
    addBtn.textContent = '追加中...'
    void postJson('/teams/domains', { host }).then((result) => {
      addBtn.textContent = 'ドメインを追加'
      if (result !== null) {
        toast('ドメインを追加しました')
        hostInput.value = ''
        void renderDomains(container) // 再描画
      } else {
        toast('ドメインの追加に失敗しました', 'error')
      }
    })
  })
  addBar.append(hostInput, addBtn)
  content.append(addBar)

  const data = await getJson<{ domains: DomainRow[] }>('/teams/domains')
  const rows = data?.domains ?? []

  if (rows.length === 0) {
    content.append(emptyState('独自ドメインはまだ登録されていません。'))
    return
  }

  const domainList = el('div', { class: DATA_TABLE_CLASS })
  const grid = `grid-template-columns:1fr 120px 100px 60px`
  const head = el('div', {
    class: DATA_HEAD_CLASS,
    style: `display:grid;${grid};gap:12px;padding:10px 8px;border-bottom:2px solid var(--sb-c-eeeeee, #EEEEEE);font-size:12px;color:${T.sub}`,
  })
  head.append(
    el('div', { text: 'ドメイン' }),
    el('div', { text: '種別' }),
    el('div', { text: 'ステータス' }),
    el('div', { text: 'SSL' }),
  )
  domainList.append(head)

  for (const row of rows) {
    const tr = el('div', {
      class: DATA_ROW_CLASS,
      style: `display:grid;${grid};gap:12px;padding:12px 8px;border-bottom:1px solid var(--sb-c-f2f2f2, #F2F2F2);font-size:13px;color:${T.text};align-items:center`,
    })
    const statusLabel = row.status === 'active' ? 'アクティブ' : row.status === 'pending' ? '確認中' : (row.status ?? '-')
    const sslLabel = row.ssl === true ? 'ON' : 'OFF'
    const cells: readonly (readonly [string, HTMLElement])[] = [
      ['ドメイン', el('div', { text: row.host ?? '-', style: 'word-break:break-all' })],
      ['種別', el('div', { text: row.kind === 'quick' ? 'クイック' : '独自' })],
      [
        'ステータス',
        el('div', { text: statusLabel, style: `color:${row.status === 'active' ? '#38A169' : '#DD6B20'}` }),
      ],
      ['SSL', el('div', { text: sslLabel })],
    ]
    for (const [label, cell] of cells) {
      // スマホでは列名が消えるので、セル自身に持たせる（CSSが「列名 値」で出す）
      cell.dataset['label'] = label
      tr.append(cell)
    }
    // 削除ボタンは実装しない（実物もOwnerのみ・配信停止後のみ）
    domainList.append(tr)
  }
  content.append(domainList)
}

/* ────────────── レポート除外 ────────────── */
/* ────────────── ランキング ──────────────
 * ページ送り・読み込み失敗の表示・自動更新を足したので rankings-page.ts に分けた（2026-09-24）。 */
export { renderRankings } from './rankings-page.ts'

/* ────────────── イベント・セミナー ────────────── */
export function renderSeminarPage(container: HTMLElement): void {
  const content = pageShell(
    container,
    'イベント・セミナー',
    '※クローンが自作した画面です。',
  )
  content.append(
    emptyState('現在開催予定のイベント・セミナーはありません。'),
  )
}

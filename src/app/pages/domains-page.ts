/**
 * ドメイン画面（クイックドメインの土台・独自ドメインの登録・一覧と「確認する」）。
 *
 * - 独自ドメインの入力はホスト名だけ（https:// やパス・空白は、送る前に理由を出して止める。サーバーも同じ決まり）
 * - 状態とSSLは登録したままにしない。「確認する」でサーバーがDNSとこのシステムへの届き方を確かめて更新する
 *   （DNSは読むだけで、設定は一切変えない）。クイックドメインは発行した時点でアクティブ
 * - 一覧を読めなかったときは「まだ登録されていません」に見せず、読めなかったと出す
 */
import { T, el, emptyState, toast } from '../ui.ts'
import { api, type DomainEntry } from '../api.ts'
import { toolsApi } from '../api-tools.ts'
import {
  QUICK_DOMAIN_EXISTING_DOMAIN_WARNING,
  QUICK_DOMAIN_NEED_DOMAIN_NOTE,
  quickDomainSteps,
} from '../quick-domain-note.ts'
import { validateDomainInput } from '../../shared/domain-input.ts'
import { jstParts } from '../jst.ts'
import { DATA_HEAD_CLASS, DATA_ROW_CLASS, DATA_TABLE_CLASS, pageShell, smallBtn, textInput } from './data-ui.ts'

/** 状態のピル（色は面の淡色＋文字色の1通りだけ） */
const STATUS_VIEW: Readonly<Record<string, { label: string; color: string; bg: string }>> = {
  active: { label: 'アクティブ', color: '#1B6B45', bg: 'var(--sb-c-e4f2ea, #E4F2EA)' },
  pending: { label: '確認中', color: '#8A5B00', bg: '#FBF2E0' },
  error: { label: 'エラー', color: '#A33017', bg: '#FBEBE7' },
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
    // 注意は淡色の面だけで示す（色付きの左線は使わない）
    const warn = el('div', {
      style: [
        'background:var(--sb-warn-bg, #FFF7ED);border-radius:6px',
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

/** 独自ドメインを登録する欄。形が違えば送る前に理由を出す */
function addDomainBar(container: HTMLElement): HTMLElement {
  const wrap = el('div', { style: 'margin-bottom:16px' })
  const bar = el('div', { style: 'display:flex;gap:8px;align-items:center' })
  const hostInput = textInput('lp.example.com（https:// は付けない）')
  const addBtn = smallBtn('ドメインを追加')
  const error = el('div', { style: 'font-size:12px;color:#A33017;margin-top:6px;line-height:1.6' })
  error.hidden = true
  const showError = (message: string): void => {
    error.textContent = message
    error.hidden = false
  }
  hostInput.addEventListener('input', () => {
    error.hidden = true
  })
  const submit = (): void => {
    const checked = validateDomainInput(hostInput.value)
    if (!checked.ok) {
      showError(checked.message)
      return
    }
    addBtn.textContent = '追加中...'
    addBtn.disabled = true
    void api.addDomain(checked.host).then(
      () => {
        toast('ドメインを追加しました。DNSを設定したら「確認する」を押してください')
        void renderDomains(container)
      },
      (e: Error) => {
        addBtn.textContent = 'ドメインを追加'
        addBtn.disabled = false
        showError(e.message)
      },
    )
  }
  addBtn.addEventListener('click', submit)
  hostInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) submit()
  })
  bar.append(hostInput, addBtn)
  wrap.append(bar, error)
  return wrap
}

function checkedLabel(row: DomainEntry): string {
  if (row.checked_at === null || row.checked_at === undefined) return 'まだ確認していません'
  const p = jstParts(new Date(row.checked_at * 1000))
  return `${p.month}/${p.day} ${p.hour}:${p.minute} に確認`
}

function statusPill(status: string): HTMLElement {
  const view = STATUS_VIEW[status] ?? { label: status, color: T.sub, bg: 'var(--sb-c-f0f1f4, #F0F1F4)' }
  return el('span', {
    text: view.label,
    style: `display:inline-block;font-size:12px;padding:2px 10px;border-radius:10px;color:${view.color};background:${view.bg};white-space:nowrap`,
  })
}

function domainRow(row: DomainEntry, grid: string, onChanged: () => void): HTMLElement {
  const tr = el('div', {
    class: DATA_ROW_CLASS,
    style: `display:grid;${grid};gap:12px;padding:12px 8px;border-bottom:1px solid var(--sb-c-f2f2f2, #F2F2F2);font-size:13px;color:${T.text};align-items:center`,
  })
  const hostCell = el('div', { style: 'overflow-wrap:anywhere' }, [
    el('div', { text: row.host }),
    el('div', {
      text: row.check_message !== undefined && row.check_message !== '' ? `${checkedLabel(row)}: ${row.check_message}` : checkedLabel(row),
      style: `font-size:11px;color:${T.sub};margin-top:2px;line-height:1.6`,
    }),
  ])
  const sslText =
    row.checked_at === null || row.checked_at === undefined ? '未確認' : row.ssl ? 'ON' : 'OFF'
  const checkBtn = smallBtn('確認する', 'var(--sb-c-ffffff, #FFFFFF)', 'var(--sb-accent, #0091FF)')
  checkBtn.style.border = '1px solid var(--sb-accent, #0091FF)'
  checkBtn.style.padding = '5px 12px'
  checkBtn.title = 'DNSと、このシステムに届くか（https → http）を確かめます。DNSの設定は変えません'
  checkBtn.addEventListener('click', () => {
    checkBtn.textContent = '確認中...'
    checkBtn.disabled = true
    void toolsApi.checkDomain(row.uid).then(
      (res) => {
        const label = STATUS_VIEW[res.domain.status]?.label ?? res.domain.status
        toast(`${row.host}: ${label}${res.domain.check_message !== undefined && res.domain.check_message !== '' ? `（${res.domain.check_message}）` : ''}`)
        onChanged()
      },
      (e: Error) => {
        checkBtn.textContent = '確認する'
        checkBtn.disabled = false
        toast(e.message, 'error')
      },
    )
  })
  const cells: readonly (readonly [string, HTMLElement])[] = [
    ['ドメイン', hostCell],
    ['種別', el('div', { text: row.kind === 'quick' ? 'クイック' : '独自' })],
    ['ステータス', el('div', {}, [statusPill(row.status)])],
    ['SSL', el('div', { text: sslText })],
    ['確認', el('div', {}, [checkBtn])],
  ]
  for (const [label, cell] of cells) {
    // スマホでは列名が消えるので、セル自身に持たせる（CSSが「列名 値」で出す）
    cell.dataset['label'] = label
    tr.append(cell)
  }
  return tr
}

export async function renderDomains(container: HTMLElement): Promise<void> {
  const content = pageShell(
    container,
    'ドメイン',
    '※クローンが自作した画面です。クイックドメイン（自動発行）と独自ドメインの一覧を表示します。',
  )

  const quick = await api.quickDomain().then(
    (r) => r.quick_domain.base,
    (e: Error) => {
      toast(`クイックドメインの設定を読み込めませんでした: ${e.message}`, 'error')
      return ''
    },
  )
  content.append(quickDomainSection(container, quick), addDomainBar(container))

  let rows: DomainEntry[]
  try {
    rows = (await api.domains()).domains
  } catch (e) {
    // 読めなかったのに「まだ登録されていません」と出すと、登録が消えたように見える
    content.append(emptyState(`ドメインの一覧を読み込めませんでした: ${(e as Error).message}`))
    return
  }
  if (rows.length === 0) {
    content.append(emptyState('独自ドメインはまだ登録されていません。'))
    return
  }

  const domainList = el('div', { class: DATA_TABLE_CLASS })
  const grid = 'grid-template-columns:minmax(160px,1fr) 80px 110px 70px 100px'
  const head = el('div', {
    class: DATA_HEAD_CLASS,
    style: `display:grid;${grid};gap:12px;padding:10px 8px;border-bottom:2px solid var(--sb-c-eeeeee, #EEEEEE);font-size:12px;color:${T.sub}`,
  })
  for (const h of ['ドメイン', '種別', 'ステータス', 'SSL', '']) head.append(el('div', { text: h }))
  domainList.append(head)
  for (const row of rows) domainList.append(domainRow(row, grid, () => void renderDomains(container)))
  // 削除ボタンは実装しない（実物もOwnerのみ・配信停止後のみ）
  content.append(domainList)
}

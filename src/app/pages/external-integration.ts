/**
 * 外部連携 → 広告媒体連携（`/teams/ad_accounts`・指示⑦）。
 *
 * 見た目は採取した実DOM（media グリッド）を土台にする（企画書 §11）。ここで足すのは挙動だけ:
 *   - 各媒体の「アカウント連携」ボタンを配線（Metaはモーダルを開く／他媒体は正直に未対応トースト）
 *   - Meta 行の名前は匿名化で伏せられている（例「サンプル施策NNN」）ので「Meta(旧Facebook)」に戻す
 *   - Meta の連携数＝トークンで見える広告アカウント数（実データ）
 *   - Meta モーダル（Meta(旧Facebook)連携）は採取物が無い（採取許可経路外）ので、
 *     ユーザー提供のスクリーンショットを仕様として組む＝広告アカウントID入力＋認証＋一覧表。
 */
import substrate from '../fragments/teams__ad_accounts__default.html?raw'
import { api, type MetaAdAccount } from '../api.ts'
import { isStale } from '../main.ts'
import { toast } from '../ui.ts'
import { stripShellFromFragment } from './report-substrate.ts'
import { bindBackdropClose } from '../panels/portal.ts'

/** 採取物で名前が判別できる媒体（この中に無い名前＝匿名化されたMeta行） */
const KNOWN_MEDIA = new Set([
  'Gunosy',
  'SmartNews API V1',
  'SmartNews API V2',
  'Tiktok',
  'LINE API',
  'Zucks',
  'Yahoo',
  'Google',
  'Docomo',
  'X',
  'Microsoft',
])

const META_LABEL = 'Meta(旧Facebook)'

export async function renderExternalIntegration(
  content: HTMLElement,
  generation?: number,
): Promise<void> {
  content.style.cssText = 'flex:1;min-width:0'
  content.innerHTML = ''
  const root = document.createElement('div')
  root.innerHTML = stripShellFromFragment(substrate)
  content.append(root)

  // 実データ（トークンで見える広告アカウント）を取りに行く。未設定/失敗でも画面は出す。
  let accounts: MetaAdAccount[] = []
  let configured = false
  try {
    const res = await api.metaAdAccounts()
    configured = res.configured
    accounts = res.accounts
  } catch {
    // 取得失敗はグリッド表示のみ（連携数は採取値のまま）
  }
  if (generation !== undefined && isStale(generation)) return

  wireMediaGrid(root, { configured, accounts })
}

function wireMediaGrid(
  root: HTMLElement,
  meta: { configured: boolean; accounts: MetaAdAccount[] },
): void {
  for (const media of root.querySelectorAll<HTMLElement>('[class*="_media_ifzcq_8"]')) {
    const nameEl = media.querySelector<HTMLElement>('[class*="_mediaContainer_ifzcq_17"] span, [class*="_mediaContainer_ifzcq_17"] p')
      ?? findNameNode(media)
    const name = (nameEl?.textContent ?? '').trim()
    const button = findConnectButton(media)
    if (button === null) continue
    button.style.cursor = 'pointer'

    const isMeta = name !== '' && !KNOWN_MEDIA.has(name)
    if (isMeta) {
      if (nameEl !== null && nameEl !== undefined) nameEl.textContent = META_LABEL
      setConnectionCount(media, meta.configured ? meta.accounts.length : null)
      button.addEventListener('click', () => openMetaModal(meta))
    } else {
      button.addEventListener('click', () => toast(`${name} の連携は未対応です`, 'error'))
    }
  }
}

/** メディア名のテキストノードを拾う（container 直下の最初の非空テキスト要素） */
function findNameNode(media: HTMLElement): HTMLElement | null {
  const container = media.querySelector<HTMLElement>('[class*="_mediaContainer_ifzcq_17"]')
  if (container === null) return null
  for (const child of container.querySelectorAll<HTMLElement>('*')) {
    if (child.querySelector('svg, img') !== null) continue
    if ((child.textContent ?? '').trim() !== '') return child
  }
  return null
}

function findConnectButton(media: HTMLElement): HTMLElement | null {
  for (const btn of media.querySelectorAll<HTMLElement>('[class*="_btn_1bcs1_2"]')) {
    if ((btn.textContent ?? '').trim() === 'アカウント連携') return btn
  }
  return null
}

function setConnectionCount(media: HTMLElement, count: number | null): void {
  const el = media.querySelector<HTMLElement>('[class*="_connectionCount_ifzcq_102"]')
  if (el === null) return
  el.textContent = `連携数 ${count ?? 0}`
}

/* ────────────────────────────────────────────────────────────
 * Meta(旧Facebook)連携 モーダル（スクリーンショットを仕様として組む）
 * ──────────────────────────────────────────────────────────── */

let metaModalOpen = false

function openMetaModal(meta: { configured: boolean; accounts: MetaAdAccount[] }): void {
  if (metaModalOpen) return
  metaModalOpen = true

  const overlay = document.createElement('div')
  overlay.dataset['sbMetaModal'] = 'true'
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.35);' +
    'display:flex;align-items:flex-start;justify-content:center;padding:32px 16px;overflow:auto'

  const close = (): void => {
    overlay.remove()
    metaModalOpen = false
  }
  bindBackdropClose(overlay, close)

  const panel = document.createElement('div')
  panel.style.cssText =
    'background:#ECECEC;border-radius:12px;width:min(1100px,96vw);padding:0 0 8px;' +
    'font-family:"Hiragino Sans",sans-serif;box-shadow:0 8px 40px rgba(0,0,0,.25)'

  const tableWrap = document.createElement('div')
  const renderTable = (): void => {
    tableWrap.innerHTML = ''
    tableWrap.append(buildAccountsTable(meta))
  }
  renderTable()

  panel.append(buildHeader(close), buildAuthForm(meta, renderTable), tableWrap)
  overlay.append(panel)
  document.body.append(overlay)
}

function buildHeader(close: () => void): HTMLElement {
  const head = document.createElement('div')
  head.style.cssText = 'position:relative;display:flex;align-items:center;justify-content:center;padding:22px 16px 8px'
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.textContent = '閉じる'
  closeBtn.style.cssText =
    'position:absolute;left:20px;top:18px;padding:9px 20px;border:1px solid #B9D3FF;border-radius:8px;' +
    'background:#fff;color:#2B7CFF;font-size:14px;cursor:pointer'
  closeBtn.addEventListener('click', close)
  const title = document.createElement('div')
  title.textContent = 'Meta(旧Facebook)連携'
  title.style.cssText = 'font-size:18px;color:#333'
  head.append(closeBtn, title)
  return head
}

function buildAuthForm(meta: { configured: boolean; accounts: MetaAdAccount[] }, renderTable: () => void): HTMLElement {
  const wrap = document.createElement('div')
  wrap.style.cssText =
    'display:flex;align-items:center;justify-content:center;gap:24px;padding:16px 16px 28px'
  const fb = document.createElement('div')
  fb.textContent = 'f'
  fb.style.cssText =
    'width:56px;height:56px;border-radius:50%;background:#1877F2;color:#fff;font-weight:800;' +
    'font-size:34px;display:flex;align-items:center;justify-content:center;font-family:Georgia,serif'
  const col = document.createElement('div')
  col.style.cssText = 'display:flex;flex-direction:column;gap:8px'
  const label = document.createElement('div')
  label.textContent = '広告アカウントID'
  label.style.cssText = 'font-size:14px;color:#333'
  const input = document.createElement('input')
  input.type = 'text'
  input.placeholder = '例: 1234567890123456'
  input.style.cssText =
    'width:520px;max-width:70vw;padding:12px 14px;border:1px solid #CBD5E1;border-radius:8px;font-size:14px'
  const authBtn = document.createElement('button')
  authBtn.type = 'button'
  authBtn.textContent = '認証'
  authBtn.style.cssText =
    'align-self:flex-start;padding:10px 26px;border:none;border-radius:8px;background:#2B7CFF;' +
    'color:#fff;font-size:14px;cursor:pointer'
  authBtn.addEventListener('click', () => {
    authenticate(input.value.trim(), meta, renderTable)
    input.value = ''
  })
  col.append(label, input, authBtn)
  wrap.append(fb, col)
  return wrap
}

/**
 * 認証: 入力IDでアカウントを連携する。
 * トークン設定済みなら実アカウント検索、未設定ならモックアカウントを作成。
 * クローンなので OAuth を踏まず、IDを入力すれば連携できる。
 */
function authenticate(
  id: string,
  meta: { configured: boolean; accounts: MetaAdAccount[] },
  renderTable: () => void,
): void {
  if (id === '') {
    toast('広告アカウントIDを入力してください', 'error')
    return
  }
  const cleanId = id.replace(/^act_/, '')

  // 重複チェック
  if (meta.accounts.some((a) => a.account_id === cleanId)) {
    toast('このアカウントは既に連携済みです', 'error')
    return
  }

  if (meta.configured) {
    // トークンあり: 実アカウント検索
    const found = meta.accounts.find((a) => a.account_id === cleanId)
    if (found === undefined) {
      toast('このトークンでは見つからない広告アカウントIDです', 'error')
      return
    }
    toast(`${found.name}（${found.account_id}）を認証しました`)
  } else {
    // トークンなし: モックアカウントを作成して一覧に追加
    const today = new Date().toISOString().split('T')[0] ?? ''
    const mockAccount: MetaAdAccount = {
      account_id: cleanId,
      name: `広告アカウント ${cleanId}`,
      account_status: 1,
      currency: 'JPY',
      created_date: today,
    }
    meta.accounts.push(mockAccount)
    meta.configured = true
    toast(`広告アカウント ${cleanId} を連携しました`)
  }
  renderTable()
}

function buildAccountsTable(meta: { configured: boolean; accounts: MetaAdAccount[] }): HTMLElement {
  const card = document.createElement('div')
  card.style.cssText = 'background:#fff;margin:0 16px;border-radius:10px;overflow:hidden'

  const cols = ['ステータス', '登録日', 'アカウントID', 'アカウント名', 'beyondページ数', '削除']
  const grid = 'grid-template-columns:110px 120px 200px 1fr 130px 70px'
  const head = document.createElement('div')
  head.style.cssText = `display:grid;${grid};gap:12px;padding:18px 24px;color:#666;font-size:14px`
  for (const c of cols) {
    const cell = document.createElement('div')
    cell.textContent = c
    head.append(cell)
  }
  card.append(head)

  if (!meta.configured) {
    card.append(notice('Metaのアクセストークンが未設定です。環境変数 META_ACCESS_TOKEN / META_AD_ACCOUNT_ID を設定すると、連携済みの広告アカウントがここに一覧表示されます。'))
    return card
  }
  if (meta.accounts.length === 0) {
    card.append(notice('連携できる広告アカウントが見つかりませんでした。'))
    return card
  }
  for (const acc of meta.accounts) card.append(buildAccountRow(acc, grid))
  return card
}

function buildAccountRow(acc: MetaAdAccount, grid: string): HTMLElement {
  const row = document.createElement('div')
  row.style.cssText = `display:grid;${grid};gap:12px;padding:20px 24px;border-top:1px solid #EEE;align-items:center;font-size:14px;color:#333`

  const status = document.createElement('span')
  const active = acc.account_status === 1
  status.textContent = active ? '接続可' : '停止中'
  status.style.cssText =
    `justify-self:start;padding:6px 14px;border-radius:6px;color:#fff;font-size:13px;` +
    `background:${active ? '#7ED07E' : '#C0C0C0'}`

  const date = cell(acc.created_date || '-')
  const id = cell(acc.account_id)
  const name = cell(acc.name || '-')
  const pages = cell('0')
  const del = document.createElement('div')
  del.textContent = '🗑'
  del.style.cssText = 'color:#E5573F;cursor:pointer;justify-self:start'
  del.addEventListener('click', () => {
    row.remove()
    toast(`${acc.name || acc.account_id} を一覧から外しました（クローン内のみ）`)
  })

  row.append(status, date, id, name, pages, del)
  return row
}

function cell(text: string): HTMLElement {
  const el = document.createElement('div')
  el.textContent = text
  return el
}

function notice(text: string): HTMLElement {
  const el = document.createElement('div')
  el.textContent = text
  el.style.cssText = 'padding:22px 24px;border-top:1px solid #EEE;color:#666;font-size:13px;line-height:1.9'
  return el
}

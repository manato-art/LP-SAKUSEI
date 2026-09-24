/**
 * 外部連携 → 広告媒体連携（`/teams/ad_accounts`・指示⑦）。
 *
 * 見た目は採取した実DOM（media グリッド）を土台にする（企画書 §11）。ここで足すのは挙動だけ:
 *   - 各媒体の「アカウント連携」ボタンを配線（Metaはモーダルを開く／他媒体は正直に未対応トースト）
 *   - Meta 行の名前は匿名化で伏せられている（例「サンプル施策NNN」）ので「Meta(旧Facebook)」に戻す
 *   - Meta の連携数＝このシステムに連携した広告アカウントの数（サーバーに保存）
 *   - Meta モーダル（Meta(旧Facebook)連携）は採取物が無い（採取許可経路外）ので、
 *     ユーザー提供のスクリーンショットを仕様として組む＝広告アカウントID入力＋認証＋一覧表。
 *     「認証」はトークンで見える広告アカウントの中にそのIDがあるかをサーバーで確かめて保存する
 *     （routes/ad-accounts.ts）。削除は確認カードを出してからサーバーで外す。
 */
import { DATA_HEAD_CLASS, DATA_ROW_CLASS } from './data-ui.ts'
import substrate from '../fragments/teams__ad_accounts__default.html?raw'
import { toolsApi, type LinkedMetaAccount } from '../api-tools.ts'
import { isStale } from '../main.ts'
import { mountAdCostImport } from './ad-cost-import.ts'
import { toast } from '../ui.ts'
import { confirmCard } from '../dialog.ts'
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

const TRASH_ICON =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/>' +
  '<path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>'

/** Metaの連携の今の状態（サーバーから読んだもの） */
interface MetaModel {
  configured: boolean
  accounts: LinkedMetaAccount[]
  candidates: { account_id: string; name: string }[]
  /** 読めなかったときの理由（読めたら null） */
  error: string | null
}

async function loadMeta(): Promise<MetaModel> {
  try {
    const res = await toolsApi.linkedMetaAccounts()
    return {
      configured: res.configured,
      accounts: res.accounts,
      candidates: res.candidates,
      error: res.error ?? null,
    }
  } catch (error) {
    return { configured: false, accounts: [], candidates: [], error: (error as Error).message }
  }
}

export async function renderExternalIntegration(
  content: HTMLElement,
  generation?: number,
): Promise<void> {
  content.style.cssText = 'flex:1;min-width:0'
  content.innerHTML = ''
  const root = document.createElement('div')
  root.innerHTML = stripShellFromFragment(substrate)
  content.append(root)

  // 連携済みの広告アカウントを取りに行く。読めなくても画面は出す（数は「-」、モーダルで理由を出す）
  const meta = await loadMeta()
  if (generation !== undefined && isStale(generation)) return

  wireMediaGrid(root, meta)

  // 採取した画面の下に、広告費の取り込みを足す（実物のUIには手を入れない）
  await mountAdCostImport(content)
}

function wireMediaGrid(root: HTMLElement, initial: MetaModel): void {
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
      const paintCount = (model: MetaModel): void =>
        setConnectionCount(media, model.error === null ? model.accounts.length : null)
      paintCount(initial)
      button.addEventListener('click', () => openMetaModal(initial, paintCount))
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
  el.textContent = `連携数 ${count ?? '-'}`
}

/* ────────────────────────────────────────────────────────────
 * Meta(旧Facebook)連携 モーダル（スクリーンショットを仕様として組む）
 * ──────────────────────────────────────────────────────────── */

let metaModalOpen = false

function openMetaModal(initial: MetaModel, onChanged: (model: MetaModel) => void): void {
  if (metaModalOpen) return
  metaModalOpen = true
  let model = initial

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
    'background:var(--sb-c-ececec, #ECECEC);border-radius:12px;width:min(1100px,96vw);padding:0 0 8px;' +
    'font-family:"Hiragino Sans",sans-serif;box-shadow:0 8px 40px rgba(0,0,0,.25)'

  const formWrap = document.createElement('div')
  const tableWrap = document.createElement('div')
  const render = (): void => {
    formWrap.replaceChildren(buildAuthForm(model, link))
    tableWrap.replaceChildren(buildAccountsTable(model, unlink))
  }
  const reload = async (): Promise<void> => {
    model = await loadMeta()
    onChanged(model)
    render()
  }
  async function link(accountId: string): Promise<boolean> {
    try {
      const res = await toolsApi.linkMetaAccount(accountId)
      toast(`${res.account.name}（${res.account.account_id}）を連携しました`)
      await reload()
      return true
    } catch (error) {
      toast((error as Error).message, 'error')
      return false
    }
  }
  async function unlink(acc: LinkedMetaAccount): Promise<void> {
    const ok = await confirmCard({
      title: '連携を外します',
      message: `${acc.name || acc.account_id}（${acc.account_id}）の連携を外します。`,
      detail: 'ページに設定したMeta広告の紐付け（基本情報）はそのまま残ります。もう一度「認証」すれば連携し直せます。',
      submitLabel: '連携を外す',
      danger: true,
    })
    if (!ok) return
    try {
      await toolsApi.unlinkMetaAccount(acc.account_id)
      toast('連携を外しました')
      await reload()
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  }

  render()
  panel.append(buildHeader(close), formWrap, tableWrap)
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
    'background:var(--sb-c-ffffff, #FFFFFF);color:#2B7CFF;font-size:14px;cursor:pointer'
  closeBtn.addEventListener('click', close)
  const title = document.createElement('div')
  title.textContent = 'Meta(旧Facebook)連携'
  title.style.cssText = 'font-size:18px;color:var(--sb-c-333333, #333333)'
  head.append(closeBtn, title)
  return head
}

function buildAuthForm(model: MetaModel, link: (accountId: string) => Promise<boolean>): HTMLElement {
  const wrap = document.createElement('div')
  wrap.style.cssText =
    'display:flex;align-items:center;justify-content:center;gap:24px;padding:16px 16px 28px;flex-wrap:wrap'
  const fb = document.createElement('div')
  fb.textContent = 'f'
  fb.style.cssText =
    'width:56px;height:56px;border-radius:50%;background:#1877F2;color:#FFFFFF;font-weight:800;' +
    'font-size:34px;display:flex;align-items:center;justify-content:center;font-family:Georgia,serif'
  const col = document.createElement('div')
  col.style.cssText = 'display:flex;flex-direction:column;gap:8px;min-width:0'
  const label = document.createElement('div')
  label.textContent = '広告アカウントID'
  label.style.cssText = 'font-size:14px;color:var(--sb-c-333333, #333333)'
  const input = document.createElement('input')
  input.type = 'text'
  input.placeholder = '例: 1234567890123456'
  input.style.cssText =
    'width:520px;max-width:70vw;padding:12px 14px;border:1px solid #CBD5E1;border-radius:8px;font-size:14px'
  // トークンで見えていて、まだ連携していないアカウントを候補に出す（打ち間違いを減らす）
  if (model.candidates.length > 0) {
    const list = document.createElement('datalist')
    list.id = 'sb-meta-candidates'
    for (const c of model.candidates) {
      const opt = document.createElement('option')
      opt.value = c.account_id
      opt.label = c.name
      list.append(opt)
    }
    input.setAttribute('list', list.id)
    col.append(list)
  }
  const authBtn = document.createElement('button')
  authBtn.type = 'button'
  authBtn.textContent = '認証'
  authBtn.style.cssText =
    'align-self:flex-start;padding:10px 26px;border:none;border-radius:8px;background:#2B7CFF;' +
    'color:#FFFFFF;font-size:14px;cursor:pointer'
  authBtn.addEventListener('click', () => {
    const id = input.value.trim()
    if (id === '') {
      toast('広告アカウントIDを入力してください', 'error')
      return
    }
    authBtn.disabled = true
    void link(id).then((ok) => {
      authBtn.disabled = false
      if (ok) input.value = ''
    })
  })
  col.append(label, input, authBtn)
  wrap.append(fb, col)
  return wrap
}

function buildAccountsTable(model: MetaModel, unlink: (acc: LinkedMetaAccount) => Promise<void>): HTMLElement {
  const card = document.createElement('div')
  card.style.cssText = 'background:var(--sb-c-ffffff, #FFFFFF);margin:0 16px;border-radius:10px;overflow:hidden'

  const cols = ['ステータス', '登録日', 'アカウントID', 'アカウント名', 'beyondページ数', '削除']
  const grid = 'grid-template-columns:110px 120px 200px 1fr 130px 70px'
  const head = document.createElement('div')
  // スマホでは「1行＝1カード（列名 値）」に組み替わる（mobile-css.ts）。
  // 付けないと、630pxの表が overflow:hidden のカードの中で黙って切れ、
  // 「アカウント名」以降と削除ボタンに届かなくなる（2026-09-14）。
  head.className = DATA_HEAD_CLASS
  head.style.cssText = `display:grid;${grid};gap:12px;padding:18px 24px;color:var(--sb-c-666666, #666666);font-size:14px`
  for (const c of cols) {
    const cell = document.createElement('div')
    cell.textContent = c
    head.append(cell)
  }
  card.append(head)

  if (model.error !== null) card.append(notice(`連携の状態を読み込めませんでした: ${model.error}`))
  if (!model.configured && model.error === null) {
    card.append(notice('Metaのアクセストークンが未設定です。環境変数 META_ACCESS_TOKEN を設定すると、広告アカウントIDを入れて「認証」で連携できます（トークンが無いとIDを確かめられないため、連携できません）。'))
  }
  if (model.accounts.length === 0) {
    if (model.configured) card.append(notice('まだ連携している広告アカウントはありません。上に広告アカウントIDを入れて「認証」を押してください。'))
    return card
  }
  for (const acc of model.accounts) card.append(buildAccountRow(acc, grid, cols, unlink))
  card.append(notice('beyondページ数は、ページの「Meta広告連携」で「広告アカウント」単位にこのIDを紐付けたページの数です（キャンペーン・広告セット・広告の単位で紐付けたページは数えていません）。'))
  return card
}

function statusOf(acc: LinkedMetaAccount): { label: string; color: string } {
  if (!acc.visible) return { label: '見えません', color: 'var(--sb-c-c0c0c0, #C0C0C0)' }
  return acc.account_status === 1
    ? { label: '接続可', color: '#7ED07E' }
    : { label: '停止中', color: 'var(--sb-c-c0c0c0, #C0C0C0)' }
}

function buildAccountRow(
  acc: LinkedMetaAccount,
  grid: string,
  cols: readonly string[],
  unlink: (acc: LinkedMetaAccount) => Promise<void>,
): HTMLElement {
  const row = document.createElement('div')
  row.className = DATA_ROW_CLASS
  row.style.cssText = `display:grid;${grid};gap:12px;padding:20px 24px;border-top:1px solid var(--sb-c-eeeeee, #EEEEEE);align-items:center;font-size:14px;color:var(--sb-c-333333, #333333)`

  const s = statusOf(acc)
  const status = document.createElement('span')
  status.textContent = s.label
  status.title = acc.visible ? '' : '今のトークンではこのアカウントが見えません（権限が外れた可能性があります）'
  status.style.cssText =
    `justify-self:start;padding:6px 14px;border-radius:6px;color:#FFFFFF;font-size:13px;background:${s.color}`

  const date = cell(acc.linked_date || '-')
  const id = cell(acc.account_id)
  const name = cell(acc.name || '-')
  const pages = cell(String(acc.page_count))
  const del = document.createElement('button')
  del.type = 'button'
  del.innerHTML = TRASH_ICON
  del.title = '連携を外す'
  del.setAttribute('aria-label', '連携を外す')
  del.style.cssText =
    'justify-self:start;border:none;background:none;color:#E5573F;cursor:pointer;padding:4px;display:inline-flex'
  del.addEventListener('click', () => void unlink(acc))

  // セル自身に列名を持たせる。スマホで列見出しが消えたときにCSSが「列名 値」で出す
  const cells = [status, date, id, name, pages, del]
  cells.forEach((c, i) => { c.dataset['label'] = cols[i] ?? '' })
  row.append(...cells)
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
  el.style.cssText = 'padding:22px 24px;border-top:1px solid var(--sb-c-eeeeee, #EEEEEE);color:var(--sb-c-666666, #666666);font-size:13px;line-height:1.9'
  return el
}

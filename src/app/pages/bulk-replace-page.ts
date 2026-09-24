/**
 * マジック置換（実SB「ツール > マジック置換」= /articles/bulk_replaces）の機能実装。
 *
 * 実物を 2026-09-10 に実機で確認した画面:
 *
 *   [📁] [グループ/フォルダ/ドメイン]  [画像][テキスト][リンク]   [置換対象検索]      [リセット]
 *   ┌───────────────┬──────────────────────────┬─────────────────────┐
 *   │ グループ名      │ 置換対象一覧          ⋮  │ 新しい画像/文字列/リンク │
 *   │  📁 フォルダ ×⋮ │  ページ名             ⋮  │ …                   │
 *   │   □ ページ      │  □ 値       Ver.N  [n]  │ [置換する]           │
 *   └───────────────┴──────────────────────────┴─────────────────────┘
 *
 * 実物どおりにした点:
 *   - タブを切り替えるとページの選択が外れる（対象の意味が変わるため）
 *   - テキストは検索語を入れるまでページを選べない（語が無いと本文全部が対象になる）
 *   - 選択した行は青地＋チェックで示す
 *   - ⋮ は「置換対象全てを選択 / 置換対象全てを未選択」
 *   - リンクの計測機能は 全てONにする / 置換前の設定を引き継ぐ(既定) / 全てOFFにする
 */
import { api, type AbTest, type BulkReplacePage, type Folder } from '../api.ts'
import { toast } from '../ui.ts'
import { confirmCard } from '../dialog.ts'
import { openFolderPicker } from './bulk-replace-folder-modal.ts'
import { collectReplaceTargets, rowKey } from './bulk-replace-targets.ts'
import { buildToolGuide } from './tool-guide.ts'

type Kind = 'image' | 'text' | 'link'
type Tracking = 'on' | 'keep' | 'off'

const KINDS: readonly { id: Kind; label: string }[] = [
  { id: 'image', label: '画像' },
  { id: 'text', label: 'テキスト' },
  { id: 'link', label: 'リンク' },
]

const TRACKING_CHOICES: readonly { id: Tracking; label: string }[] = [
  { id: 'on', label: '全てONにする' },
  { id: 'keep', label: '置換前の設定を引き継ぐ' },
  { id: 'off', label: '全てOFFにする' },
]

interface FolderNode {
  folder: Folder
  pages: AbTest[]
  open: boolean
}

interface PageModel {
  kind: Kind
  groupName: string
  nodes: FolderNode[]
  selectedPages: Set<string>
  /** 中央上の「置換対象検索」。テキストでは検索語、画像/リンクでは絞り込み */
  query: string
  results: BulkReplacePage[]
  checked: Set<string>
  replacement: string
  tracking: Tracking
  /** 直前の「置換する」の結果。「元に戻す」に使う（戻したら null） */
  lastRun: { undoId: string; versions: number; replaced: number } | null
}

export async function renderBulkReplacePage(host: HTMLElement): Promise<void> {
  injectStyles()
  host.innerHTML = ''

  const model: PageModel = {
    kind: 'image',
    groupName: '',
    nodes: [],
    selectedPages: new Set(),
    query: '',
    results: [],
    checked: new Set(),
    replacement: '',
    tracking: 'keep',
    lastRun: null,
  }

  let folders: Folder[] = []
  try {
    folders = (await api.folders()).folders
  } catch (e) {
    toast((e as Error).message, 'error')
  }

  const page = h('div', 'br-page')
  const guideSlot = h('div', 'br-guide-slot')
  const bar = h('div', 'br-bar')
  const panes = h('div', 'br-panes')
  const leftPane = h('div', 'br-pane br-left')
  const midPane = h('div', 'br-pane br-mid')
  const rightPane = h('div', 'br-pane br-right')
  panes.append(leftPane, midPane, rightPane)
  page.append(guideSlot, bar, panes)
  host.append(page)

  /* ══ 上部バー ══ */
  const pickBtn = h('button', 'br-folder-btn') as HTMLButtonElement
  pickBtn.type = 'button'
  pickBtn.title = '置換対象フォルダを追加'
  pickBtn.innerHTML = folderIcon()
  pickBtn.append(h('span', 'br-folder-btn-label', 'フォルダを追加'))
  const treeSearch = searchInput('グループ/フォルダ/ドメイン')
  const tabs = h('div', 'br-tabs')
  const targetSearch = searchInput('置換対象検索')
  const resetBtn = h('button', 'br-reset', 'リセット') as HTMLButtonElement
  resetBtn.type = 'button'
  bar.append(pickBtn, treeSearch, tabs, targetSearch, resetBtn)

  for (const k of KINDS) {
    const b = h('button', 'br-tab', k.label) as HTMLButtonElement
    b.type = 'button'
    b.dataset['kind'] = k.id
    b.addEventListener('click', () => {
      if (model.kind === k.id) return
      model.kind = k.id
      // 実物と同じ: 種別を変えると対象の意味が変わるので選択を外す
      model.selectedPages.clear()
      model.checked.clear()
      model.results = []
      model.replacement = ''
      renderAll()
      void loadTargets()
    })
    tabs.append(b)
  }

  targetSearch.addEventListener('input', () => {
    model.query = targetSearch.value
    if (model.kind === 'text') {
      // テキストは語が変わると対象そのものが変わる
      model.checked.clear()
      renderTree()
    }
    void loadTargets()
  })
  treeSearch.addEventListener('input', renderTree)

  resetBtn.addEventListener('click', () => {
    model.groupName = ''
    model.nodes = []
    model.selectedPages.clear()
    model.checked.clear()
    model.results = []
    model.query = ''
    model.replacement = ''
    model.tracking = 'keep'
    targetSearch.value = ''
    treeSearch.value = ''
    renderAll()
  })

  pickBtn.addEventListener('click', () => {
    void (async () => {
      const picked = await openFolderPicker(folders)
      if (picked === null) return
      model.groupName = picked.groupName
      for (const f of picked.folders) {
        if (model.nodes.some((n) => n.folder.uid === f.uid)) continue
        // フォルダが取れなくても他のフォルダの追加は続ける（1件の失敗で全部止めない）
        const fetched: AbTest[] = await api
          .folderDetail(f.uid)
          .then((r) => r.ab_tests)
          .catch(() => [])
        // 実物の「終了済みbeyondページ 含まない/含む」に対応する
        const pages = picked.includeFinished
          ? fetched
          : fetched.filter((p) => p.ad_status !== 'finished')
        model.nodes.push({ folder: f, pages, open: true })
      }
      renderTree()
    })()
  })

  /* ══ 左ペイン: ツリー ══ */
  function renderTree(): void {
    leftPane.innerHTML = ''
    if (model.nodes.length === 0) {
      leftPane.append(h('div', 'br-hint', '置換対象フォルダを追加してください'))
      return
    }
    if (model.groupName !== '') leftPane.append(h('div', 'br-group', model.groupName))

    // テキストは検索語が無いとページを選べない（実物どおり）
    const locked = model.kind === 'text' && model.query.trim() === ''
    const q = treeSearch.value.trim()

    for (const node of model.nodes) {
      const folderRow = h('div', 'br-folder')
      const name = h('span', 'br-folder-name', node.folder.name)
      const del = h('button', 'br-x', '×') as HTMLButtonElement
      del.type = 'button'
      del.title = 'このフォルダを外す'
      del.addEventListener('click', () => {
        model.nodes = model.nodes.filter((n) => n !== node)
        for (const p of node.pages) model.selectedPages.delete(p.uid)
        renderTree()
        void loadTargets()
      })
      folderRow.append(h('span', 'br-folder-icon'), name, del)
      folderRow.addEventListener('click', (e) => {
        if (e.target === del) return
        node.open = !node.open
        renderTree()
      })
      leftPane.append(folderRow)
      if (!node.open) continue

      if (locked) {
        // 押せないチェックボックスだけ出すと理由が分からない
        leftPane.append(
          h('div', 'br-locked-note', '↑の「置き換えたい文字列を入力」に語を入れると選べます'),
        )
      }
      const shown = node.pages.filter((p) => q === '' || p.title.includes(q))
      for (const p of shown) {
        const row = h('label', `br-tree-page${locked ? ' locked' : ''}`)
        const box = document.createElement('input')
        box.type = 'checkbox'
        box.disabled = locked
        box.checked = model.selectedPages.has(p.uid)
        box.addEventListener('change', () => {
          if (box.checked) model.selectedPages.add(p.uid)
          else model.selectedPages.delete(p.uid)
          renderGuide()
          void loadTargets()
        })
        row.append(box, h('span', 'br-tree-page-name', p.title))
        leftPane.append(row)
      }
    }
  }

  /* ══ 中央ペイン: 置換対象一覧 ══ */
  function renderTargets(): void {
    midPane.innerHTML = ''
    if (model.kind === 'text' && model.query.trim() === '') {
      midPane.append(h('div', 'br-hint', '置換対象文字列を検索してください'))
      return
    }
    if (model.selectedPages.size === 0) {
      midPane.append(h('div', 'br-hint', '置換対象のbeyondページを選択してください'))
      return
    }
    const head = h('div', 'br-list-head')
    head.append(h('span', 'br-list-title', '置換対象一覧'), dotsMenu(selectAll, selectNone))
    midPane.append(head)

    const total = model.results.reduce((n, p) => n + p.rows.length, 0)
    if (total === 0) {
      midPane.append(h('div', 'br-hint', '置換できるものが見つかりませんでした'))
      return
    }

    for (const p of model.results) {
      if (p.rows.length === 0) continue
      const pageHead = h('div', 'br-page-head')
      pageHead.append(
        h('span', 'br-page-head-name', p.title),
        dotsMenu(
          () => setChecked(p, true),
          () => setChecked(p, false),
        ),
      )
      midPane.append(pageHead)

      for (const row of p.rows) {
        const key = rowKey(p, row)
        const on = model.checked.has(key)
        const item = h('label', `br-row${on ? ' on' : ''}`)
        const box = document.createElement('input')
        box.type = 'checkbox'
        box.checked = on
        box.addEventListener('change', () => {
          if (box.checked) model.checked.add(key)
          else model.checked.delete(key)
          renderTargets()
          renderReplacement()
        })
        const main = h('div', 'br-row-main')
        if (model.kind === 'image') {
          const img = document.createElement('img')
          img.className = 'br-thumb'
          img.src = row.label
          img.alt = ''
          item.append(box, img)
        } else {
          item.append(box)
        }
        main.append(h('div', 'br-row-label', row.label), h('div', 'br-row-ver', row.version_name))
        item.append(main)
        if (model.kind !== 'text') item.append(h('span', 'br-count', `[${row.count}]`))
        midPane.append(item)
      }
    }
  }

  function setChecked(p: BulkReplacePage, on: boolean): void {
    for (const row of p.rows) {
      const key = rowKey(p, row)
      if (on) model.checked.add(key)
      else model.checked.delete(key)
    }
    renderTargets()
    renderReplacement()
  }
  function selectAll(): void {
    for (const p of model.results) for (const r of p.rows) model.checked.add(rowKey(p, r))
    renderTargets()
    renderReplacement()
  }
  function selectNone(): void {
    model.checked.clear()
    renderTargets()
    renderReplacement()
  }

  /* ══ 右ペイン: 新しい値 ══ */
  function renderReplacement(): void {
    rightPane.innerHTML = ''
    const titles: Record<Kind, string> = {
      image: '新しい画像',
      text: '新しい文字列',
      link: '新しいリンク',
    }
    rightPane.append(h('div', 'br-right-title', titles[model.kind]))

    if (model.kind === 'image') {
      rightPane.append(imageInput())
    } else if (model.kind === 'text') {
      const area = document.createElement('textarea')
      area.className = 'br-textarea'
      area.placeholder = '置換する文字列'
      area.value = model.replacement
      area.addEventListener('input', () => {
        model.replacement = area.value
      })
      rightPane.append(area)
    } else {
      const url = document.createElement('input')
      url.type = 'text'
      url.className = 'br-url'
      url.placeholder = 'https://.....'
      url.value = model.replacement
      url.addEventListener('input', () => {
        model.replacement = url.value
      })
      rightPane.append(url, trackingChoices())
    }

    const run = h('button', 'br-run', '置換する') as HTMLButtonElement
    run.type = 'button'
    run.addEventListener('click', () => void doReplace())
    rightPane.append(run)
    if (model.lastRun !== null) rightPane.append(lastRunBox(model.lastRun))
  }

  /** 直前の置換の結果と「元に戻す」 */
  function lastRunBox(last: { undoId: string; versions: number; replaced: number }): HTMLElement {
    const box = h('div', 'br-result')
    box.append(
      h('div', 'br-result-text', `${last.versions}件のVersionで${last.replaced}箇所を置換しました。`),
      h('div', 'br-result-note', '置換した前後は各ページの「変更・復元履歴」にも残っています。'),
    )
    const undo = h('button', 'br-undo', '元に戻す') as HTMLButtonElement
    undo.type = 'button'
    undo.addEventListener('click', () => void doUndo(last))
    box.append(undo)
    return box
  }

  async function doUndo(last: { undoId: string; versions: number }): Promise<void> {
    const ok = await confirmCard({
      title: '直前の置換を元に戻します',
      message: `${last.versions}件のVersionを置換する前の本文に戻します。`,
      detail: '置換のあとで手で直したVersionは、その内容を消さないように戻しません。',
      submitLabel: '元に戻す',
    })
    if (!ok) return
    try {
      const res = await api.undoBulkReplace(last.undoId)
      model.lastRun = null
      toast(
        res.skipped === 0
          ? `${res.restored}件のVersionを元に戻しました`
          : `${res.restored}件を元に戻しました。${res.skipped}件は置換のあとで変更されていたため戻していません（変更・復元履歴から戻せます）`,
      )
      await loadTargets()
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  function imageInput(): HTMLElement {
    const wrap = h('div', 'br-upload')
    const drop = h('div', 'br-drop', 'クリックして画像を選択するかファイルをドラッグ&ドロップしてください')
    const file = document.createElement('input')
    file.type = 'file'
    file.accept = 'image/*'
    file.hidden = true
    const preview = document.createElement('img')
    preview.className = 'br-preview'
    preview.hidden = true

    const take = (f: File | undefined): void => {
      if (f === undefined) return
      const reader = new FileReader()
      reader.addEventListener('load', () => {
        model.replacement = String(reader.result ?? '')
        preview.src = model.replacement
        preview.hidden = false
        drop.textContent = f.name
      })
      reader.readAsDataURL(f)
    }
    drop.addEventListener('click', () => file.click())
    file.addEventListener('change', () => take(file.files?.[0]))
    drop.addEventListener('dragover', (e) => {
      e.preventDefault()
      drop.classList.add('over')
    })
    drop.addEventListener('dragleave', () => drop.classList.remove('over'))
    drop.addEventListener('drop', (e) => {
      e.preventDefault()
      drop.classList.remove('over')
      take(e.dataTransfer?.files?.[0])
    })
    if (model.replacement !== '') {
      preview.src = model.replacement
      preview.hidden = false
    }
    wrap.append(drop, preview, file)
    return wrap
  }

  function trackingChoices(): HTMLElement {
    const wrap = h('div', 'br-tracking')
    wrap.append(h('div', 'br-tracking-title', '計測機能'))
    for (const c of TRACKING_CHOICES) {
      const row = h('label', 'br-radio')
      const input = document.createElement('input')
      input.type = 'radio'
      input.name = 'br-tracking'
      input.checked = model.tracking === c.id
      input.addEventListener('change', () => {
        model.tracking = c.id
      })
      row.append(input, h('span', '', c.label))
      wrap.append(row)
    }
    return wrap
  }

  /* ══ 実行 ══ */
  async function loadTargets(): Promise<void> {
    if (model.selectedPages.size === 0) {
      model.results = []
      renderTargets()
      renderReplacement()
      return
    }
    try {
      const res = await api.bulkReplaceTargets({
        abTestUids: [...model.selectedPages],
        kind: model.kind,
        q: model.query.trim(),
      })
      // 画像・リンクは検索欄で絞り込む（テキストは検索語そのものが対象）
      const q = model.query.trim()
      model.results =
        model.kind === 'text' || q === ''
          ? res.pages
          : res.pages.map((p) => ({ ...p, rows: p.rows.filter((r) => r.label.includes(q)) }))
    } catch (e) {
      model.results = []
      toast((e as Error).message, 'error')
    }
    renderTargets()
    renderReplacement()
  }

  async function doReplace(): Promise<void> {
    const targets = collectReplaceTargets(model.results, model.checked, model.kind)
    if (targets.length === 0) {
      toast('置換対象を選択してください', 'error')
      return
    }
    if (model.replacement.trim() === '') {
      const what = model.kind === 'image' ? '新しい画像' : model.kind === 'link' ? '新しいリンク' : '新しい文字列'
      toast(`${what}を指定してください`, 'error')
      return
    }
    // 複数のLPをまとめて書き換えるので、何が変わるかを見せてから実行する
    const versionCount = new Set(targets.map((t) => t.version_uid)).size
    const what = model.kind === 'image' ? '画像' : model.kind === 'link' ? 'リンク' : '文字列'
    const ok = await confirmCard({
      title: `${versionCount}件のVersionを書き換えます`,
      message: `選んだ${targets.length}件の${what}を、新しい値に置き換えます。`,
      detail: '置換したあと、この画面の「元に戻す」で戻せます（置換したあとに手で直したVersionは戻しません）。',
      submitLabel: '置換する',
    })
    if (!ok) return

    try {
      const res = await api.bulkReplace({
        kind: model.kind,
        targets,
        replacement: model.replacement,
        tracking: model.tracking,
      })
      toast(`${res.versions}件のVersionで${res.replaced}箇所を置換しました`)
      model.lastRun =
        res.undo_id === null ? null : { undoId: res.undo_id, versions: res.versions, replaced: res.replaced }
      model.checked.clear()
      await loadTargets()
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  /** 今どこまで進んだかを手順に反映して出す */
  function renderGuide(): void {
    guideSlot.innerHTML = ''
    const guide = buildToolGuide({
      id: 'bulk-replace',
      summary:
        '複数のbeyondページの画像・テキスト・リンクを、まとめて置き換える画面です。置き換えた直後なら「元に戻す」で戻せます。',
      steps: [
        { label: 'フォルダを追加する', done: model.nodes.length > 0 },
        {
          label: model.kind === 'text' ? '文字列を検索してページを選ぶ' : '置き換えるページを選ぶ',
          done: model.selectedPages.size > 0,
        },
        { label: '対象にチェックを入れる', done: model.checked.size > 0 },
        { label: '新しい値を入れて置換する', done: false },
      ],
    })
    if (guide !== null) guideSlot.append(guide)
  }

  function renderAll(): void {
    for (const b of tabs.querySelectorAll('button')) {
      b.classList.toggle('on', b.dataset['kind'] === model.kind)
    }
    // 検索欄は種別で意味が変わる（テキストだけは「探す語」そのもの）
    targetSearch.placeholder =
      model.kind === 'text' ? '置き換えたい文字列を入力' : '置換対象をしぼり込む'
    renderGuide()
    renderTree()
    renderTargets()
    renderReplacement()
  }

  renderAll()
}

/* ── 小さな部品 ── */

function h(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function searchInput(placeholder: string): HTMLInputElement {
  const i = document.createElement('input')
  i.type = 'search'
  i.className = 'br-search'
  i.placeholder = placeholder
  return i
}

/** 実物の「⋮」＝ 置換対象全てを選択 / 置換対象全てを未選択 */
function dotsMenu(onAll: () => void, onNone: () => void): HTMLElement {
  const wrap = h('div', 'br-dots-wrap')
  const btn = h('button', 'br-dots', '⋮') as HTMLButtonElement
  btn.type = 'button'
  const menu = h('div', 'br-dots-menu')
  menu.hidden = true
  const all = h('button', 'br-dots-item', '置換対象全てを選択') as HTMLButtonElement
  const none = h('button', 'br-dots-item', '置換対象全てを未選択') as HTMLButtonElement
  all.type = 'button'
  none.type = 'button'
  all.addEventListener('click', onAll)
  none.addEventListener('click', onNone)
  menu.append(all, none)
  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    menu.hidden = !menu.hidden
    if (!menu.hidden) {
      const close = (): void => {
        menu.hidden = true
        document.removeEventListener('click', close)
      }
      setTimeout(() => document.addEventListener('click', close), 0)
    }
  })
  wrap.append(btn, menu)
  return wrap
}

function folderIcon(): string {
  return (
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></svg>'
  )
}

function injectStyles(): void {
  if (document.getElementById('br-css') !== null) return
  const s = document.createElement('style')
  s.id = 'br-css'
  s.textContent = `
    .br-page{display:flex;flex-direction:column;height:100%;min-height:0;font-size:13px;color:var(--sb-c-333333, #333333)}
    .br-bar{display:flex;flex-direction:row;align-items:center;gap:10px;padding:10px 14px;flex-shrink:0}
    .br-guide-slot{padding:12px 14px 0;flex-shrink:0}
    .br-folder-btn{height:26px;border:1px solid var(--sb-accent,#0091FF);border-radius:4px;background:var(--sb-c-ffffff, #FFFFFF);
      color:var(--sb-accent,#0091FF);display:flex;flex-direction:row;align-items:center;gap:5px;
      justify-content:center;cursor:pointer;padding:0 10px;white-space:nowrap}
    .br-folder-btn-label{font-size:11px;font-weight:600}
    .br-locked-note{font-size:10.5px;color:#999999;line-height:1.6;padding:4px 4px 6px 18px}
    .br-search{border:1px solid var(--sb-c-dddddd, #DDDDDD);border-radius:16px;padding:4px 12px;font-size:12px;width:190px}
    .br-tabs{display:flex;flex-direction:row;gap:4px;margin-left:6px}
    .br-tab{border:none;background:none;border-radius:4px;padding:4px 12px;font-size:12px;
      color:var(--sb-c-666666, #666666);cursor:pointer}
    .br-tab.on{background:var(--sb-accent,#0091FF);color:var(--sb-accent-ink,#FFFFFF);font-weight:600}
    .br-reset{margin-left:auto;border:1px solid var(--sb-c-dddddd, #DDDDDD);background:var(--sb-c-ffffff, #FFFFFF);border-radius:14px;
      padding:4px 14px;font-size:12px;color:var(--sb-accent,#0091FF);cursor:pointer}
    .br-panes{flex:1;min-height:0;display:grid;grid-template-columns:200px 1fr 340px;gap:10px;
      padding:0 14px 14px}
    .br-pane{background:var(--sb-c-f7f8fa, #F7F8FA);border-radius:6px;overflow:auto;padding:10px}
    .br-mid{background:var(--sb-c-fbfbfd, #FBFBFD)}
    .br-right{background:var(--sb-c-ffffff, #FFFFFF);border:1px solid var(--sb-c-eeeeee, #EEEEEE)}
    .br-hint{text-align:center;color:var(--sb-c-666666, #666666);font-size:12px;padding:14px 8px;font-weight:600}
    .br-group{font-size:12px;font-weight:700;color:var(--sb-c-333333, #333333);padding:2px 4px 8px}
    .br-folder{display:flex;flex-direction:row;align-items:center;gap:6px;padding:5px 4px;cursor:pointer;border-radius:4px}
    .br-folder:hover{background:var(--sb-c-eef1f5, #EEF1F5)}
    .br-folder-icon{width:12px;height:10px;background:var(--sb-accent,#0091FF);border-radius:2px;flex-shrink:0}
    .br-folder-name{flex:1;font-size:12px;color:var(--sb-c-333333, #333333)}
    .br-x{border:none;background:none;color:#999999;cursor:pointer;font-size:13px;padding:0 4px}
    .br-tree-page{display:flex;flex-direction:row;align-items:center;gap:6px;
      padding:4px 4px 4px 18px;cursor:pointer;border-radius:4px}
    .br-tree-page:hover{background:var(--sb-c-eef1f5, #EEF1F5)}
    .br-tree-page.locked{opacity:.45;cursor:default}
    .br-tree-page-name{font-size:12px}
    .br-list-head,.br-page-head{display:flex;flex-direction:row;align-items:center;gap:6px;padding:4px 2px}
    .br-list-title{flex:1;text-align:center;font-size:12px;font-weight:700}
    .br-page-head-name{flex:1;font-size:12px;font-weight:700;color:var(--sb-c-333333, #333333)}
    .br-dots-wrap{position:relative}
    .br-dots{border:none;background:none;cursor:pointer;color:var(--sb-c-666666, #666666);padding:0 4px;font-size:14px}
    .br-dots-menu{position:absolute;right:0;top:20px;background:var(--sb-c-ffffff, #FFFFFF);border:1px solid var(--sb-c-e0e0e0, #E0E0E0);
      border-radius:4px;box-shadow:0 4px 14px rgba(0,0,0,.12);z-index:40;min-width:170px}
    .br-dots-item{display:block;width:100%;text-align:left;border:none;background:none;
      padding:8px 12px;font-size:12px;color:var(--sb-c-333333, #333333);cursor:pointer}
    .br-dots-item:hover{background:#f2f5f9}
    .br-row{display:flex;flex-direction:row;align-items:center;gap:8px;padding:8px 6px;border-bottom:1px solid var(--sb-c-f0f0f0, #F0F0F0);
      cursor:pointer;border-radius:4px}
    .br-row:hover{background:#f2f5f9}
    .br-row.on{background:var(--sb-accent,#0091FF);color:var(--sb-accent-ink,#FFFFFF)}
    .br-row.on .br-row-ver{color:rgba(255,255,255,.8)}
    .br-thumb{width:38px;height:26px;object-fit:cover;border-radius:2px;background:var(--sb-c-e8e8e8, #E8E8E8);flex-shrink:0}
    .br-row-main{flex:1;min-width:0}
    .br-row-label{font-size:11px;line-height:1.5;word-break:break-all}
    .br-row-ver{font-size:10px;color:#999999;margin-top:2px}
    .br-count{font-size:11px;flex-shrink:0}
    .br-right-title{font-size:12px;font-weight:700;padding:2px 2px 10px;border-bottom:1px solid var(--sb-c-f0f0f0, #F0F0F0);
      margin-bottom:12px}
    .br-drop{border:1px dashed var(--sb-c-cccccc, #CCCCCC);border-radius:4px;padding:18px 12px;text-align:center;
      font-size:11px;color:#888888;cursor:pointer}
    .br-drop.over{border-color:var(--sb-accent,#0091FF);background:#f0f7ff}
    .br-preview{display:block;max-width:100%;margin-top:10px;border-radius:4px}
    .br-textarea{width:100%;min-height:74px;border:1px solid var(--sb-c-e4e4e4, #E4E4E4);border-radius:4px;
      padding:8px 10px;font:inherit;font-size:12px;background:var(--sb-c-f6f6f8, #F6F6F8);box-sizing:border-box;resize:vertical}
    .br-url{width:100%;border:1px solid var(--sb-c-e4e4e4, #E4E4E4);border-radius:4px;padding:7px 10px;
      font:inherit;font-size:12px;background:var(--sb-c-f6f6f8, #F6F6F8);box-sizing:border-box}
    .br-tracking{margin-top:12px}
    .br-tracking-title{font-size:11px;font-weight:700;margin-bottom:4px}
    .br-radio{display:flex;flex-direction:row;align-items:center;gap:5px;font-size:11px;color:var(--sb-c-333333, #333333);cursor:pointer;padding:1px 0}
    .br-result{margin-top:14px;padding:10px 12px;border-radius:4px;background:var(--sb-accent-tint, #E6F4FF)}
    .br-result-text{font-size:12px;font-weight:600;color:var(--sb-c-333333, #333333)}
    .br-result-note{font-size:11px;color:var(--sb-c-666666, #666666);margin-top:4px;line-height:1.6}
    .br-undo{margin-top:8px;border:1px solid var(--sb-accent,#0091FF);background:var(--sb-c-ffffff, #FFFFFF);
      color:var(--sb-accent,#0091FF);border-radius:4px;padding:5px 14px;font-size:12px;cursor:pointer}
    .br-run{width:100%;margin-top:14px;border:none;border-radius:4px;padding:9px;
      background:var(--sb-accent,#0091FF);color:var(--sb-accent-ink,#FFFFFF);font-size:13px;
      font-weight:600;cursor:pointer}
  `
  document.head.append(s)
}

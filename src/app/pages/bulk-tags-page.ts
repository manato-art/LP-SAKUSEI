/**
 * 一括タグ設定ページ（実SB「ツール>一括タグ」= /teams/tags）の機能実装。
 *
 * 実SBに合わせ、左＝設定一覧＋「タグ設定を追加」、右＝選択中の設定フォーム
 * （設定名 / 設定範囲(チーム・フォルダグループ・フォルダ) / 計測ツール・ASP / CV条件 /
 *  noindex / JavaScript HEAD-BODY / 削除）で構成する。保存はバックエンドの /bulk_tags へ。
 * 配信ページ(/lp)への差し込みは delivery.ts が bulkTagsForFolder で行う。
 */
import { api, type BulkTag, type Folder } from '../api.ts'
import { toast } from '../ui.ts'

const CV_OPTIONS: readonly [string, string][] = [
  ['', '指定なし'],
  ['click', 'クリック'],
  ['access', 'アクセス'],
]

export async function renderBulkTagsPage(host: HTMLElement): Promise<void> {
  injectStyles()
  host.innerHTML = ''
  const page = h('div', 'bt-page')
  host.append(page)

  let tags: BulkTag[] = []
  let folders: Folder[] = []
  let aspAccounts: { id: number; asp_name: string }[] = []
  try {
    const [tagsRes, foldersRes, aspRes] = await Promise.all([
      api.bulkTags(),
      api.folders(),
      api.aspAccounts().catch(() => ({ asp_accounts: [] as { id: number; asp_name: string }[] })),
    ])
    tags = tagsRes.bulk_tags
    folders = foldersRes.folders
    aspAccounts = aspRes.asp_accounts
  } catch (e) {
    page.append(h('div', 'bt-empty', 'error'))
    toast((e as Error).message, 'error')
    return
  }

  let selectedUid: string | null = tags[0]?.uid ?? null

  const layout = h('div', 'bt-layout')
  const listCol = h('div', 'bt-list')
  const formCol = h('div', 'bt-form')
  layout.append(listCol, formCol)
  page.append(layout)

  const rerenderList = (): void => {
    listCol.innerHTML = ''
    for (const t of tags) {
      const item = h('div', 'bt-list-item' + (t.uid === selectedUid ? ' active' : ''), t.name || '名前無し')
      item.addEventListener('click', () => {
        selectedUid = t.uid
        rerenderList()
        rerenderForm()
      })
      listCol.append(item)
    }
    const add = h('button', 'bt-add') as HTMLButtonElement
    add.type = 'button'
    add.innerHTML = '<span class="bt-add-plus">＋</span>タグ設定を追加'
    add.addEventListener('click', () => void onAdd())
    listCol.append(add)
  }

  const onAdd = async (): Promise<void> => {
    try {
      const { bulk_tag } = await api.createBulkTag()
      tags = [bulk_tag, ...tags]
      selectedUid = bulk_tag.uid
      rerenderList()
      rerenderForm()
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const rerenderForm = (): void => {
    formCol.innerHTML = ''
    const tag = tags.find((t) => t.uid === selectedUid) ?? null
    if (tag === null) {
      formCol.append(h('div', 'bt-empty', '「タグ設定を追加」から作成してください'))
      return
    }
    formCol.append(buildForm(tag, folders, aspAccounts, {
      onSave: async (patch) => {
        try {
          const { bulk_tag } = await api.updateBulkTag(tag.uid, patch)
          tags = tags.map((t) => (t.uid === tag.uid ? bulk_tag : t))
          rerenderList()
          toast('保存しました')
        } catch (e) {
          toast((e as Error).message, 'error')
        }
      },
      onDelete: async () => {
        try {
          await api.deleteBulkTag(tag.uid)
          tags = tags.filter((t) => t.uid !== tag.uid)
          selectedUid = tags[0]?.uid ?? null
          rerenderList()
          rerenderForm()
          toast('削除しました')
        } catch (e) {
          toast((e as Error).message, 'error')
        }
      },
    }))
  }

  rerenderList()
  rerenderForm()
}

interface FormHandlers {
  onSave: (patch: Record<string, unknown>) => Promise<void>
  onDelete: () => Promise<void>
}

function buildForm(
  tag: BulkTag,
  folders: readonly Folder[],
  aspAccounts: readonly { id: number; asp_name: string }[],
  handlers: FormHandlers,
): HTMLElement {
  const form = h('div', 'bt-form-inner')

  // 設定名
  const name = textInput(tag.name, '名前を入力してください')
  form.append(fieldBlock('設定名', name))

  // 設定範囲
  const scope = h('div', 'bt-section')
  scope.append(h('div', 'bt-section-title', '設定範囲'))

  // フォルダグループ（親フォルダ）／フォルダ（先に作る。チームtoggleから参照するため）
  const groupFolders = folders.filter((f) => f.parent_id === null)
  const groupSel = multiSelect(groupFolders, tag.folder_group_ids)
  const folderSel = multiSelect(folders, tag.folder_ids)

  // チーム: ONにすると全フォルダ対象＋フォルダグループ/フォルダ設定をリセット（実SB挙動）
  const teamToggle = toggle(tag.team_wide, (checked) => {
    if (checked) {
      groupSel.clear()
      folderSel.clear()
    }
    groupSel.setEnabled(!checked)
    folderSel.setEnabled(!checked)
  })
  const teamRow = scopeRow(
    'チーム',
    'ONにすると全てのフォルダにタグを設置します。またフォルダグループとフォルダ設定はリセットされます。',
    teamToggle.el,
  )
  scope.append(teamRow)
  scope.append(scopeRow('フォルダグループ', '選択したフォルダグループに属する全てのフォルダにタグを設置します。', groupSel.el))
  scope.append(scopeRow('フォルダ', '選択したフォルダにタグを設置します。', folderSel.el))
  form.append(scope)
  // 初期状態がチームONなら、フォルダ選択は無効化しておく
  if (tag.team_wide) {
    groupSel.setEnabled(false)
    folderSel.setEnabled(false)
  }

  // 計測ツール・ASP / CV条件 / noindex
  const opts = h('div', 'bt-section bt-opts')
  const aspOptions: [string, string][] = [
    ['', '指定なし'],
    ...aspAccounts.map((a) => [String(a.id), a.asp_name] as [string, string]),
  ]
  const aspSel = selectInput(aspOptions, tag.asp_account_id === null ? '' : String(tag.asp_account_id))
  const cvSel = selectInput(CV_OPTIONS, tag.cv_condition ?? '')
  const noindexToggle = toggle(tag.noindex)
  opts.append(
    fieldBlock('計測ツール・ASP', aspSel, 'ASPを設定すると連携用パラメーターを自動で付与します'),
    fieldBlock('CV条件', cvSel),
    fieldBlock('noindexを含める', noindexToggle.el, 'メタタグ設定で「noindexを含める」としていた場合、noindexは含まれます。'),
  )
  form.append(opts)

  // JavaScript設定 HEAD / BODY
  const js = h('div', 'bt-section')
  js.append(h('div', 'bt-section-title', 'JavaScript設定'))
  const headTa = codeArea(tag.head_js, '<script> ... </script>')
  const bodyTa = codeArea(tag.body_js, '<script> ... </script>')
  js.append(fieldBlock('HEAD', headTa), fieldBlock('BODY', bodyTa))
  form.append(js)

  // 保存 / 削除
  const actions = h('div', 'bt-actions')
  const saveBtn = h('button', 'bt-save', '保存') as HTMLButtonElement
  saveBtn.type = 'button'
  saveBtn.addEventListener('click', () => {
    const teamWide = teamToggle.get()
    void handlers.onSave({
      name: name.value,
      team_wide: teamWide,
      // チームONのときはフォルダグループ/フォルダはリセット（実SB挙動）
      folder_group_ids: teamWide ? [] : groupSel.get(),
      folder_ids: teamWide ? [] : folderSel.get(),
      asp_account_id: aspSel.value === '' ? null : Number(aspSel.value),
      cv_condition: cvSel.value === '' ? null : cvSel.value,
      noindex: noindexToggle.get(),
      head_js: headTa.value,
      body_js: bodyTa.value,
    })
  })
  const delBtn = h('button', 'bt-delete', 'タグ設定を削除') as HTMLButtonElement
  delBtn.type = 'button'
  delBtn.addEventListener('click', () => {
    if (confirm('このタグ設定を削除しますか？')) void handlers.onDelete()
  })
  actions.append(saveBtn, delBtn)
  form.append(actions)
  return form
}

// ── 小さなDOMヘルパー ─────────────────────────────────────
function h(tag: string, cls: string, text?: string): HTMLElement {
  const el = document.createElement(tag)
  el.className = cls
  if (text !== undefined) el.textContent = text
  return el
}

function fieldBlock(label: string, control: HTMLElement, hint?: string): HTMLElement {
  const b = h('div', 'bt-field')
  b.append(h('label', 'bt-label', label), control)
  if (hint !== undefined) b.append(h('div', 'bt-hint', hint))
  return b
}

function scopeRow(title: string, desc: string, control: HTMLElement): HTMLElement {
  const row = h('div', 'bt-scope-row')
  const left = h('div', 'bt-scope-left')
  left.append(h('div', 'bt-scope-title', title), h('div', 'bt-scope-desc', desc))
  const right = h('div', 'bt-scope-right')
  right.append(control)
  row.append(left, right)
  return row
}

function textInput(value: string, placeholder: string): HTMLInputElement {
  const i = document.createElement('input')
  i.type = 'text'
  i.className = 'bt-input'
  i.value = value
  i.placeholder = placeholder
  return i
}

function codeArea(value: string, placeholder: string): HTMLTextAreaElement {
  const t = document.createElement('textarea')
  t.className = 'bt-code'
  t.value = value
  t.placeholder = placeholder
  t.rows = 4
  t.spellcheck = false
  return t
}

function selectInput(options: readonly [string, string][], selected: string): HTMLSelectElement {
  const s = document.createElement('select')
  s.className = 'bt-input bt-select'
  for (const [v, l] of options) {
    const o = document.createElement('option')
    o.value = v
    o.textContent = l
    if (v === selected) o.selected = true
    s.append(o)
  }
  return s
}

function toggle(on: boolean, onChange?: (checked: boolean) => void): { el: HTMLElement; get: () => boolean } {
  const wrap = h('label', 'bt-toggle')
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.checked = on
  const track = h('span', 'bt-toggle-track')
  wrap.append(input, track)
  if (onChange !== undefined) input.addEventListener('change', () => onChange(input.checked))
  return { el: wrap, get: () => input.checked }
}

interface MultiSelect {
  el: HTMLElement
  get: () => number[]
  /** 全チェックを外す（チーム=ON時のリセット用） */
  clear: () => void
  /** 有効/無効の切替（チーム=ON時は選べなくする） */
  setEnabled: (enabled: boolean) => void
}

/** 複数選択（フォルダ/グループ）。チェックボックスの簡易リスト。 */
function multiSelect(items: readonly Folder[], selectedIds: number[]): MultiSelect {
  const wrap = h('div', 'bt-multi')
  const set = new Set(selectedIds)
  const inputs: { id: number; input: HTMLInputElement }[] = []
  if (items.length === 0) {
    wrap.append(h('div', 'bt-hint', '対象がありません'))
  }
  for (const f of items) {
    const lb = h('label', 'bt-multi-item')
    const cb = document.createElement('input')
    cb.type = 'checkbox'
    cb.checked = set.has(f.id)
    lb.append(cb, h('span', 'bt-multi-name', f.name))
    wrap.append(lb)
    inputs.push({ id: f.id, input: cb })
  }
  return {
    el: wrap,
    get: () => inputs.filter((x) => x.input.checked).map((x) => x.id),
    clear: () => inputs.forEach((x) => (x.input.checked = false)),
    setEnabled: (enabled) => {
      wrap.style.opacity = enabled ? '1' : '.5'
      inputs.forEach((x) => (x.input.disabled = !enabled))
    },
  }
}

function injectStyles(): void {
  if (document.getElementById('bt-page-css') !== null) return
  const style = document.createElement('style')
  style.id = 'bt-page-css'
  style.textContent = `
    .bt-page { padding:24px; background:#f5f7fa; min-height:calc(100vh - 100px); box-sizing:border-box; font-family:"Hiragino Sans","Noto Sans JP",sans-serif; }
    .bt-layout { display:grid; grid-template-columns:240px 1fr; gap:20px; align-items:start; max-width:1200px; }
    @media (max-width:860px){ .bt-layout { grid-template-columns:1fr; } }
    .bt-list { display:flex; flex-direction:column; gap:6px; }
    .bt-list-item { padding:12px 14px; background:#fff; border:1px solid #e6e8ec; border-radius:8px; font-size:13px; color:#48526b; cursor:pointer; }
    .bt-list-item:hover { background:#f0f4ff; }
    .bt-list-item.active { border-color:#0091ff; color:#0091ff; font-weight:700; background:#f0f7ff; }
    .bt-add { margin-top:4px; padding:11px 14px; font-size:13px; font-weight:700; color:#0091ff; background:#eaf5ff; border:1px dashed #9fd0ff; border-radius:8px; cursor:pointer; }
    .bt-add-plus { margin-right:6px; }
    .bt-form { min-width:0; }
    .bt-form-inner { display:flex; flex-direction:column; gap:18px; background:#fff; border:1px solid #e6e8ec; border-radius:12px; padding:22px 24px; }
    .bt-empty { color:#8a94a6; font-size:13px; padding:24px; }
    .bt-field { display:flex; flex-direction:column; gap:5px; }
    .bt-label { font-size:12.5px; font-weight:600; color:#48526b; }
    .bt-hint { font-size:11px; color:#9aa3b2; }
    .bt-input { width:100%; box-sizing:border-box; padding:9px 12px; font-size:13.5px; border:1px solid #d6dae1; border-radius:8px; outline:none; }
    .bt-input:focus { border-color:#0091ff; box-shadow:0 0 0 3px rgba(0,145,255,.12); }
    .bt-select { cursor:pointer; }
    .bt-code { width:100%; box-sizing:border-box; padding:10px 12px; font-family:ui-monospace,Menlo,Consolas,monospace; font-size:12.5px; color:#e6edf3; background:#0d1117; border:1px solid #30363d; border-radius:8px; resize:vertical; outline:none; }
    .bt-section { display:flex; flex-direction:column; gap:12px; border-top:1px solid #eef0f3; padding-top:16px; }
    .bt-section-title { font-size:13px; font-weight:700; color:#2f3a4d; }
    .bt-opts { }
    .bt-scope-row { display:flex; gap:16px; align-items:flex-start; justify-content:space-between; background:#fafbfc; border:1px solid #eef0f3; border-radius:8px; padding:12px 14px; }
    .bt-scope-left { max-width:60%; }
    .bt-scope-title { font-size:13px; font-weight:700; color:#1a2233; }
    .bt-scope-desc { font-size:11px; color:#8a94a6; margin-top:2px; line-height:1.5; }
    .bt-scope-right { flex-shrink:0; }
    .bt-multi { display:flex; flex-direction:column; gap:4px; max-height:140px; overflow:auto; min-width:180px; }
    .bt-multi-item { display:flex; align-items:center; gap:6px; font-size:12.5px; color:#48526b; }
    .bt-toggle { position:relative; display:inline-flex; width:44px; height:24px; cursor:pointer; }
    .bt-toggle input { position:absolute; opacity:0; width:0; height:0; }
    .bt-toggle-track { width:44px; height:24px; border-radius:12px; background:#cfd5de; transition:background .15s; position:relative; }
    .bt-toggle-track::after { content:""; position:absolute; top:2px; left:2px; width:20px; height:20px; border-radius:50%; background:#fff; box-shadow:0 1px 2px rgba(0,0,0,.2); transition:transform .15s; }
    .bt-toggle input:checked + .bt-toggle-track { background:#0091ff; }
    .bt-toggle input:checked + .bt-toggle-track::after { transform:translateX(20px); }
    .bt-actions { display:flex; gap:12px; align-items:center; border-top:1px solid #eef0f3; padding-top:16px; }
    .bt-save { padding:10px 26px; font-size:14px; font-weight:700; color:#fff; background:#0091ff; border:none; border-radius:8px; cursor:pointer; }
    .bt-save:hover { background:#007ee0; }
    .bt-delete { margin-left:auto; padding:9px 18px; font-size:12.5px; color:#d64545; background:#fff; border:1px solid #f0b4b4; border-radius:8px; cursor:pointer; }
  `
  document.head.append(style)
}

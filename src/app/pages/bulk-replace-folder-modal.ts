/**
 * マジック置換の「置換対象フォルダ選択」モーダル（実SB準拠）。
 *
 * 実物を 2026-09-10 に実機で確認した構成:
 *   閉じる ／ 置換対象フォルダ選択 ／ 追加する
 *   フォルダグループ  [フォルダグループ名検索] [グループを選択してください ▾]
 *   フォルダ          [フォルダ名検索]
 *   終了済みbeyondページ  ○含まない  ○含む
 *   □ フォルダ名 …（グループを選ぶまでは「グループを選択してください」と出る）
 *
 * クローンのフォルダはグループを持たない（`parent_id` は常に null）ので、
 * 選択肢は「グループなし」＋子を持つフォルダ、という素直な作りにしてある。
 */
import type { Folder } from '../api.ts'

export interface FolderPickResult {
  /** 選んだフォルダ */
  folders: Folder[]
  /** グループ名（左ペインの見出しに出す） */
  groupName: string
  /** 終了済みbeyondページも対象にするか */
  includeFinished: boolean
}

const NO_GROUP = 'ungroup'

/** モーダルを開く。追加されたら resolve、閉じたら null。 */
export function openFolderPicker(folders: readonly Folder[]): Promise<FolderPickResult | null> {
  return new Promise((resolve) => {
    const overlay = el('div', 'brf-overlay')
    const box = el('div', 'brf-box')
    overlay.append(box)

    const head = el('div', 'brf-head')
    const close = button('閉じる', 'brf-btn-ghost')
    const title = el('span', 'brf-title', '置換対象フォルダ選択')
    const add = button('追加する', 'brf-btn-primary')
    head.append(close, title, add)

    /* ── フォルダグループ ── */
    const groupRow = el('div', 'brf-row')
    groupRow.append(el('span', 'brf-label', 'フォルダグループ'))
    const groupSearch = search('フォルダグループ名検索')
    groupRow.append(groupSearch)

    const groupSelect = document.createElement('select')
    groupSelect.className = 'brf-select'

    /* ── フォルダ ── */
    const folderRow = el('div', 'brf-row')
    folderRow.append(el('span', 'brf-label', 'フォルダ'))
    const folderSearch = search('フォルダ名検索')
    folderRow.append(folderSearch)

    /* ── 終了済みbeyondページ ── */
    const finishedRow = el('div', 'brf-row brf-finished')
    finishedRow.append(el('span', 'brf-label', '終了済みbeyondページ'))
    const [noFinished, noFinishedInput] = radio('brf-finished', '含まない', true)
    const [yesFinished, yesFinishedInput] = radio('brf-finished', '含む', false)
    finishedRow.append(noFinished, yesFinished)

    const list = el('div', 'brf-list')
    const empty = el('div', 'brf-empty', 'グループを選択してください')

    const body = el('div', 'brf-body')
    body.append(groupRow, groupSelect, folderRow, finishedRow, list, empty)
    box.append(head, body)

    /* ── グループの選択肢 ── */
    const parentIds = new Set(folders.map((f) => f.parent_id).filter((id): id is number => id !== null))
    const groups = folders.filter((f) => parentIds.has(f.id))

    function fillGroups(): void {
      const q = groupSearch.value.trim()
      groupSelect.innerHTML = ''
      groupSelect.append(option('no_selection', 'グループを選択してください'))
      if (q === '' || 'グループなし'.includes(q)) {
        groupSelect.append(option(NO_GROUP, 'グループなし'))
      }
      for (const g of groups) {
        if (q === '' || g.name.includes(q)) groupSelect.append(option(String(g.id), g.name))
      }
    }
    fillGroups()
    groupSearch.addEventListener('input', fillGroups)

    /* ── フォルダ一覧 ── */
    const checked = new Set<string>()
    function fillFolders(): void {
      const value = groupSelect.value
      list.innerHTML = ''
      if (value === 'no_selection' || value === '') {
        empty.hidden = false
        finishedRow.hidden = true
        return
      }
      empty.hidden = true
      finishedRow.hidden = false
      const q = folderSearch.value.trim()
      const inGroup =
        value === NO_GROUP
          ? folders.filter((f) => f.parent_id === null && !parentIds.has(f.id))
          : folders.filter((f) => String(f.parent_id) === value)
      const shown = inGroup.filter((f) => q === '' || f.name.includes(q))
      if (shown.length === 0) {
        list.append(el('div', 'brf-empty', 'フォルダがありません'))
        return
      }
      for (const f of shown) {
        const row = el('label', 'brf-item')
        const box2 = document.createElement('input')
        box2.type = 'checkbox'
        box2.checked = checked.has(f.uid)
        box2.addEventListener('change', () => {
          if (box2.checked) checked.add(f.uid)
          else checked.delete(f.uid)
        })
        row.append(box2, el('span', 'brf-item-name', f.name))
        list.append(row)
      }
    }
    groupSelect.addEventListener('change', fillFolders)
    folderSearch.addEventListener('input', fillFolders)
    fillFolders()

    /* ── 決定 ── */
    const finish = (result: FolderPickResult | null): void => {
      overlay.remove()
      resolve(result)
    }
    close.addEventListener('click', () => finish(null))
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish(null)
    })
    add.addEventListener('click', () => {
      const picked = folders.filter((f) => checked.has(f.uid))
      if (picked.length === 0) {
        finish(null)
        return
      }
      const selected = groupSelect.selectedOptions[0]?.textContent ?? ''
      finish({
        folders: picked,
        groupName: selected,
        includeFinished: yesFinishedInput.checked && !noFinishedInput.checked,
      })
    })

    injectStyles()
    document.body.append(overlay)
  })
}

/* ── 小さな部品 ── */

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function button(text: string, className: string): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = className
  b.textContent = text
  return b
}

function search(placeholder: string): HTMLInputElement {
  const i = document.createElement('input')
  i.type = 'search'
  i.className = 'brf-search'
  i.placeholder = placeholder
  return i
}

function option(value: string, label: string): HTMLOptionElement {
  const o = document.createElement('option')
  o.value = value
  o.textContent = label
  return o
}

function radio(name: string, label: string, checked: boolean): [HTMLElement, HTMLInputElement] {
  const wrap = el('label', 'brf-radio')
  const input = document.createElement('input')
  input.type = 'radio'
  input.name = name
  input.checked = checked
  wrap.append(input, el('span', '', label))
  return [wrap, input]
}

function injectStyles(): void {
  if (document.getElementById('brf-css') !== null) return
  const s = document.createElement('style')
  s.id = 'brf-css'
  s.textContent = `
    .brf-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:9600;
      display:flex;align-items:flex-start;justify-content:center;padding-top:40px}
    .brf-box{background:#fff;border-radius:8px;width:480px;max-width:92vw;
      box-shadow:0 8px 32px rgba(0,0,0,.2);overflow:hidden}
    .brf-head{display:flex;flex-direction:row;align-items:center;gap:12px;padding:10px 12px;border-bottom:1px solid #eee}
    .brf-title{flex:1;text-align:center;font-size:13px;font-weight:600;color:#333}
    .brf-btn-ghost{border:1px solid var(--sb-accent,#0091FF);background:#fff;
      color:var(--sb-accent,#0091FF);border-radius:4px;padding:4px 14px;font-size:12px;cursor:pointer}
    .brf-btn-primary{border:none;background:var(--sb-accent,#0091FF);color:var(--sb-accent-ink,#fff);
      border-radius:4px;padding:5px 14px;font-size:12px;cursor:pointer}
    .brf-body{padding:14px 16px 18px}
    .brf-row{display:flex;flex-direction:row;align-items:center;gap:10px;margin-bottom:8px}
    .brf-label{font-size:12px;font-weight:600;color:#333;white-space:nowrap}
    .brf-search{flex:1;border:1px solid #ddd;border-radius:16px;padding:4px 12px;font-size:12px;min-width:0}
    .brf-select{width:100%;border:1px solid #ddd;border-radius:4px;padding:6px 8px;
      font-size:13px;margin-bottom:10px;background:#fff}
    .brf-finished{gap:14px}
    .brf-radio{display:flex;flex-direction:row;align-items:center;gap:4px;font-size:12px;color:#333;cursor:pointer}
    .brf-list{max-height:240px;overflow:auto;border-top:1px solid #f0f0f0;margin-top:6px}
    .brf-item{display:flex;flex-direction:row;align-items:center;gap:8px;padding:7px 4px;font-size:13px;
      color:#333;cursor:pointer;border-bottom:1px solid #f5f5f5}
    .brf-item:hover{background:#f8f9fb}
    .brf-empty{font-size:12px;color:#999;padding:10px 4px}
  `
  document.head.append(s)
}

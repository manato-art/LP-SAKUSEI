/**
 * 審査（実SB「ツール > 審査」）の機能実装。
 *
 * 実物を 2026-09-10 に実機で確認したところ、**2画面**あって役割が違った:
 *
 *   /inspections          「審査」    … Version / ポップアップ の2タブ、
 *                                      絞り込み すべて / 審査待ち / 審査中 / 承認済 / 非承認、
 *                                      左に グループリスト と グループにいないフォルダ、
 *                                      並び替えボタンと「beyondページURL検索」
 *   /inspections/folders  「審査対象」 … フォルダごとのトグル。
 *                                      ONにしたフォルダのものだけが審査に並ぶ
 *
 * 実際、審査対象が1つもONでない状態では審査画面のツリーは見出しだけで中身が空だった。
 *
 * ## 採取・観測できなかったもの（推測で作っていない）
 * 審査対象をONにした状態の /inspections（＝実際に審査するときの右ペイン）は、
 * ユーザーのアカウント設定を書き換えないと見られないため確認していない。
 * ここでは観測できた枠（2タブ・絞り込み・一覧）までを作り、
 * 状態の変更は一覧の行から行う形にしている。
 */
import { api, type InspectionEntry, type InspectionFolder } from '../api.ts'
import { toast } from '../ui.ts'
import { buildToolGuide } from './tool-guide.ts'
import { FAVORITE_STAR_COLOR } from './folders-detail-panel.ts'

type Kind = 'version' | 'popup'

const STATUS_CHIPS: readonly [string, string][] = [
  ['all', 'すべて'],
  ['waiting', '審査待ち'],
  ['reviewing', '審査中'],
  ['approved', '承認済'],
  ['rejected', '非承認'],
]

/** 状態を進める操作（実物のチップと同じ言葉を使う） */
const ACTIONS: readonly [string, string][] = [
  ['reviewing', '審査中にする'],
  ['approved', '承認する'],
  ['rejected', '非承認にする'],
  ['waiting', '審査待ちに戻す'],
]

/** 審査対象（/inspections/folders）。フォルダごとのトグル。 */
export async function renderInspectionTargets(host: HTMLElement): Promise<void> {
  injectStyles()
  host.innerHTML = ''
  const root = h('div', 'ins-page')
  host.append(root)

  const guide = buildToolGuide({
    id: 'inspection-targets',
    summary:
      'どのフォルダを審査にかけるかを決める画面です。ここでONにしたフォルダのVersionだけが「審査」に並びます。',
    steps: [{ label: '審査したいフォルダをONにする' }, { label: '「審査」画面で承認する' }],
    action: {
      label: '審査画面へ →',
      onClick: () => {
        location.hash = '#/inspections'
      },
    },
  })
  if (guide !== null) root.append(guide)

  const bar = h('div', 'ins-bar')
  const sort = iconButton('↑↓', '並び替え')
  const search = searchInput('グループ/フォルダ/ドメイン/beyondページ名')
  const urlSearch = h('button', 'ins-link', 'beyondページURL検索') as HTMLButtonElement
  urlSearch.type = 'button'
  urlSearch.addEventListener('click', openUrlSearch)
  bar.append(sort, search, urlSearch)
  const note = h('div', 'ins-note', '※beyondページ名はお気に入りのみ有効')
  const body = h('div', 'ins-target-body')
  root.append(bar, note, body)

  let asc = true
  sort.addEventListener('click', () => {
    asc = !asc
    void draw()
  })
  search.addEventListener('input', () => void draw())

  async function draw(): Promise<void> {
    body.innerHTML = ''
    let data: { groups: (InspectionFolder & { folders: InspectionFolder[] })[]; ungrouped: InspectionFolder[] }
    try {
      data = await api.inspectionFolders()
    } catch (e) {
      toast((e as Error).message, 'error')
      return
    }
    const q = search.value.trim()
    const order = (a: InspectionFolder, b: InspectionFolder): number =>
      asc ? a.name.localeCompare(b.name, 'ja') : b.name.localeCompare(a.name, 'ja')

    const groupBox = h('div', 'ins-box')
    groupBox.append(h('div', 'ins-box-title', 'グループリスト'))
    for (const g of [...data.groups].sort(order)) {
      const row = h('div', 'ins-group-row')
      row.append(h('span', 'ins-caret', '⌄'), h('span', 'ins-group-name', g.name))
      if (g.is_favorite) row.append(h('span', 'ins-star', '★'))
      groupBox.append(row)
      for (const f of [...g.folders].sort(order)) {
        if (q !== '' && !f.name.includes(q)) continue
        groupBox.append(folderRow(f, true))
      }
    }
    body.append(groupBox)

    const otherBox = h('div', 'ins-box')
    otherBox.append(h('div', 'ins-box-title', 'グループにいないフォルダ'))
    const shown = [...data.ungrouped].sort(order).filter((f) => q === '' || f.name.includes(q))
    for (const f of shown) otherBox.append(folderRow(f, false))
    if (shown.length === 0) otherBox.append(h('div', 'ins-empty', 'フォルダがありません'))
    body.append(otherBox)
  }

  function folderRow(f: InspectionFolder, nested: boolean): HTMLElement {
    const row = h('div', `ins-folder-row${nested ? ' nested' : ''}`)
    row.append(h('span', 'ins-folder-icon'), h('span', 'ins-folder-name', f.name))
    const toggle = h('button', `ins-toggle${f.inspection_target ? ' on' : ''}`) as HTMLButtonElement
    toggle.type = 'button'
    toggle.title = f.inspection_target ? '審査対象から外す' : '審査対象にする'
    toggle.append(h('span', 'ins-knob'))
    toggle.addEventListener('click', () => {
      void (async () => {
        try {
          await api.setInspectionTarget(f.uid, !f.inspection_target)
          await draw()
        } catch (e) {
          toast((e as Error).message, 'error')
        }
      })()
    })
    row.append(toggle)
    return row
  }

  await draw()
}

/** 審査（/inspections）。審査対象のフォルダのものだけが並ぶ。 */
export async function renderInspections(host: HTMLElement): Promise<void> {
  injectStyles()
  host.innerHTML = ''
  const root = h('div', 'ins-page')
  host.append(root)

  let kind: Kind = 'version'
  let status = 'all'

  const guide = buildToolGuide({
    id: 'inspections',
    summary:
      '公開前のVersionを承認する画面です。先に「審査対象」でフォルダをONにしないと、ここには何も並びません。',
    steps: [
      { label: '「審査対象」でフォルダをONにする' },
      { label: '並んだVersionを承認 / 非承認にする' },
    ],
    action: {
      label: '審査対象を設定する →',
      onClick: () => {
        location.hash = '#/inspections/folders'
      },
    },
  })
  if (guide !== null) root.append(guide)

  const tabs = h('div', 'ins-tabs')
  for (const [id, label] of [
    ['version', 'Version'],
    ['popup', 'ポップアップ'],
  ] as [Kind, string][]) {
    const b = h('button', 'ins-tab', label) as HTMLButtonElement
    b.type = 'button'
    b.dataset['kind'] = id
    b.addEventListener('click', () => {
      kind = id
      void draw()
    })
    tabs.append(b)
  }

  const bar = h('div', 'ins-bar')
  const sort = iconButton('↑↓', '並び替え')
  const urlSearch = h('button', 'ins-link', 'beyondページURL検索') as HTMLButtonElement
  urlSearch.type = 'button'
  urlSearch.addEventListener('click', openUrlSearch)
  const chips = h('div', 'ins-chips')
  bar.append(sort, urlSearch, chips)

  const search = searchInput('グループ/フォルダ/ドメイン/beyondページ名')
  const note = h('div', 'ins-note', '※beyondページ名はお気に入りのみ有効')
  const list = h('div', 'ins-list')
  root.append(tabs, bar, search, note, list)

  for (const [id, label] of STATUS_CHIPS) {
    const c = h('button', `ins-chip s-${id}`, label) as HTMLButtonElement
    c.type = 'button'
    c.dataset['status'] = id
    c.addEventListener('click', () => {
      status = id
      void draw()
    })
    chips.append(c)
  }
  search.addEventListener('input', () => void draw())
  sort.addEventListener('click', () => void draw())

  async function draw(): Promise<void> {
    for (const b of tabs.querySelectorAll('button')) {
      b.classList.toggle('on', b.dataset['kind'] === kind)
    }
    for (const c of chips.querySelectorAll('button')) {
      c.classList.toggle('on', c.dataset['status'] === status)
    }
    list.innerHTML = ''
    let data: { entries: InspectionEntry[]; counts: Record<string, number>; total: number }
    try {
      data = await api.inspectionEntries({ kind, status, q: search.value.trim() })
    } catch (e) {
      toast((e as Error).message, 'error')
      return
    }
    for (const [id] of STATUS_CHIPS) {
      const c = chips.querySelector<HTMLElement>(`[data-status="${id}"]`)
      if (c === null) continue
      const n = id === 'all' ? data.total : (data.counts[id] ?? 0)
      c.textContent = `${STATUS_CHIPS.find(([s]) => s === id)?.[1] ?? ''} ${n}`
    }
    if (data.entries.length === 0) {
      const box = h('div', 'ins-empty')
      if (data.total === 0) {
        // 行き止まりにしない。ここから審査対象へ行けるようにする。
        box.append(
          h('div', 'ins-empty-title', 'まだ審査するものがありません'),
          h(
            'div',
            'ins-empty-body',
            '審査は「審査対象」でONにしたフォルダのVersionだけが並びます。まず対象のフォルダを選んでください。',
          ),
        )
        const go = h('button', 'ins-empty-btn', '審査対象を設定する') as HTMLButtonElement
        go.type = 'button'
        go.addEventListener('click', () => {
          location.hash = '#/inspections/folders'
        })
        box.append(go)
      } else {
        box.append(h('div', 'ins-empty-body', 'この絞り込みに当てはまるものはありません。'))
      }
      list.append(box)
      return
    }
    for (const e of data.entries) list.append(entryRow(e))
  }

  function entryRow(e: InspectionEntry): HTMLElement {
    const row = h('div', 'ins-entry')
    const main = h('div', 'ins-entry-main')
    main.append(
      h('div', 'ins-entry-name', e.name),
      h('div', 'ins-entry-path', `${e.folder_name} / ${e.ab_test_title}`),
    )
    const label = STATUS_CHIPS.find(([id]) => id === e.status)?.[1] ?? e.status
    const badge = h('span', `ins-badge s-${e.status}`, label)
    const actions = h('div', 'ins-entry-actions')
    for (const [id, text] of ACTIONS) {
      if (id === e.status) continue
      const b = h('button', 'ins-act', text) as HTMLButtonElement
      b.type = 'button'
      b.addEventListener('click', () => {
        void (async () => {
          try {
            await api.setInspectionStatus(e.uid, { kind: e.kind, status: id })
            await draw()
            toast(`${text.replace(/にする|する|に戻す/, '')}にしました`)
          } catch (err) {
            toast((err as Error).message, 'error')
          }
        })()
      })
      actions.append(b)
    }
    row.append(main, badge, actions)
    return row
  }

  await draw()
}

/** 実物の「beyondページURL検索」モーダル */
function openUrlSearch(): void {
  const overlay = h('div', 'ins-overlay')
  const box = h('div', 'ins-modal')
  box.append(h('div', 'ins-modal-title', 'beyondページURL検索'))
  const url = document.createElement('input')
  url.type = 'text'
  url.className = 'ins-input'
  url.placeholder = 'beyondページURL / プレビューURL / 中間ページURL'
  box.append(url)
  box.append(h('div', 'ins-note', 'パス検索(URL先頭が優先されます)'))
  const pathRow = h('div', 'ins-path-row')
  const uid = document.createElement('input')
  uid.type = 'text'
  uid.className = 'ins-input'
  uid.placeholder = 'uid'
  pathRow.append(h('span', 'ins-path-prefix', '/ab/'), uid)
  box.append(pathRow)
  const go = h('button', 'ins-search', '検索') as HTMLButtonElement
  go.type = 'button'
  go.addEventListener('click', () => {
    const value = url.value.trim() !== '' ? url.value.trim() : uid.value.trim()
    if (value === '') {
      toast('URLかuidを入れてください', 'error')
      return
    }
    // 実物と同じく、当たったページの審査へ移動する。クローンでは配信URLのuidで探す。
    const found = /\/ab\/([A-Za-z0-9]+)/.exec(value)?.[1] ?? value
    location.hash = `#/ab_tests/${found}/articles`
    overlay.remove()
  })
  box.append(go)
  overlay.append(box)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove()
  })
  document.body.append(overlay)
}

/* ── 小さな部品 ── */

function h(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function iconButton(text: string, title: string): HTMLButtonElement {
  const b = h('button', 'ins-icon-btn', text) as HTMLButtonElement
  b.type = 'button'
  b.title = title
  return b
}

function searchInput(placeholder: string): HTMLInputElement {
  const i = document.createElement('input')
  i.type = 'search'
  i.className = 'ins-search-input'
  i.placeholder = placeholder
  return i
}

function injectStyles(): void {
  if (document.getElementById('ins-css') !== null) return
  const s = document.createElement('style')
  s.id = 'ins-css'
  s.textContent = `
    .ins-page{display:flex;flex-direction:column;height:100%;min-height:0;font-size:13px;
      color:#333;padding:14px 18px;box-sizing:border-box;gap:8px}
    .ins-tabs{display:flex;flex-direction:row;justify-content:center;gap:60px;flex-shrink:0}
    .ins-tab{border:none;background:none;font-size:13px;color:#666;cursor:pointer;padding:5px 16px;border-radius:4px}
    .ins-tab.on{background:#eef0f4;color:#111;font-weight:600}
    .ins-bar{display:flex;flex-direction:row;align-items:center;gap:10px;flex-wrap:wrap}
    .ins-icon-btn{width:28px;height:24px;border:1px solid #ddd;border-radius:4px;background:#fff;
      color:var(--sb-accent,#0091FF);cursor:pointer;font-size:11px}
    .ins-link{border:none;background:none;color:var(--sb-accent,#0091FF);font-size:12px;
      font-weight:600;cursor:pointer;padding:0}
    .ins-chips{display:flex;flex-direction:row;gap:6px;margin-left:auto}
    .ins-chip{border:none;border-radius:12px;padding:3px 12px;font-size:11px;cursor:pointer;
      background:#f0f1f4;color:#666}
    .ins-chip.on{background:var(--sb-accent,#0091FF);color:var(--sb-accent-ink,#fff)}
    .ins-chip.s-waiting.on{background:#8A5B00}
    .ins-chip.s-reviewing.on{background:#185E8C}
    .ins-chip.s-approved.on{background:#1B6B45}
    .ins-chip.s-rejected.on{background:#A33017}
    .ins-search-input{border:1px solid #ddd;border-radius:4px;padding:6px 10px;font-size:12px;width:100%;
      box-sizing:border-box}
    .ins-note{font-size:11px;color:#999}
    .ins-target-body,.ins-list{flex:1;min-height:0;overflow:auto}
    .ins-box{background:#f2f3f5;border-radius:6px;padding:12px 14px;margin-bottom:14px}
    .ins-box-title{font-size:12px;font-weight:700;margin-bottom:8px}
    .ins-group-row{display:flex;flex-direction:row;align-items:center;gap:6px;padding:6px 2px}
    .ins-caret{color:#888;font-size:11px}
    .ins-group-name{flex:1;font-size:12px}
    .ins-star{color:${FAVORITE_STAR_COLOR}}
    .ins-folder-row{display:flex;flex-direction:row;align-items:center;gap:8px;padding:8px 2px;
      background:#fff;border-radius:4px;margin-bottom:6px;padding-left:10px}
    .ins-folder-row.nested{margin-left:18px}
    .ins-folder-icon{width:12px;height:10px;background:var(--sb-accent,#0091FF);border-radius:2px;flex-shrink:0}
    .ins-folder-name{flex:1;font-size:12px}
    .ins-toggle{width:34px;height:18px;border:none;border-radius:9px;background:#d5d7dc;
      position:relative;cursor:pointer;padding:0;flex-shrink:0;margin-right:8px}
    .ins-toggle.on{background:var(--sb-accent,#0091FF)}
    .ins-knob{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
      background:#fff;transition:left .15s}
    .ins-toggle.on .ins-knob{left:18px}
    .ins-empty{font-size:12px;color:#888;padding:28px 4px;text-align:center}
    .ins-empty-title{font-size:14px;font-weight:700;color:#333;margin-bottom:6px}
    .ins-empty-body{font-size:12px;color:#777;line-height:1.8;max-width:34em;margin:0 auto}
    .ins-empty-btn{margin-top:14px;border:none;border-radius:4px;padding:8px 20px;
      background:var(--sb-accent,#0091FF);color:var(--sb-accent-ink,#fff);font-size:12px;cursor:pointer}
    .ins-entry{display:flex;flex-direction:row;align-items:center;gap:10px;padding:10px 12px;
      border:1px solid #eee;border-radius:6px;margin-bottom:8px;background:#fff}
    .ins-entry-main{flex:1;min-width:0}
    .ins-entry-name{font-size:13px;font-weight:600}
    .ins-entry-path{font-size:11px;color:#999;margin-top:2px}
    .ins-badge{font-size:11px;border-radius:10px;padding:2px 10px;white-space:nowrap;
      background:#f0f1f4;color:#666}
    .ins-badge.s-waiting{background:#FBF2E0;color:#8A5B00}
    .ins-badge.s-reviewing{background:#E5F0F7;color:#185E8C}
    .ins-badge.s-approved{background:#E4F2EA;color:#1B6B45}
    .ins-badge.s-rejected{background:#FBEBE7;color:#A33017}
    .ins-entry-actions{display:flex;flex-direction:row;gap:6px}
    .ins-act{border:1px solid #ddd;background:#fff;border-radius:4px;padding:4px 10px;
      font-size:11px;color:#555;cursor:pointer;white-space:nowrap}
    .ins-act:hover{border-color:var(--sb-accent,#0091FF);color:var(--sb-accent,#0091FF)}
    .ins-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:9600;
      display:flex;align-items:center;justify-content:center}
    .ins-modal{background:#fff;border-radius:8px;padding:20px 22px;width:420px;max-width:92vw;
      box-shadow:0 8px 32px rgba(0,0,0,.2)}
    .ins-modal-title{font-size:13px;font-weight:600;margin-bottom:14px}
    .ins-input{width:100%;border:1px solid #ddd;border-radius:4px;padding:8px 10px;
      font:inherit;font-size:12px;box-sizing:border-box}
    .ins-path-row{display:flex;flex-direction:row;align-items:center;gap:6px;margin-top:4px}
    .ins-path-prefix{font-size:12px;color:#666}
    .ins-search{margin-top:16px;border:none;border-radius:4px;padding:6px 18px;
      background:var(--sb-accent,#0091FF);color:var(--sb-accent-ink,#fff);font-size:12px;cursor:pointer}
  `
  document.head.append(s)
}

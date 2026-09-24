/**
 * タスク（`/tasks`）。
 *
 * 見た目の枠（見出し・「新しいタスク」・タブ）は採取した実DOM＋実CSS（`capture/clean/tasks/default/`）。
 * タブの下の空の場所（`TASK_LIST_HOST_SELECTOR`）に、作ったタスクの一覧を出す。
 *
 * - タブ「すべて / 定期タスク / スポットタスク」で絞り込み、数も数える
 * - 行を押すと編集（task-create.ts の同じフォームを、保存済みの値で開く）
 * - 定期タスクは「停止 / 再開」、どのタスクも「削除」（確認カードを出す）
 * - 状態の言葉は src/shared/task-status.ts（サーバーと同じ）
 */
import fragment from '../fragments/tasks__default.html?raw'
import { stripGlobalSidebar } from './sidebar-shell.ts'
import { api, type Task } from '../api.ts'
import { T, el, toast } from '../ui.ts'
import { confirmCard } from '../dialog.ts'
import { renderTaskEditForm, renderTemplatePicker } from './task-create.ts'
import { TASK_STATUS_LABELS, type TaskStatus } from '../../shared/task-status.ts'
import {
  TASK_LIST_HOST_SELECTOR,
  countTasksByTab,
  filterTasksByTab,
  isSpotTask,
  scheduleSummary,
  type TaskTab,
} from './task-list-model.ts'

/** 実物のタブのアクティブ／非アクティブを表すクラス（採取物のEmotionハッシュ） */
const TAB_ACTIVE_CLASS = 'css-1a9uxoy'
const TAB_INACTIVE_CLASS = 'css-djm0vw'
/** タブ要素の目印（すべて / 定期タスク / スポットタスク） */
const TAB_SELECTOR = '.e16h348b3'
/** タブの文字（「すべて 0」）が入っている要素 */
const TAB_LABEL_SELECTOR = '.e16h348b1'

/** 採取物のタブの並び順（左から） */
const TAB_ORDER: readonly { id: TaskTab; label: string }[] = [
  { id: 'all', label: 'すべて' },
  { id: 'recurring', label: '定期タスク' },
  { id: 'spot', label: 'スポットタスク' },
]

/** 状態の色（ピルの文字色。地は同じ色を薄くしたもの） */
const STATUS_COLORS: Readonly<Record<TaskStatus, string>> = {
  todo: 'var(--sb-c-666666, #666666)',
  doing: 'var(--sb-accent, #0091FF)',
  done: '#2F9E5B',
  paused: '#C77700',
}

const TRASH_ICON =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/>' +
  '<path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>'

interface ListState {
  container: HTMLElement
  root: HTMLElement
  host: HTMLElement | null
  tab: TaskTab
  tasks: Task[]
}

export function renderTasks(container: HTMLElement): void {
  container.style.cssText = 'flex:1;min-width:0'
  container.innerHTML = ''

  const root = document.createElement('div')
  root.innerHTML = stripGlobalSidebar(fragment)
  container.append(root)

  const state: ListState = {
    container,
    root,
    host: root.querySelector<HTMLElement>(TASK_LIST_HOST_SELECTOR),
    tab: 'all',
    tasks: [],
  }
  wireTabs(state)
  wireNewTaskButton(container, root)
  disableStrayAnchors(root)
  void loadAndRenderTasks(state)
}

/** タブを押したら、その種類のタスクだけに絞る */
function wireTabs(state: ListState): void {
  const tabs = [...state.root.querySelectorAll<HTMLElement>(TAB_SELECTOR)]
  tabs.forEach((node, i) => {
    const id = TAB_ORDER[i]?.id
    if (id === undefined) return
    node.style.cursor = 'pointer'
    node.addEventListener('click', () => {
      state.tab = id
      paintTabs(state)
      drawList(state)
    })
  })
}

/** 今のタブの色と、各タブの件数を塗り直す */
function paintTabs(state: ListState): void {
  const counts = countTasksByTab(state.tasks)
  const tabs = [...state.root.querySelectorAll<HTMLElement>(TAB_SELECTOR)]
  tabs.forEach((tab, i) => {
    const def = TAB_ORDER[i]
    if (def === undefined) return
    const isActive = def.id === state.tab
    tab.classList.toggle(TAB_ACTIVE_CLASS, isActive)
    tab.classList.toggle(TAB_INACTIVE_CLASS, !isActive)
    const label = tab.querySelector<HTMLElement>(TAB_LABEL_SELECTOR)
    if (label !== null) label.textContent = `${def.label} ${counts[def.id]}`
  })
}

/**
 * 「新しいタスク」を押したときの挙動。
 *
 * 実物はモーダルを出さない。タスク一覧の中身がそのままテンプレート選択に
 * 差し替わり、テンプレートを選ぶと設定フォームに進む（URLは変わらない）。
 * 2026-09-09 に 実物のタスク画面 を開いて確認した。
 */
function wireNewTaskButton(container: HTMLElement, root: HTMLElement): void {
  for (const button of root.querySelectorAll<HTMLButtonElement>('button')) {
    if ((button.textContent ?? '').includes('新しいタスク')) {
      button.addEventListener('click', () => {
        renderTemplatePicker(container, { onDone: () => renderTasks(container) })
      })
    }
  }
}

/** APIからタスクを取得して描画する。取れなかったら理由を出す（空の一覧に見せない） */
async function loadAndRenderTasks(state: ListState): Promise<void> {
  try {
    state.tasks = (await api.listTasks()).tasks
  } catch (error) {
    state.tasks = []
    paintTabs(state)
    showMessage(state, `タスクを読み込めませんでした: ${(error as Error).message}`, true)
    return
  }
  paintTabs(state)
  drawList(state)
}

function showMessage(state: ListState, text: string, isError: boolean): void {
  if (state.host === null) return
  state.host.replaceChildren(
    el('div', {
      text,
      style: `padding:24px 16px;font-size:13px;color:${isError ? '#D0021B' : T.sub};font-family:${T.font}`,
    }),
  )
}

function drawList(state: ListState): void {
  if (state.host === null) return
  const shown = filterTasksByTab(state.tasks, state.tab)
  if (shown.length === 0) {
    const empty =
      state.tasks.length === 0
        ? 'まだタスクはありません。「新しいタスク」から作れます。'
        : 'このタブに当てはまるタスクはありません。'
    showMessage(state, empty, false)
    return
  }
  const list = el('div', { class: 'sb-task-list', style: 'padding:0 16px' })
  for (const task of shown) list.append(renderTaskRow(state, task))
  state.host.replaceChildren(list)
}

function renderTaskRow(state: ListState, task: Task): HTMLElement {
  const color = STATUS_COLORS[task.status]
  const row = el('div', {
    class: 'sb-task-row',
    style: [
      'display:flex;align-items:center;gap:12px;padding:12px 4px;cursor:pointer',
      `border-bottom:1px solid var(--sb-c-f2f2f2, #F2F2F2);font-family:${T.font}`,
    ].join(';'),
  })
  row.tabIndex = 0
  row.setAttribute('role', 'button')
  row.title = '押すと編集できます'
  const open = (): void => {
    renderTaskEditForm(state.container, task, { onDone: () => renderTasks(state.container) })
  }
  row.addEventListener('click', open)
  row.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') open()
  })

  const main = el('div', { style: 'flex:1;min-width:0' }, [
    el('div', { text: task.title, style: `font-size:14px;color:${T.text};overflow-wrap:anywhere` }),
    el('div', {
      text: rowNote(task),
      style: `font-size:11px;color:${T.sub};margin-top:2px;overflow-wrap:anywhere`,
    }),
  ])

  const pill = el('span', {
    text: TASK_STATUS_LABELS[task.status],
    style: `font-size:11px;padding:2px 10px;border-radius:10px;white-space:nowrap;color:${color};background:color-mix(in srgb, ${color} 12%, transparent)`,
  })

  row.append(main, pill)
  if (!isSpotTask(task) && task.status !== 'done') {
    row.append(pauseButton(state, task))
  }
  row.append(deleteButton(state, task))
  return row
}

/** 行の2段目: いつ動くか・最後の実行結果 */
function rowNote(task: Task): string {
  const parts = [scheduleSummary(task.schedule)]
  if (task.last_run_status === 'failed') parts.push(`前回は送れませんでした（${task.last_run_error ?? '理由不明'}）`)
  else if (task.last_run_slot !== null && task.last_run_slot !== undefined) parts.push(`前回 ${task.last_run_slot}`)
  return parts.join(' ・ ')
}

function smallButton(label: string): HTMLButtonElement {
  const b = el('button', {
    style: [
      'border:1px solid var(--sb-c-dddddd, #DDDDDD);background:var(--sb-c-ffffff, #FFFFFF)',
      `border-radius:4px;padding:4px 10px;font-size:12px;color:${T.text};cursor:pointer`,
      `font-family:${T.font};white-space:nowrap;display:inline-flex;align-items:center;gap:4px`,
    ].join(';'),
  })
  b.type = 'button'
  b.textContent = label
  return b
}

/** 定期タスクの「停止 / 再開」。停止中は通知を送らない */
function pauseButton(state: ListState, task: Task): HTMLButtonElement {
  const paused = task.status === 'paused'
  const b = smallButton(paused ? '再開' : '停止')
  b.title = paused ? '定期の通知をまた送るようにします' : '定期の通知を止めます（あとで再開できます）'
  b.addEventListener('click', (event) => {
    event.stopPropagation()
    const next: TaskStatus = paused ? 'doing' : 'paused'
    b.disabled = true
    void api.updateTask(task.uid, { status: next }).then(
      () => {
        toast(paused ? '再開しました' : '停止しました')
        void loadAndRenderTasks(state)
      },
      (error: Error) => {
        b.disabled = false
        toast(error.message, 'error')
      },
    )
  })
  return b
}

function deleteButton(state: ListState, task: Task): HTMLButtonElement {
  const b = smallButton('')
  b.innerHTML = `${TRASH_ICON}<span>削除</span>`
  b.addEventListener('click', (event) => {
    event.stopPropagation()
    void (async () => {
      const ok = await confirmCard({
        title: 'タスクを削除します',
        message: `「${task.title}」を削除します。`,
        detail: '削除すると元に戻せません。定期の通知も止まります。',
        submitLabel: '削除する',
        danger: true,
      })
      if (!ok) return
      try {
        await api.deleteTask(task.uid)
        toast('タスクを削除しました')
        await loadAndRenderTasks(state)
      } catch (error) {
        toast((error as Error).message, 'error')
      }
    })()
  })
  return b
}

function disableStrayAnchors(root: HTMLElement): void {
  for (const anchor of root.querySelectorAll('a')) {
    anchor.addEventListener('click', (e) => e.preventDefault())
  }
}

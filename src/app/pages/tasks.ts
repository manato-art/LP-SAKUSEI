/**
 * タスク（`/tasks`）＝空状態の画面。
 *
 * 見た目は採取した実DOM＋実CSS（`capture/clean/tasks/default/`）が担保する。
 * クローンの基準は新規空アカウントなので、実物どおり「すべて 0 / 定期タスク 0 /
 * スポットタスク 0」の空状態のまま（企画書 §1-4）。
 *
 * ## FAQ機能の追加配線
 * - 「新しいタスク」ボタン → タスク名入力ダイアログ → API POST /tasks
 * - 作成されたタスクは採取物の空領域にリスト表示
 */
import fragment from '../fragments/tasks__default.html?raw'
import { stripGlobalSidebar } from './sidebar-shell.ts'
import { api, type Task } from '../api.ts'
import { T, el, toast } from '../ui.ts'
import { renderTemplatePicker } from './task-create.ts'

/** 実物のタブのアクティブ／非アクティブを表すクラス（採取物のEmotionハッシュ） */
const TAB_ACTIVE_CLASS = 'css-1a9uxoy'
const TAB_INACTIVE_CLASS = 'css-djm0vw'
/** タブ要素の目印（すべて / 定期タスク / スポットタスク） */
const TAB_SELECTOR = '.e16h348b3'

/** タスクリストを挿入する場所を見つけるための親セレクタ */
let taskListContainer: HTMLElement | null = null

export function renderTasks(container: HTMLElement): void {
  container.style.cssText = 'flex:1;min-width:0'
  container.innerHTML = ''

  const root = document.createElement('div')
  root.innerHTML = stripGlobalSidebar(fragment)
  container.append(root)

  wireTabs(root)
  wireNewTaskButton(container, root)
  disableStrayAnchors(root)

  // タスクリストを描画する領域を確保
  taskListContainer = root.querySelector<HTMLElement>('.css-1j2zwhw') ?? null
  void loadAndRenderTasks()
}

/** タブ切替＝アクティブ表示の付け替えのみ（中身は全タブ空なので変化しない） */
function wireTabs(root: HTMLElement): void {
  const tabs = [...root.querySelectorAll<HTMLElement>(TAB_SELECTOR)]
  for (const tab of tabs) {
    tab.style.cursor = 'pointer'
    tab.addEventListener('click', () => {
      for (const other of tabs) {
        const isActive = other === tab
        other.classList.toggle(TAB_ACTIVE_CLASS, isActive)
        other.classList.toggle(TAB_INACTIVE_CLASS, !isActive)
      }
    })
  }
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

/** APIからタスクを取得して描画する */
async function loadAndRenderTasks(): Promise<void> {
  if (taskListContainer === null) return
  try {
    const data = await api.listTasks()
    const tasks = data.tasks
    if (tasks.length === 0) return // 空状態は採取物のまま

    // 採取物の空状態メッセージを消す
    const emptyMsg = taskListContainer.querySelector('.css-1qwv5g4')
    if (emptyMsg !== null) emptyMsg.remove()

    // タスクリストを描画
    let listEl = taskListContainer.querySelector<HTMLElement>('.sb-task-list')
    if (listEl === null) {
      listEl = el('div', { style: 'padding:0 16px' })
      listEl.className = 'sb-task-list'
      taskListContainer.append(listEl)
    }
    listEl.innerHTML = ''

    for (const task of tasks) {
      listEl.append(renderTaskRow(task))
    }
  } catch {
    // タスクAPIが無い場合は静かに無視（採取物の空状態のまま）
  }
}

function renderTaskRow(task: Task): HTMLElement {
  const statusColors: Record<string, string> = {
    'open': 'var(--sb-accent, #0091FF)',
    'in_progress': '#F6AD55',
    'done': '#48BB78',
  }
  const statusLabels: Record<string, string> = {
    'open': '未着手',
    'in_progress': '進行中',
    'done': '完了',
  }

  const row = el('div', {
    style: `display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--sb-c-f2f2f2, #F2F2F2);font-family:${T.font}`,
  })

  const statusDot = el('span', {
    style: `width:8px;height:8px;border-radius:50%;background:${statusColors[task.status] ?? 'var(--sb-c-cccccc, #CCCCCC)'};flex-shrink:0`,
  })

  const titleEl = el('span', {
    text: task.title,
    style: `flex:1;font-size:14px;color:${T.text}`,
  })

  const statusBadge = el('span', {
    text: statusLabels[task.status] ?? task.status,
    style: `font-size:11px;padding:2px 8px;border-radius:10px;background:${statusColors[task.status] ?? 'var(--sb-c-cccccc, #CCCCCC)'}22;color:${statusColors[task.status] ?? 'var(--sb-c-666666, #666666)'}`,
  })

  // ステータス切替
  statusBadge.style.cursor = 'pointer'
  statusBadge.addEventListener('click', () => {
    const nextStatus = task.status === 'open' ? 'in_progress' : task.status === 'in_progress' ? 'done' : 'open'
    void api.updateTask(task.uid, { status: nextStatus }).then(
      () => {
        toast(`タスクを「${statusLabels[nextStatus] ?? nextStatus}」に変更しました`)
        void loadAndRenderTasks()
      },
      () => toast('ステータスの変更に失敗しました', 'error'),
    )
  })

  row.append(statusDot, titleEl, statusBadge)
  return row
}

function disableStrayAnchors(root: HTMLElement): void {
  for (const anchor of root.querySelectorAll('a')) {
    anchor.addEventListener('click', (e) => e.preventDefault())
  }
}

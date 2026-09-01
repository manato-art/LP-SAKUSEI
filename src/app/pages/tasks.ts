/**
 * タスク（`/tasks`）＝空状態の画面。
 *
 * 見た目は採取した実DOM＋実CSS（`capture/clean/tasks/default/`）が担保する。
 * クローンの基準は新規空アカウントなので、実物どおり「すべて 0 / 定期タスク 0 /
 * スポットタスク 0」の空状態のまま（企画書 §1-4）。
 *
 * ## 採取物の実態（推測で埋めない・共通指示 §1-5）
 * - タブは3つ。タスクは0件で、どのタブにも一覧の中身は無い（空）。タブ切替は
 *   アクティブ表示の付け替えだけ（＝「切替のみ」）。
 * - 「新しいタスク」の作成フォーム／モーダルは採取物に無い → 押すと未実装トースト。
 */
import fragment from '../fragments/tasks__default.html?raw'
import { stripGlobalSidebar } from './sidebar-shell.ts'
import { toast } from '../ui.ts'

/** 実物のタブのアクティブ／非アクティブを表すクラス（採取物のEmotionハッシュ） */
const TAB_ACTIVE_CLASS = 'css-1a9uxoy'
const TAB_INACTIVE_CLASS = 'css-djm0vw'
/** タブ要素の目印（すべて / 定期タスク / スポットタスク） */
const TAB_SELECTOR = '.e16h348b3'

export function renderTasks(container: HTMLElement): void {
  container.style.cssText = 'flex:1;min-width:0'
  container.innerHTML = ''

  const root = document.createElement('div')
  root.innerHTML = stripGlobalSidebar(fragment)
  container.append(root)

  wireTabs(root)
  wireNewTaskButton(root)
  disableStrayAnchors(root)
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

/** 「新しいタスク」の作成UIは採取物に無い → 実行しない */
function wireNewTaskButton(root: HTMLElement): void {
  for (const button of root.querySelectorAll<HTMLButtonElement>('button')) {
    if ((button.textContent ?? '').includes('新しいタスク')) {
      button.addEventListener('click', () => {
        toast('タスクの作成フォームは採取していません（新規タスク＝未実装）', 'error')
      })
    }
  }
}

function disableStrayAnchors(root: HTMLElement): void {
  for (const anchor of root.querySelectorAll('a')) {
    anchor.addEventListener('click', (e) => e.preventDefault())
  }
}

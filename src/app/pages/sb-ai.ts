/**
 * AI（`/sb_ai`）＝チャットUI。
 *
 * 見た目は採取した実DOM＋実CSS（`capture/clean/sb_ai/default/`）が担保する。
 *
 * ## 採取物の実態（推測で埋めない・共通指示 §1-5）
 * - 送信・推奨プロンプト送信は AI呼び出し（POST相当）→ **実行しない**（押すと未実装トースト）。
 * - チャット履歴 / ホーム / 新しいチャットは表示のみ（遷移先のチャット画面は未採取）。
 *   → これらには挙動を付けない（採取物のまま静的表示）。
 * - 送信ボタンは採取時 `disabled`。実物は入力すると押せるようになる（標準的なUX）。
 *   トーストへ到達できるよう、入力の有無で `disabled` を切り替える（＝推測で足した唯一の挙動）。
 */
import fragment from '../fragments/sb_ai__default.html?raw'
import { stripGlobalSidebar } from './sidebar-shell.ts'
import { toast } from '../ui.ts'

const NOT_IMPLEMENTED = 'AIへの送信はモックでは未実装です'

export function renderSbAi(container: HTMLElement): void {
  container.style.cssText = 'flex:1;min-width:0'
  container.innerHTML = ''

  const root = document.createElement('div')
  root.innerHTML = stripGlobalSidebar(fragment)
  container.append(root)

  wireComposer(root)
  wireSuggestedPrompts(root)
  disableStrayAnchors(root)
}

/** 入力欄＋送信。送信＝POST相当なので実行せず、未実装トーストを出す。 */
function wireComposer(root: HTMLElement): void {
  const form = root.querySelector<HTMLFormElement>('form')
  const textarea = root.querySelector<HTMLTextAreaElement>('textarea')
  const submit = form?.querySelector<HTMLButtonElement>('button[type="submit"]') ?? null

  // 入力の有無で送信ボタンの活性を切り替える（実物の標準挙動・トーストへ到達させるため）
  if (textarea !== null && submit !== null) {
    textarea.addEventListener('input', () => {
      submit.disabled = textarea.value.trim() === ''
    })
  }

  form?.addEventListener('submit', (e) => {
    e.preventDefault()
    toast(NOT_IMPLEMENTED, 'error')
  })
}

/** 推奨プロンプト（例: 「1番PVが多いページは？」）も送信＝POST相当なので実行しない。 */
function wireSuggestedPrompts(root: HTMLElement): void {
  for (const button of root.querySelectorAll<HTMLButtonElement>('button.css-8pm3ds')) {
    button.addEventListener('click', () => {
      toast(NOT_IMPLEMENTED, 'error')
    })
  }
}

function disableStrayAnchors(root: HTMLElement): void {
  for (const anchor of root.querySelectorAll('a')) {
    anchor.addEventListener('click', (e) => e.preventDefault())
  }
}

/**
 * AI（`/sb_ai`）＝チャットUI。
 *
 * 見た目は採取した実DOM＋実CSS（`capture/clean/sb_ai/default/`）が担保する。
 *
 * ## FAQ機能の追加配線
 * - 送信ボタン → API POST /sb_ai/conversations/:uid/messages → レスポンスを表示
 * - 推奨プロンプトボタン → テキストを入力欄にセットして送信
 * - 新しいチャットボタン → 会話を作成してリセット
 */
import fragment from '../fragments/sb_ai__default.html?raw'
import { stripGlobalSidebar } from './sidebar-shell.ts'
import { api } from '../api.ts'
import { T, el, toast } from '../ui.ts'

let currentConversationUid: string | null = null
let chatMessagesContainer: HTMLElement | null = null

export function renderSbAi(container: HTMLElement): void {
  container.style.cssText = 'flex:1;min-width:0'
  container.innerHTML = ''

  const root = document.createElement('div')
  root.innerHTML = stripGlobalSidebar(fragment)
  container.append(root)

  wireComposer(root)
  wireSuggestedPrompts(root)
  wireNewChatButton(root)
  disableStrayAnchors(root)
}

/** 入力欄＋送信 → APIでモックAI応答を取得 */
function wireComposer(root: HTMLElement): void {
  const form = root.querySelector<HTMLFormElement>('form')
  const textarea = root.querySelector<HTMLTextAreaElement>('textarea')
  const submit = form?.querySelector<HTMLButtonElement>('button[type="submit"]') ?? null

  // 入力の有無で送信ボタンの活性を切り替える
  if (textarea !== null && submit !== null) {
    textarea.addEventListener('input', () => {
      submit.disabled = textarea.value.trim() === ''
    })
  }

  form?.addEventListener('submit', (e) => {
    e.preventDefault()
    if (textarea === null || textarea.value.trim() === '') return
    const message = textarea.value.trim()
    textarea.value = ''
    if (submit !== null) submit.disabled = true
    void sendMessage(message, root)
  })
}

async function sendMessage(content: string, root: HTMLElement): Promise<void> {
  try {
    // 会話がなければ作成
    if (currentConversationUid === null) {
      const convData = await api.sbAiCreateConversation()
      currentConversationUid = convData.conversation.uid
    }

    // 推奨プロンプトエリアを隠してチャットエリアを表示
    ensureChatArea(root)

    // ユーザーメッセージを先に表示
    appendMessageBubble({ role: 'user', content })

    // APIでメッセージ送信
    const data = await api.sbAiSendMessage(currentConversationUid, content)
    // アシスタントの最新応答を表示
    const assistantMessages = data.messages.filter((m) => m.role === 'assistant')
    const latest = assistantMessages[assistantMessages.length - 1]
    if (latest !== undefined) {
      appendMessageBubble({ role: 'assistant', content: latest.content })
    }
  } catch (err) {
    toast(`送信に失敗しました: ${(err as Error).message}`, 'error')
  }
}

/** 推奨プロンプトの表示エリアをチャットメッセージ表示エリアに切り替える */
function ensureChatArea(root: HTMLElement): void {
  if (chatMessagesContainer !== null) return

  // 推奨プロンプトのコンテナ（ホーム画面の中央部）を取得して隠す
  const mainContent = root.querySelector<HTMLElement>('.css-1mctbjp') ??
    root.querySelector<HTMLElement>('.css-1qwv5g4')
  if (mainContent !== null) {
    mainContent.style.display = 'none'
  }

  // チャットメッセージのコンテナを作成
  chatMessagesContainer = el('div', {
    style: `flex:1;overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column;gap:16px;font-family:${T.font}`,
  })

  // formの前に挿入
  const form = root.querySelector('form')
  if (form !== null) {
    form.parentElement?.insertBefore(chatMessagesContainer, form)
  }
}

function appendMessageBubble(msg: { role: string; content: string }): void {
  if (chatMessagesContainer === null) return

  const isUser = msg.role === 'user'
  const bubble = el('div', {
    style: [
      `max-width:70%;padding:12px 16px;border-radius:12px;font-size:14px;line-height:1.7`,
      `white-space:pre-wrap;word-break:break-word`,
      isUser
        ? `align-self:flex-end;background:#0091FF;color:#FFF;border-bottom-right-radius:4px`
        : `align-self:flex-start;background:#F0F0F0;color:${T.text};border-bottom-left-radius:4px`,
    ].join(';'),
  })
  bubble.textContent = msg.content
  chatMessagesContainer.append(bubble)
  chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight
}

/** 推奨プロンプトのテキストを取得して送信 */
function wireSuggestedPrompts(root: HTMLElement): void {
  for (const button of root.querySelectorAll<HTMLButtonElement>('button.css-8pm3ds')) {
    button.addEventListener('click', () => {
      const text = (button.textContent ?? '').trim()
      if (text === '') return
      void sendMessage(text, root)
    })
  }
}

/** 「新しいチャット」ボタン → 会話をリセット */
function wireNewChatButton(root: HTMLElement): void {
  for (const button of root.querySelectorAll<HTMLButtonElement>('button')) {
    const text = (button.textContent ?? '').trim()
    if (text.includes('新しいチャット') || text.includes('New Chat')) {
      button.addEventListener('click', () => {
        currentConversationUid = null
        chatMessagesContainer?.remove()
        chatMessagesContainer = null
        // 推奨プロンプト表示を復帰
        const mainContent = root.querySelector<HTMLElement>('.css-1mctbjp') ??
          root.querySelector<HTMLElement>('.css-1qwv5g4')
        if (mainContent !== null) {
          mainContent.style.display = ''
        }
        toast('新しいチャットを開始しました')
      })
    }
  }
}

function disableStrayAnchors(root: HTMLElement): void {
  for (const anchor of root.querySelectorAll('a')) {
    anchor.addEventListener('click', (e) => e.preventDefault())
  }
}

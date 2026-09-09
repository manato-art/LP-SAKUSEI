/**
 * タスク作成画面の「実行結果の通知」。
 *
 * 通知しない / Slack / チャットワーク を選べる。
 * どちらも「まだ設定されていなければ、その場に取得手順を出す」作りにしてある。
 * 環境変数さえ入れば、この画面を直さなくてもすぐ使える。
 *
 * 2つのサービスで手順が違う:
 *   Slack       … OAuthの往復。認可画面で許可すると繋がる
 *   チャットワーク … APIトークン1本。本人が発行したものを環境変数に入れる
 */
import { api } from '../api.ts'
import { T, el, toast } from '../ui.ts'

export type NotifyService = 'none' | 'slack' | 'chatwork'

/** Slackアプリを作ってもらう手順（未設定のときだけ出す） */
const SLACK_STEPS: readonly string[] = [
  'api.slack.com/apps を開き「Create New App」→「From scratch」でアプリを作る',
  'アプリ名（例: SquadBeyond通知）と、通知を送りたいワークスペースを選ぶ',
  '「OAuth & Permissions」→ Bot Token Scopes に channels:join / channels:read / chat:write / groups:read / im:read / mpim:read を追加する',
  '同じ画面の User Token Scopes に groups:write.invites を追加する',
  '同じ画面の「Redirect URLs」に、下に表示されている戻り先URLをそのまま登録する',
  '「Basic Information」の Client ID と Client Secret を控える',
  'Railway の環境変数に SLACK_CLIENT_ID と SLACK_CLIENT_SECRET を入れて再デプロイする',
]

/** チャットワークのトークンを取ってもらう手順 */
const CHATWORK_STEPS: readonly string[] = [
  'チャットワークに、通知を送りたいアカウントでログインする',
  '右上のアカウント名→「サービス連携」→「API Token」を開く',
  'パスワードを入力してAPIトークンを表示し、控える',
  'Railway の環境変数に CHATWORK_API_TOKEN を入れて再デプロイする',
]

/** 秘密情報の入力欄。入れた値は保存後に画面へ出さない（出せば漏れる経路になる） */
function secretInput(placeholder: string): HTMLInputElement {
  const input = document.createElement('input')
  input.type = 'password'
  input.autocomplete = 'off'
  input.placeholder = placeholder
  input.className = 'tc-input'
  input.style.maxWidth = '320px'
  return input
}

function guideBox(title: string, steps: readonly string[]): HTMLElement {
  const box = el('div', {
    style: [
      'border:1px solid #E6E9F0;border-radius:8px;background:#F8FAFC;padding:12px 14px',
      `font-size:12px;color:${T.text};line-height:1.9`,
    ].join(';'),
  })
  box.append(el('div', { text: title, style: 'font-weight:700;margin-bottom:6px' }))
  const list = document.createElement('ol')
  list.style.cssText = `margin:0;padding-left:20px;color:${T.sub}`
  for (const step of steps) {
    const li = document.createElement('li')
    li.textContent = step
    li.style.marginBottom = '3px'
    list.append(li)
  }
  box.append(list)
  return box
}

/** Slackアプリに登録してもらう戻り先URL（コピーできるようにする） */
function redirectRow(redirectUri: string): HTMLElement {
  const row = el('div', {
    style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px',
  })
  row.append(el('span', { text: '戻り先URL', style: `font-size:11px;color:${T.sub}` }))
  const uri = document.createElement('code')
  uri.textContent = redirectUri
  uri.style.cssText =
    'font-size:11px;background:#fff;border:1px solid #E6E9F0;border-radius:5px;padding:4px 8px;word-break:break-all'
  const copy = el('button', {
    text: 'コピー',
    style: [
      `font-family:${T.font};font-size:11px;padding:4px 10px;border-radius:5px`,
      'border:1px solid #DDD;background:#fff;color:#555;cursor:pointer;flex-shrink:0',
    ].join(';'),
  })
  copy.addEventListener('click', () => {
    void navigator.clipboard?.writeText(redirectUri).then(
      () => toast('戻り先URLをコピーしました'),
      () => toast('コピーできませんでした', 'error'),
    )
  })
  row.append(uri, copy)
  return row
}

/** 秘密情報の入力欄と保存ボタン。保存できたら状態を取り直して画面を進める */
function credentialRow(
  label: string,
  inputs: readonly HTMLInputElement[],
  save: () => Promise<void>,
): HTMLElement {
  const box = el('div', { style: 'margin-top:12px' })
  box.append(el('div', { text: label, style: `font-size:11px;color:${T.sub};margin-bottom:6px` }))
  const row = el('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' })
  for (const input of inputs) row.append(input)
  const button = el('button', {
    text: '保存',
    style: [
      `font-family:${T.font};font-size:12px;padding:8px 18px;border-radius:6px;border:0`,
      'background:var(--sb-accent, #0091FF);color:var(--sb-accent-ink, #fff);cursor:pointer',
    ].join(';'),
  })
  button.addEventListener('click', () => {
    if (inputs.some((i) => i.value.trim() === '')) {
      toast('入力してください', 'error')
      return
    }
    button.setAttribute('disabled', '')
    void save().then(
      () => {
        toast('保存しました')
        box.dispatchEvent(new CustomEvent('sb-credential-saved', { bubbles: true }))
      },
      (error: Error) => {
        button.removeAttribute('disabled')
        toast(error.message, 'error')
      },
    )
  })
  row.append(button)
  box.append(row)
  return box
}

/** 実際に送れる通知先（「通知しない」を除いたもの） */
export type NotifyDestination = { service: 'slack' | 'chatwork'; id: string }

export interface NotifyTargetResult {
  el: HTMLElement
  /** 選ばれた通知先。通知しないなら null */
  target: () => NotifyDestination | null
}

export function buildNotifyTarget(): NotifyTargetResult {
  const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:8px' })

  const row = el('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' })
  const service = document.createElement('select')
  service.className = 'tc-select'
  for (const [value, label] of [
    ['none', '通知しない'],
    ['slack', 'Slack'],
    ['chatwork', 'チャットワーク'],
  ] as const) {
    const opt = document.createElement('option')
    opt.value = value
    opt.textContent = label
    service.append(opt)
  }

  /** 送り先（チャンネル / 部屋）。サービスを選んでから出す */
  const destination = document.createElement('select')
  destination.className = 'tc-select'
  destination.style.minWidth = '200px'

  row.append(service, destination)
  const notice = el('div', { style: `font-size:12px;color:${T.sub};line-height:1.9` })
  wrap.append(row, notice)

  /** 実際に1通送ってみる。届いて初めて設定できたと分かる。 */
  const testBtn = el('button', { class: 'tc-link', text: 'テスト送信' })
  testBtn.addEventListener('click', () => {
    const chosen = service.value as NotifyService
    if (chosen === 'none' || destination.value === '') {
      toast('送り先を選んでください', 'error')
      return
    }
    testBtn.setAttribute('disabled', '')
    void api.testNotify({ service: chosen, id: destination.value }).then(
      () => {
        testBtn.removeAttribute('disabled')
        toast('テスト送信しました。届いているか確認してください')
      },
      (error: Error) => {
        testBtn.removeAttribute('disabled')
        toast(error.message, 'error')
      },
    )
  })

  const setDestinations = (
    items: readonly { value: string; label: string }[],
    placeholder: string,
  ): void => {
    destination.replaceChildren()
    const first = document.createElement('option')
    first.value = ''
    first.textContent = placeholder
    destination.append(first)
    for (const item of items) {
      const opt = document.createElement('option')
      opt.value = item.value
      opt.textContent = item.label
      destination.append(opt)
    }
  }

  const connectLink = el('button', { class: 'tc-link', text: 'Slackと連携する' })
  connectLink.addEventListener('click', () => {
    // 認可はブラウザ遷移。別タブで開いて、終わったらこの画面に戻ってもらう
    window.open('/oauth/slack/start', '_blank', 'noopener')
  })
  const clearChatwork = el('button', { class: 'tc-link', text: 'トークンを消す' })
  clearChatwork.addEventListener('click', () => {
    void api.clearIntegration('chatwork').then(
      () => {
        toast('チャットワークのトークンを消しました')
        void refresh()
      },
      (error: Error) => toast(error.message, 'error'),
    )
  })

  const disconnect = el('button', { class: 'tc-link', text: '連携を解除' })
  disconnect.addEventListener('click', () => {
    void api.disconnectSlack().then(
      () => {
        toast('Slackの連携を解除しました')
        void refresh()
      },
      (error: Error) => toast(error.message, 'error'),
    )
  })

  async function showSlack(): Promise<void> {
    let status: Awaited<ReturnType<typeof api.slackStatus>>
    try {
      status = await api.slackStatus()
    } catch {
      notice.textContent = 'Slackの連携状態を取得できませんでした。'
      return
    }
    if (!status.configured) {
      const box = guideBox('Slackアプリを用意すると、ここから連携できるようになります', SLACK_STEPS)
      box.append(redirectRow(status.redirect_uri))
      const id = secretInput('Client ID')
      const secret = secretInput('Client Secret')
      box.append(
        credentialRow('控えた2つをここに入れてください', [id, secret], async () => {
          await api.saveIntegration({
            slack_client_id: id.value.trim(),
            slack_client_secret: secret.value.trim(),
          })
        }),
      )
      notice.replaceChildren(box)
      return
    }
    if (!status.connected) {
      row.append(connectLink)
      notice.textContent = '連携すると、送り先のチャンネルを選べるようになります。'
      return
    }
    row.append(testBtn, disconnect)
    notice.textContent =
      status.team_name === null || status.team_name === ''
        ? '連携済みです。'
        : `${status.team_name} と連携済みです。`
    try {
      const { channels } = await api.slackChannels()
      setDestinations(
        channels.map((c) => ({ value: c.id, label: `#${c.name}` })),
        'チャンネルを選ぶ',
      )
    } catch (error) {
      notice.textContent = (error as Error).message
    }
  }

  async function showChatwork(): Promise<void> {
    let status: Awaited<ReturnType<typeof api.chatworkStatus>>
    try {
      status = await api.chatworkStatus()
    } catch {
      notice.textContent = 'チャットワークの状態を取得できませんでした。'
      return
    }
    if (!status.configured) {
      const box = guideBox('APIトークンを入れると、ここから送り先を選べるようになります', CHATWORK_STEPS)
      const token = secretInput('APIトークン')
      box.append(
        credentialRow('控えたトークンをここに入れてください', [token], async () => {
          await api.saveIntegration({ chatwork_api_token: token.value.trim() })
        }),
      )
      notice.replaceChildren(box)
      return
    }
    try {
      const { rooms } = await api.chatworkRooms()
      setDestinations(
        rooms.map((r) => ({ value: String(r.id), label: r.name })),
        '送り先の部屋を選ぶ',
      )
      row.append(testBtn, clearChatwork)
      notice.textContent = 'APIトークンが設定されています。送り先の部屋を選んで、テスト送信で確かめてください。'
    } catch (error) {
      notice.textContent = (error as Error).message
    }
  }

  async function refresh(): Promise<void> {
    row.replaceChildren(service, destination)
    notice.replaceChildren()
    setDestinations([], '—')
    const chosen = service.value as NotifyService
    destination.style.display = chosen === 'none' ? 'none' : ''
    if (chosen === 'none') return
    if (chosen === 'slack') await showSlack()
    else await showChatwork()
  }

  service.addEventListener('change', () => void refresh())
  // 資格情報を入れたら、その場で次の状態（連携ボタン／送り先の選択）へ進む
  wrap.addEventListener('sb-credential-saved', () => void refresh())
  void refresh()

  return {
    el: wrap,
    target: () => {
      const chosen = service.value as NotifyService
      if (chosen === 'none' || destination.value === '') return null
      return { service: chosen, id: destination.value }
    },
  }
}

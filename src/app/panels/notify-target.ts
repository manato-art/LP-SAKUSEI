/**
 * タスク作成画面の「実行結果の通知」。
 *
 * 通知しない / Slack / チャットワーク / LINE を選べる。
 * どれも「まだ設定されていなければ、その場に取得手順を出す」作りにしてある。
 * 環境変数さえ入れば、この画面を直さなくてもすぐ使える。
 *
 * サービスごとに手順が違う:
 *   Slack       … OAuthの往復。認可画面で許可すると繋がる
 *   チャットワーク … APIトークン1本。本人が発行したものを環境変数に入れる
 *   LINE        … 公式アカウントのチャネルアクセストークン1本
 *                 （**LINE Notifyは2025-03-31で終了**しているので、そちらは使えない）
 *
 * 送り先の選び方も違う。SlackとチャットワークはAPIで一覧が取れるのでプルダウン、
 * LINEは一覧を取る道が無いので手入力（空＝友だち全員へ）。
 */
import { api } from '../api.ts'
import { T, el, toast } from '../ui.ts'
import { confirmCard } from '../dialog.ts'

export type NotifyService = 'none' | 'slack' | 'chatwork' | 'line'

/** Slackアプリを作ってもらう手順（未設定のときだけ出す） */
const SLACK_STEPS: readonly string[] = [
  'api.slack.com/apps を開き「Create New App」→「From scratch」でアプリを作る',
  'アプリ名（例: SquadBeyond通知）と、通知を送りたいワークスペースを選ぶ',
  '「OAuth & Permissions」→ Bot Token Scopes に channels:join / channels:read / chat:write / groups:read / im:read / mpim:read を追加する',
  '同じ画面の User Token Scopes に groups:write.invites を追加する',
  '同じ画面の「Redirect URLs」に、下に表示されている戻り先URLをそのまま登録する',
  '「Basic Information」の Client ID と Client Secret を控え、下の欄に入れて保存する',
  '（本番で環境変数から渡したい場合は SLACK_CLIENT_ID / SLACK_CLIENT_SECRET を設定してください。そちらが優先されます）',
]

/** チャットワークのトークンを取ってもらう手順 */
const CHATWORK_STEPS: readonly string[] = [
  'チャットワークに、通知を送りたいアカウントでログインする',
  '右上のアカウント名→「サービス連携」→「API Token」を開く',
  'パスワードを入力してAPIトークンを表示し、控える',
  '控えたトークンを下の欄に入れて保存する',
  '（本番で環境変数から渡したい場合は CHATWORK_API_TOKEN を設定してください。そちらが優先されます）',
]

/** LINE公式アカウントのトークンを取ってもらう手順 */
const LINE_STEPS: readonly string[] = [
  'developers.line.biz（LINE Developers）にLINEアカウントでログインする',
  '「プロバイダー」を作り、その中に「Messaging API」のチャネルを1つ作る（公式アカウントが1つできる）',
  'チャネルの「Messaging API設定」を開き、いちばん下の「チャネルアクセストークン（長期）」を発行して控える',
  '同じ画面のQRコードから、通知を受け取りたいLINEアカウントでその公式アカウントを友だち追加する',
  '控えたトークンを下の欄に入れて保存する',
  '（送り先IDを空にすると、その公式アカウントを友だち追加した人**全員**に届きます）',
  '（特定の相手だけに送りたいときは、そのユーザーID／グループIDを入れてください。自分のIDは「チャネル基本設定」の「あなたのユーザーID」で分かります）',
  '（本番で環境変数から渡したい場合は LINE_CHANNEL_ACCESS_TOKEN を設定してください。そちらが優先されます）',
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
      'border:1px solid var(--sb-c-e6e9f0, #E6E9F0);border-radius:8px;background:#F8FAFC;padding:12px 14px',
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
    'font-size:11px;background:var(--sb-c-ffffff, #FFFFFF);border:1px solid var(--sb-c-e6e9f0, #E6E9F0);border-radius:5px;padding:4px 8px;word-break:break-all'
  const copy = el('button', {
    text: 'コピー',
    style: [
      `font-family:${T.font};font-size:11px;padding:4px 10px;border-radius:5px`,
      'border:1px solid var(--sb-c-dddddd, #DDDDDD);background:var(--sb-c-ffffff, #FFFFFF);color:var(--sb-c-555555, #555555);cursor:pointer;flex-shrink:0',
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
      'background:var(--sb-accent, #0091FF);color:var(--sb-accent-ink, #FFFFFF);cursor:pointer',
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
export type NotifyDestination = { service: 'slack' | 'chatwork' | 'line'; id: string }

export interface NotifyTargetResult {
  el: HTMLElement
  /** 選ばれた通知先。通知しないなら null */
  target: () => NotifyDestination | null
}

export interface NotifyTargetOptions {
  /** 最初に選んでおく送り先（保存済みの設定を開き直したとき） */
  initial?: NotifyDestination | null
  /** 「通知しない」を選べるか。既定は選べる（タスクの画面はこれ） */
  allowNone?: boolean
  /** 選び直したときに呼ぶ。設定画面はその場で保存するために使う */
  onChange?: (target: NotifyDestination | null) => void
}

export function buildNotifyTarget(options: NotifyTargetOptions = {}): NotifyTargetResult {
  const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:8px' })

  const row = el('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' })
  const service = document.createElement('select')
  service.className = 'tc-select'
  const choices = [
    ['none', '通知しない'],
    ['slack', 'Slack'],
    ['chatwork', 'チャットワーク'],
    ['line', 'LINE'],
  ] as const
  for (const [value, label] of choices) {
    if (value === 'none' && options.allowNone === false) continue
    const opt = document.createElement('option')
    opt.value = value
    opt.textContent = label
    service.append(opt)
  }

  /** 送り先（チャンネル / 部屋）。サービスを選んでから出す */
  const destination = document.createElement('select')
  destination.className = 'tc-select'
  destination.style.minWidth = '200px'

  /** 一覧が取れないサービス（LINE）の送り先。手で入れてもらう */
  const destinationText = document.createElement('input')
  destinationText.type = 'text'
  destinationText.className = 'tc-input'
  destinationText.style.minWidth = '200px'
  destinationText.style.display = 'none'

  /** 今えらばれている送り先ID。プルダウンと手入力のどちらが出ているかで変わる */
  const currentId = (): string =>
    destinationText.style.display === 'none' ? destination.value : destinationText.value.trim()

  /** 今の選択を組み立てる。LINEだけIDが空でも成り立つ（＝友だち全員へ） */
  const currentTarget = (): NotifyDestination | null => {
    const chosen = service.value as NotifyService
    if (chosen === 'none') return null
    const id = currentId()
    if (chosen !== 'line' && id === '') return null
    return { service: chosen, id }
  }

  const notifyChanged = (): void => options.onChange?.(currentTarget())

  row.append(service, destination, destinationText)
  const notice = el('div', { style: `font-size:12px;color:${T.sub};line-height:1.9` })
  wrap.append(row, notice)

  /** 実際に1通送ってみる。届いて初めて設定できたと分かる。 */
  const testBtn = el('button', { class: 'tc-link', text: 'テスト送信' })
  testBtn.addEventListener('click', () => {
    const chosen = currentTarget()
    if (chosen === null) {
      toast('送り先を選んでください', 'error')
      return
    }
    testBtn.setAttribute('disabled', '')
    void api.testNotify(chosen).then(
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

  /**
   * 送り先の選択肢を入れ替える。
   * 選べるものが無いときは**欄ごと隠す**。空のプルダウンを出しても選べず、
   * 何のための欄なのか分からない（実際にそう指摘された）。
   */
  /** 一覧が届く前に決まっていた選択（保存済みの設定を開き直したとき） */
  let pendingId: string | null = options.initial?.id ?? null

  const setDestinations = (
    items: readonly { value: string; label: string }[],
    placeholder: string,
  ): void => {
    destination.replaceChildren()
    destinationText.style.display = 'none'
    destination.style.display = items.length === 0 ? 'none' : ''
    if (items.length === 0) return
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
    // 保存済みの選択を戻す。一覧から消えていたら「選ぶ」に戻る（消えた先へ送り続けない）
    if (pendingId !== null && items.some((i) => i.value === pendingId)) {
      destination.value = pendingId
    }
    pendingId = null
  }

  /** 一覧が取れないサービスの送り先。手で入れてもらう */
  const setFreeDestination = (placeholder: string): void => {
    destination.style.display = 'none'
    destinationText.style.display = ''
    destinationText.placeholder = placeholder
    destinationText.value = pendingId ?? ''
    pendingId = null
  }

  const connectLink = el('button', { class: 'tc-link', text: 'Slackと連携する' })
  connectLink.addEventListener('click', () => {
    // 認可はブラウザ遷移。別タブで開いて、終わったらこの画面に戻ってもらう
    window.open('/oauth/slack/start', '_blank', 'noopener')
  })
  /** 入れたトークンを消す。消すとそのサービスへの通知（タスク・異常のお知らせ）が届かなくなる */
  const clearToken = async (service: 'chatwork' | 'line', label: string): Promise<void> => {
    const ok = await confirmCard({
      title: `${label}のトークンを消します`,
      message: `保存してある${label}のトークンを消します。`,
      detail: `消すと、${label}へ送るタスクや異常のお知らせが届かなくなります。もう一度使うにはトークンを入れ直してください。`,
      submitLabel: '消す',
      danger: true,
    })
    if (!ok) return
    try {
      await api.clearIntegration(service)
      toast(`${label}のトークンを消しました`)
      void refresh()
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  }
  const clearChatwork = el('button', { class: 'tc-link', text: 'トークンを消す' })
  clearChatwork.addEventListener('click', () => void clearToken('chatwork', 'チャットワーク'))

  const clearLine = el('button', { class: 'tc-link', text: 'トークンを消す' })
  clearLine.addEventListener('click', () => void clearToken('line', 'LINE'))

  const disconnect = el('button', { class: 'tc-link', text: '連携を解除' })
  disconnect.addEventListener('click', () => {
    void (async () => {
      const ok = await confirmCard({
        title: 'Slackの連携を解除します',
        message: 'このシステムとSlackの連携を解除します。',
        detail: '解除すると、Slackへ送るタスクや異常のお知らせが届かなくなります。もう一度使うには「Slackと連携する」からやり直してください。',
        submitLabel: '連携を解除',
        danger: true,
      })
      if (!ok) return
      try {
        await api.disconnectSlack()
        toast('Slackの連携を解除しました')
        void refresh()
      } catch (error) {
        toast((error as Error).message, 'error')
      }
    })()
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

  async function showLine(): Promise<void> {
    let status: Awaited<ReturnType<typeof api.lineStatus>>
    try {
      status = await api.lineStatus()
    } catch {
      notice.textContent = 'LINEの状態を取得できませんでした。'
      return
    }
    if (!status.configured) {
      const box = guideBox(
        'LINE公式アカウントのトークンを入れると、ここから送れるようになります',
        LINE_STEPS,
      )
      const token = secretInput('チャネルアクセストークン（長期）')
      box.append(
        credentialRow('控えたトークンをここに入れてください', [token], async () => {
          await api.saveIntegration({ line_channel_access_token: token.value.trim() })
        }),
      )
      notice.replaceChildren(box)
      return
    }
    setFreeDestination('空なら友だち全員へ')
    row.append(testBtn, clearLine)
    notice.textContent =
      'トークンが設定されています。送り先を空にすると、その公式アカウントを友だち追加した人全員に届きます。' +
      '特定の相手だけに送るときはユーザーID／グループIDを入れてください。'
  }

  async function refresh(): Promise<void> {
    row.replaceChildren(service, destination, destinationText)
    notice.replaceChildren()
    setDestinations([], '')
    const chosen = service.value as NotifyService
    if (chosen === 'none') return
    if (chosen === 'slack') await showSlack()
    else if (chosen === 'line') await showLine()
    else await showChatwork()
  }

  service.addEventListener('change', () => {
    // サービスを変えたら送り先は選び直し（前のサービスのIDは通じない）
    pendingId = null
    void refresh().then(notifyChanged)
  })
  destination.addEventListener('change', notifyChanged)
  destinationText.addEventListener('change', notifyChanged)
  // 資格情報を入れたら、その場で次の状態（連携ボタン／送り先の選択）へ進む
  wrap.addEventListener('sb-credential-saved', () => void refresh())
  const initial = options.initial ?? null
  if (initial !== null) service.value = initial.service
  void refresh()

  return { el: wrap, target: currentTarget }
}

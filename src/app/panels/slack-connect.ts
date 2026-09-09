/**
 * タスク作成画面の「実行結果のSlack通知」。
 *
 * 3つの状態を出し分ける:
 *   未設定   … Slackアプリがまだ無い。**取得手順をその場に出す**
 *   未連携   … 環境変数は入っている。「Slackと連携する」で認可へ
 *   連携済み … チャンネルを選べる
 *
 * 環境変数さえ入れば、この画面を直さなくてもすぐ連携できる。
 */
import { api } from '../api.ts'
import { T, el, toast } from '../ui.ts'

/** Slackアプリを作ってもらうための手順（未設定のときだけ出す） */
const SETUP_STEPS: readonly string[] = [
  'api.slack.com/apps を開き「Create New App」→「From scratch」でアプリを作る',
  'アプリ名（例: SquadBeyond通知）と、通知を送りたいワークスペースを選ぶ',
  '「OAuth & Permissions」→ Bot Token Scopes に channels:join / channels:read / chat:write / groups:read / im:read / mpim:read を追加する',
  '同じ画面の User Token Scopes に groups:write.invites を追加する',
  '同じ画面の「Redirect URLs」に、下に表示されている戻り先URLをそのまま登録する',
  '「Basic Information」の Client ID と Client Secret を控える',
  'Railway の環境変数に SLACK_CLIENT_ID と SLACK_CLIENT_SECRET を入れて再デプロイする',
]

export interface SlackFieldResult {
  el: HTMLElement
  /** 選ばれた送り先。未連携・未選択なら null */
  channelId: () => string | null
}

export function buildSlackField(): SlackFieldResult {
  const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:8px' })
  const row = el('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' })
  const select = document.createElement('select')
  select.className = 'tc-select'
  select.style.minWidth = '200px'
  const none = document.createElement('option')
  none.value = ''
  none.textContent = '通知しない'
  select.append(none)
  row.append(select)
  wrap.append(row)

  const notice = el('div', {
    style: `font-size:12px;color:${T.sub};line-height:1.9`,
  })

  /** 手順を並べる（未設定のときだけ） */
  const setupGuide = (redirectUri: string): HTMLElement => {
    const box = el('div', {
      style: [
        'border:1px solid #E6E9F0;border-radius:8px;background:#F8FAFC;padding:12px 14px',
        `font-size:12px;color:${T.text};line-height:1.9`,
      ].join(';'),
    })
    box.append(
      el('div', {
        text: 'Slackアプリを用意すると、ここから連携できるようになります',
        style: 'font-weight:700;margin-bottom:6px',
      }),
    )
    const list = document.createElement('ol')
    list.style.cssText = `margin:0 0 10px;padding-left:20px;color:${T.sub}`
    for (const step of SETUP_STEPS) {
      const li = document.createElement('li')
      li.textContent = step
      li.style.marginBottom = '3px'
      list.append(li)
    }
    box.append(list)

    // 戻り先URLは手順5でそのまま貼るものなので、コピーできるようにする
    const uriRow = el('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' })
    uriRow.append(el('span', { text: '戻り先URL', style: `font-size:11px;color:${T.sub}` }))
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
    uriRow.append(uri, copy)
    box.append(uriRow)
    return box
  }

  const connectLink = el('button', { class: 'tc-link', text: 'Slackと連携する' })
  connectLink.addEventListener('click', () => {
    // 認可はブラウザ遷移。別タブで開いて、終わったらこの画面に戻ってもらう
    window.open('/oauth/slack/start', '_blank', 'noopener')
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

  async function refresh(): Promise<void> {
    row.replaceChildren(select)
    notice.replaceChildren()

    let status: Awaited<ReturnType<typeof api.slackStatus>>
    try {
      status = await api.slackStatus()
    } catch {
      notice.textContent = 'Slackの連携状態を取得できませんでした。'
      return
    }

    if (!status.configured) {
      // まだSlackアプリが無い。何をすれば使えるようになるかをその場に出す。
      notice.replaceChildren(setupGuide(status.redirect_uri))
      return
    }
    if (!status.connected) {
      row.append(connectLink)
      notice.textContent = '連携すると、送り先のチャンネルを選べるようになります。'
      return
    }

    row.append(disconnect)
    notice.textContent =
      status.team_name === null || status.team_name === ''
        ? '連携済みです。'
        : `${status.team_name} と連携済みです。`
    try {
      const { channels } = await api.slackChannels()
      for (const c of channels) {
        const opt = document.createElement('option')
        opt.value = c.id
        opt.textContent = `#${c.name}`
        select.append(opt)
      }
    } catch (error) {
      notice.textContent = (error as Error).message
    }
  }

  wrap.append(notice)
  void refresh()
  return { el: wrap, channelId: () => (select.value === '' ? null : select.value) }
}

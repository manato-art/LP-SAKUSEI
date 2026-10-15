/**
 * マイページ > LP作成者（管理者だけ・2026-10-15 本人指定）。
 *
 * LP作成者を1人ずつ足す・パスワードを変える・消す。パスワードは管理者が決めて入力する（本人の選択）。
 * LP作成者は、自分が作ったページの LP づくり（Versionタブ・離脱防止ポップ・中間ページ・切り替え・基本情報）だけ使える。
 * サーバーでも同じ範囲で断っている（mock-server/lib/creator-access.ts）。
 */
import { creatorAccountsApi, type CreatorAccountEntry } from '../api-tools.ts'
import { T, el, toast } from '../ui.ts'
import { confirmCard, promptCard } from '../dialog.ts'
import { jstDateKey } from '../jst.ts'

const MIN_PASSWORD_LENGTH = 8

const passwordProblem = (value: string): string | null =>
  value.length < MIN_PASSWORD_LENGTH ? `パスワードは${MIN_PASSWORD_LENGTH}文字以上にしてください。` : null

const inputStyle =
  `padding:10px 12px;border:1px solid var(--sb-c-dddddd, #DDDDDD);border-radius:6px;font-size:14px;outline:none;min-width:0`

function textInput(type: 'email' | 'text' | 'password', placeholder: string, flex: string): HTMLInputElement {
  const input = document.createElement('input')
  input.type = type
  input.placeholder = placeholder
  input.autocomplete = type === 'password' ? 'new-password' : 'off'
  input.style.cssText = `${inputStyle};flex:${flex};font-family:${T.font}`
  return input
}

function smallButton(text: string, danger = false): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = text
  const color = danger ? '#E4432B' : T.primary
  button.style.cssText = `padding:6px 14px;border:1px solid ${color};border-radius:6px;background:transparent;color:${color};cursor:pointer;font-size:12px;font-family:${T.font};white-space:nowrap`
  return button
}

export async function renderCreatorAccounts(content: HTMLElement): Promise<void> {
  content.append(
    el('div', { style: `font-size:13px;color:${T.sub};line-height:1.8;margin-bottom:20px` }, [
      el('div', { text: 'LP作成者は、自分が作ったページのLPづくりだけができるアカウントです。' }),
      el('div', {
        text: '使えるもの: ページの作成・Version（編集・プレビュー）・離脱防止ポップ・中間ページ・切り替え・基本情報',
      }),
      el('div', { text: '使えないもの: 削除・レポートなどの数字・ツール・全体の設定・ほかの人のページ' }),
      el('div', {
        text: 'ログインの入口は「アクセス管理」の共有リンクと同じです。本人のメールアドレスと、ここで決めたパスワードで入ります。',
      }),
    ]),
  )

  // 追加フォーム（メール・名前・パスワード）
  const emailInput = textInput('email', 'メールアドレス', '2 1 200px')
  const nameInput = textInput('text', '名前', '1 1 120px')
  const passwordInput = textInput('password', `パスワード（${MIN_PASSWORD_LENGTH}文字以上）`, '1 1 160px')
  const addButton = document.createElement('button')
  addButton.type = 'button'
  addButton.textContent = '追加'
  addButton.style.cssText = `padding:10px 20px;border:none;border-radius:6px;background:${T.primary};color:${T.primaryInk};cursor:pointer;font-size:14px;font-family:${T.font};white-space:nowrap`
  content.append(
    el('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;align-items:center' }, [
      emailInput,
      nameInput,
      passwordInput,
      addButton,
    ]),
  )

  const listArea = el('div', {})
  content.append(listArea)

  let accounts: CreatorAccountEntry[] = []

  async function load(): Promise<void> {
    try {
      accounts = (await creatorAccountsApi.list()).creator_accounts
    } catch (error) {
      accounts = []
      toast(`LP作成者の読み込みに失敗しました: ${(error as Error).message}`, 'error')
    }
    renderList()
  }

  function renderList(): void {
    listArea.replaceChildren()
    if (accounts.length === 0) {
      listArea.append(
        el('div', {
          text: 'LP作成者はまだいません。上の欄から足せます。',
          style: `padding:20px;text-align:center;font-size:13px;color:${T.sub}`,
        }),
      )
      return
    }
    for (const account of accounts) {
      const changePassword = smallButton('パスワードを変える')
      changePassword.addEventListener('click', () => void resetPassword(account))
      const remove = smallButton('削除', true)
      remove.addEventListener('click', () => void removeAccount(account))
      listArea.append(
        el(
          'div',
          {
            style:
              'display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;padding:12px 8px;border-bottom:1px solid var(--sb-c-f2f2f2, #F2F2F2)',
          },
          [
            el('div', { style: 'min-width:0' }, [
              el('div', { text: account.name, style: `font-size:14px;font-weight:600;color:${T.text}` }),
              el('div', { text: account.email, style: `font-size:13px;color:${T.text};word-break:break-all` }),
              el('div', {
                text: `追加: ${jstDateKey(new Date(account.created_at))}`,
                style: `font-size:11px;color:${T.sub};margin-top:2px`,
              }),
            ]),
            el('div', { style: 'display:flex;gap:8px' }, [changePassword, remove]),
          ],
        ),
      )
    }
  }

  async function add(): Promise<void> {
    const email = emailInput.value.trim()
    const name = nameInput.value.trim()
    const password = passwordInput.value.trim()
    if (email === '' || name === '' || password === '') {
      toast('メールアドレス・名前・パスワードを入れてください', 'error')
      return
    }
    const problem = passwordProblem(password)
    if (problem !== null) {
      toast(problem, 'error')
      return
    }
    addButton.disabled = true
    try {
      await creatorAccountsApi.create({ email, name, password })
      emailInput.value = ''
      nameInput.value = ''
      passwordInput.value = ''
      toast(`${name} さんをLP作成者に足しました。メールアドレスとパスワードを本人に伝えてください`)
      await load()
    } catch (error) {
      // 同じメール・管理者のメールなどは、サーバーが理由を返す
      toast((error as Error).message, 'error')
    } finally {
      addButton.disabled = false
    }
  }

  async function resetPassword(account: CreatorAccountEntry): Promise<void> {
    const password = await promptCard({
      title: `${account.name} さんのパスワードを変えます`,
      label: `新しいパスワード（${MIN_PASSWORD_LENGTH}文字以上）`,
      inputType: 'password',
      submitLabel: '変える',
      validate: passwordProblem,
    })
    if (password === null) return
    try {
      await creatorAccountsApi.update(account.uid, { password })
      toast('パスワードを変えました。今ログインしている端末では入り直しになります')
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  }

  async function removeAccount(account: CreatorAccountEntry): Promise<void> {
    const ok = await confirmCard({
      title: 'LP作成者を削除します',
      message: `${account.name} さん（${account.email}）を削除します。この人は次からログインできなくなります。`,
      detail: 'この人が作ったページは消えません。管理者からは今までどおり見えます。',
      submitLabel: '削除する',
      danger: true,
    })
    if (!ok) return
    try {
      await creatorAccountsApi.remove(account.uid)
      toast('LP作成者を削除しました')
      await load()
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  }

  addButton.addEventListener('click', () => void add())
  for (const input of [emailInput, nameInput, passwordInput]) {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault()
        void add()
      }
    })
  }

  await load()
}

/**
 * アカウント設定 > チームメンバー（一覧・追加・権限の変更・削除）。
 *
 * このシステムのログインは「共通のパスワード＋アクセス管理のメールアドレス」で、人ごとのアカウントは無い。
 * なので権限は誰が何の担当かの目印で、操作は制限されない。画面にもそう書く（無い機能を有るように見せない）。
 * 追加するときに「この人がログインできるようにする」を選んだときだけ、アクセス管理にもメールを足す。
 */
import { accountApi, type TeamMember } from '../api-tools.ts'
import { confirmCard, formCard } from '../dialog.ts'
import { T, el, emptyState, toast } from '../ui.ts'
import { DATA_HEAD_CLASS, DATA_ROW_CLASS, DATA_TABLE_CLASS } from './data-ui.ts'

const ROLE_LABELS: Readonly<Record<string, string>> = {
  'team-owner': 'オーナー',
  admin: '管理者',
  member: 'メンバー',
  viewer: 'ゲスト',
}

/** 追加・変更で選べる権限（オーナーは最初の1人だけ） */
const ASSIGNABLE: readonly string[] = ['admin', 'member', 'viewer']

const GRID = 'grid-template-columns:minmax(90px,1fr) minmax(140px,1.6fr) 130px 90px'

const INPUT_STYLE = [
  'width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid var(--sb-c-dddddd, #DDDDDD)',
  `border-radius:6px;font-size:13px;font-family:${T.font};background:${T.surface};color:${T.text}`,
].join(';')

export async function renderMembers(content: HTMLElement): Promise<void> {
  content.append(
    el('div', {
      text: '権限は、誰が何の担当かの目印です。このシステムのログインは共通のパスワードとアクセス管理のメールアドレスで行うため、権限で操作は制限されません。',
      style: `font-size:12px;color:${T.sub};line-height:1.8;margin-bottom:14px`,
    }),
  )
  const add = el('button', {
    text: '＋ メンバーを追加',
    style: `padding:8px 16px;border:none;border-radius:6px;background:${T.primary};color:${T.primaryInk};cursor:pointer;font-size:13px;font-family:${T.font};margin-bottom:14px`,
  })
  add.type = 'button'
  const listArea = el('div', {})
  content.append(add, listArea)

  const reload = async (): Promise<void> => {
    let members: TeamMember[]
    try {
      members = (await accountApi.members()).members
    } catch (error) {
      listArea.replaceChildren(emptyState(`メンバーを読み込めませんでした: ${(error as Error).message}`))
      return
    }
    listArea.replaceChildren(buildTable(members, reload))
  }
  add.addEventListener('click', () => {
    void openAddForm().then((added) => {
      if (added) void reload()
    })
  })
  await reload()
}

function buildTable(members: readonly TeamMember[], reload: () => Promise<void>): HTMLElement {
  if (members.length === 0) return emptyState('チームメンバーはまだいません。')
  const wrap = el('div', { class: DATA_TABLE_CLASS, style: 'overflow-x:auto' })
  const head = el('div', {
    class: DATA_HEAD_CLASS,
    style: `display:grid;${GRID};gap:12px;padding:10px 8px;border-bottom:2px solid var(--sb-c-eeeeee, #EEEEEE);font-size:12px;color:${T.sub}`,
  })
  for (const h of ['名前', 'メール', '権限', '']) head.append(el('div', { text: h }))
  wrap.append(head)
  for (const m of members) wrap.append(buildRow(m, reload))
  return wrap
}

function buildRow(member: TeamMember, reload: () => Promise<void>): HTMLElement {
  const row = el('div', {
    class: DATA_ROW_CLASS,
    style: `display:grid;${GRID};gap:12px;padding:12px 8px;border-bottom:1px solid var(--sb-c-f2f2f2, #F2F2F2);font-size:13px;color:${T.text};align-items:center`,
  })
  const name = el('div', { text: member.name, style: 'overflow-wrap:anywhere' })
  const email = el('div', { text: member.email, style: 'overflow-wrap:anywhere' })
  const isOwner = member.role === 'team-owner'

  const role = el('div', {})
  if (isOwner) {
    role.textContent = ROLE_LABELS['team-owner'] ?? member.role
  } else {
    const select = roleSelect(member.role)
    select.setAttribute('aria-label', `${member.name}の権限`)
    select.addEventListener('change', () => {
      const next = select.value
      select.disabled = true
      void accountApi.updateMemberRole(member.uid, next).then(
        () => {
          toast(`${member.name}の権限を「${ROLE_LABELS[next] ?? next}」にしました`)
          void reload()
        },
        (error: Error) => {
          select.value = member.role
          select.disabled = false
          toast(error.message, 'error')
        },
      )
    })
    role.append(select)
  }

  const actions = el('div', {})
  if (!isOwner) {
    const del = el('button', {
      text: '削除',
      style: `padding:5px 12px;border:1px solid #E4432B;border-radius:6px;background:transparent;color:#E4432B;cursor:pointer;font-size:12px;font-family:${T.font}`,
    })
    del.type = 'button'
    del.addEventListener('click', () => void removeMember(member, reload))
    actions.append(del)
  }

  const labels = ['名前', 'メール', '権限', '操作']
  const cells = [name, email, role, actions]
  cells.forEach((c, i) => {
    c.dataset['label'] = labels[i] ?? ''
  })
  row.append(...cells)
  return row
}

function roleSelect(current: string): HTMLSelectElement {
  const select = document.createElement('select')
  select.style.cssText = `${INPUT_STYLE};padding:6px 8px`
  for (const value of ASSIGNABLE) {
    const opt = document.createElement('option')
    opt.value = value
    opt.textContent = ROLE_LABELS[value] ?? value
    select.append(opt)
  }
  select.value = ASSIGNABLE.includes(current) ? current : 'member'
  return select
}

async function removeMember(member: TeamMember, reload: () => Promise<void>): Promise<void> {
  const ok = await confirmCard({
    title: 'メンバーを削除します',
    message: `${member.name}（${member.email}）をチームメンバーから削除します。`,
    detail: 'アクセス管理のメールアドレスは消えません。ログインもできなくするには、アクセス管理のタブから削除してください。',
    submitLabel: '削除する',
    danger: true,
  })
  if (!ok) return
  try {
    await accountApi.deleteMember(member.uid)
    toast('メンバーを削除しました')
    await reload()
  } catch (error) {
    toast((error as Error).message, 'error')
  }
}

/** 追加のフォーム。追加できたら true */
function openAddForm(): Promise<boolean> {
  const body = el('div', { style: 'display:flex;flex-direction:column;gap:12px;min-width:0' })
  const field = (label: string, control: HTMLElement): HTMLElement =>
    el('label', { style: 'display:flex;flex-direction:column;gap:4px;font-size:12px;color:' + T.sub }, [label, control])

  const name = document.createElement('input')
  name.type = 'text'
  name.maxLength = 50
  name.placeholder = '例: 山田 花子'
  name.style.cssText = INPUT_STYLE
  const email = document.createElement('input')
  email.type = 'email'
  email.placeholder = 'name@example.com'
  email.style.cssText = INPUT_STYLE
  const role = roleSelect('member')

  const allow = document.createElement('input')
  allow.type = 'checkbox'
  allow.style.cssText = 'width:18px;height:18px;margin:2px 0 0;flex-shrink:0'
  const allowRow = el('label', { style: 'display:flex;gap:8px;align-items:flex-start;cursor:pointer' }, [
    allow,
    el('span', {}, [
      el('span', { text: 'この人がログインできるようにする（アクセス管理に追加）', style: `font-size:13px;color:${T.text}` }),
      el('span', {
        text: 'チェックすると、このメールアドレスでログインの入口（共有リンク）を通れるようになります。パスワードは別に伝えてください。',
        style: `display:block;font-size:11px;color:${T.sub};line-height:1.7;margin-top:2px`,
      }),
    ]),
  ])

  body.append(field('名前', name), field('メールアドレス', email), field('権限', role), allowRow)

  return formCard({
    title: 'メンバーを追加',
    body,
    submitLabel: '追加する',
    onSubmit: async () => {
      if (name.value.trim() === '') return '名前を入力してください'
      if (email.value.trim() === '') return 'メールアドレスを入力してください'
      const res = await accountApi.addMember({
        name: name.value.trim(),
        email: email.value.trim(),
        role: role.value,
        allow_login: allow.checked,
      })
      toast(
        res.allowed_email_added
          ? `${res.member.name}を追加し、アクセス管理にもメールアドレスを追加しました`
          : `${res.member.name}を追加しました`,
      )
      return null
    },
  })
}

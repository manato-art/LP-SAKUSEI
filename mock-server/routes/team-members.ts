/**
 * チームメンバーの追加・権限の変更・削除（アカウント設定 > チームメンバー）。
 *
 *   POST   /teams/members          … 追加（名前・メール・権限。allow_login のときだけアクセス管理にも足す）
 *   PUT    /teams/members/:uid     … 権限の変更
 *   DELETE /teams/members/:uid     … 削除
 *
 * ## 権限について（正直に書いておく）
 * このシステムのログインは「共通のパスワード＋アクセス管理のメールアドレス」（lib/admin-auth.ts）で、
 * 人ごとのアカウントもセッションも無い。なので権限（管理者 / メンバー / ゲスト）で操作は制限されない。
 * 誰が何の担当かの目印として持つだけ。
 *
 * オーナー（最初からいる1人・team-owner）は、権限の変更も削除もできない
 * （マイページの名前・メールと結びついているため・routes/users.ts）。招待でオーナーは作れない。
 */
import { Router } from 'express'
import { errorEnvelope } from '../lib/envelope.ts'
import { currentTeamId } from '../store/current-team.ts'
import { makeUid } from '../store/ids.ts'
import { freshUid } from '../store/actions-shared.ts'
import { getState, setState } from '../store/store.ts'
import { addAllowedEmail, hasAllowedEmail } from '../store/allowed-emails.ts'
import type { Member, MemberRole } from '../store/types.ts'

export const teamMembersRouter: Router = Router()

/** 招待・変更で選べる権限（オーナーは選べない） */
const ASSIGNABLE_ROLES: readonly MemberRole[] = ['admin', 'member', 'viewer']

function isAssignableRole(value: unknown): value is MemberRole {
  return typeof value === 'string' && (ASSIGNABLE_ROLES as readonly string[]).includes(value)
}

function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254
}

const ROLE_MESSAGE = '権限は 管理者 / メンバー / ゲスト のどれかを選んでください。'

teamMembersRouter.post('/teams/members', (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>
  const name = typeof body['name'] === 'string' ? body['name'].trim() : ''
  const email = typeof body['email'] === 'string' ? body['email'].trim().toLowerCase() : ''
  if (name === '' || name.length > 50) {
    res.status(422).json(errorEnvelope('validation_failed', '名前を入力してください（50文字まで）。'))
    return
  }
  if (!isEmailLike(email)) {
    res
      .status(422)
      .json(errorEnvelope('validation_failed', 'メールアドレスは name@example.com のような形で入力してください。'))
    return
  }
  if (!isAssignableRole(body['role'])) {
    res.status(422).json(errorEnvelope('validation_failed', ROLE_MESSAGE))
    return
  }
  const role = body['role']
  if (getState().members.some((m) => m.email.toLowerCase() === email)) {
    res.status(409).json(errorEnvelope('conflict', 'このメールアドレスのメンバーは既にいます。'))
    return
  }

  let created: Member | null = null
  setState((s) => {
    // 同じメールが割り込んで作られていたら足さない（二重登録を防ぐ）
    if (s.members.some((m) => m.email.toLowerCase() === email)) return s
    const id = s.nextId
    const member: Member = {
      id,
      uid: freshUid(s.members, id, (n) => makeUid('member', n)),
      name,
      email,
      role,
      team_id: currentTeamId(s),
    }
    created = member
    return { ...s, members: [...s.members, member], nextId: id + 1 }
  })
  if (created === null) {
    res.status(409).json(errorEnvelope('conflict', 'このメールアドレスのメンバーは既にいます。'))
    return
  }

  // ログインの許可は、画面で明示的に選んだときだけ足す（黙って入口を広げない）
  const wantsLogin = body['allow_login'] === true
  const alreadyAllowed = hasAllowedEmail(email)
  if (wantsLogin && !alreadyAllowed) addAllowedEmail(email)
  res.status(201).json({ member: created, allowed_email_added: wantsLogin && !alreadyAllowed })
})

teamMembersRouter.put('/teams/members/:uid', (req, res) => {
  const member = getState().members.find((m) => m.uid === req.params.uid)
  if (member === undefined) {
    res.status(404).json(errorEnvelope('not_found', 'メンバーが見つかりません。'))
    return
  }
  if (member.role === 'team-owner') {
    res.status(400).json(errorEnvelope('owner_locked', 'オーナーの権限は変えられません。'))
    return
  }
  const role = (req.body as Record<string, unknown> | undefined)?.['role']
  if (!isAssignableRole(role)) {
    res.status(422).json(errorEnvelope('validation_failed', ROLE_MESSAGE))
    return
  }
  setState((s) => ({
    ...s,
    members: s.members.map((m) => (m.uid === member.uid ? { ...m, role } : m)),
  }))
  res.json({ member: { ...member, role } })
})

teamMembersRouter.delete('/teams/members/:uid', (req, res) => {
  const member = getState().members.find((m) => m.uid === req.params.uid)
  if (member === undefined) {
    res.status(404).json(errorEnvelope('not_found', 'メンバーが見つかりません。'))
    return
  }
  if (member.role === 'team-owner') {
    res.status(400).json(errorEnvelope('owner_locked', 'オーナーは削除できません。'))
    return
  }
  // アクセス管理のメールアドレスは消さない（ログインの許可は別の設定。消すならアクセス管理から）
  setState((s) => ({ ...s, members: s.members.filter((m) => m.uid !== member.uid) }))
  res.status(204).end()
})

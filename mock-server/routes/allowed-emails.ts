/**
 * 許可メールアドレスの管理API（メールゲート用）。
 *
 * 管理画面からのCRUD操作を受け付ける。認証必須（apiAuthMiddleware配下で使う）。
 */
import { Router } from 'express'
import { errorEnvelope } from '../lib/envelope.ts'
import {
  addAllowedEmail,
  getAllowedEmails,
  removeAllowedEmailSafely,
} from '../store/allowed-emails.ts'
import { ADMIN_PATH } from '../config.ts'

export const allowedEmailsRouter: Router = Router()

/** 許可メール一覧 + 共有用の管理画面パス */
allowedEmailsRouter.get('/allowed_emails', (_req, res) => {
  res.json({ allowed_emails: getAllowedEmails(), admin_path: ADMIN_PATH })
})

/** メール追加 */
allowedEmailsRouter.post('/allowed_emails', (req, res) => {
  const body = req.body as { email?: unknown } | null
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  if (email === '') {
    res.status(400).json(errorEnvelope('validation_error', 'メールアドレスを入力してください。'))
    return
  }
  // 簡易バリデーション（@を含む最低限チェック）
  if (!email.includes('@') || email.length < 5) {
    res.status(400).json(errorEnvelope('validation_error', '有効なメールアドレスを入力してください。'))
    return
  }
  const entry = addAllowedEmail(email)
  res.status(201).json({ allowed_email: entry })
})

/** メール削除 */
allowedEmailsRouter.delete('/allowed_emails/:id', (req, res) => {
  const id = Number(req.params['id'])
  if (!Number.isFinite(id)) {
    res.status(400).json(errorEnvelope('validation_error', 'IDが不正です。'))
    return
  }
  // メールゲートの Cookie はどのメールで通ったかを持たない（パスワード由来の固定値）。
  // なので特定のメールを消しても、今ログインしている人の入り直しは残りのどれかで通れる。
  // 締め出しが起きるのは0件になるときだけなので、最後の1件だけを断る。
  const result = removeAllowedEmailSafely(id)
  if (result === 'not_found') {
    res.status(404).json(errorEnvelope('not_found', '指定されたメールアドレスが見つかりません。'))
    return
  }
  if (result === 'last_one') {
    res
      .status(400)
      .json(
        errorEnvelope(
          'last_allowed_email',
          '最後の1件は削除できません。0件になるとログインの入口が開かなくなり、誰もログインできなくなります。先に別のメールアドレスを追加してください。',
        ),
      )
    return
  }
  res.json({ ok: true })
})

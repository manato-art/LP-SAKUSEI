/**
 * エディタのタブごとの印（ヘッダー `X-Editor-Session`・2026-09-24）。
 *
 * 中身の保存がぶつかったか（別の人・別のタブが先に保存したか）を見分けるのに使う。
 * 自分のタブから出したリンク置換や履歴の復元で版が進んだぶんは、ぶつかったことにしない。
 * 画面が出す値なので、決まった形（英数字・_・-、64文字まで）以外は空として扱う。
 */
import type { Request } from 'express'

const SESSION_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

export function editorSessionOf(req: Request): string {
  const raw = req.get('x-editor-session') ?? ''
  return SESSION_PATTERN.test(raw) ? raw : ''
}

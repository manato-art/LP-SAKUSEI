/**
 * 「作成したWidget」と「お気に入り」（2026-10-24 本人「僕のアカウントで作ったウィジェットが他のアカウントで見れない」）。
 * 以前はブラウザの中だけにあった。中身の決まりは store/widget-library.ts。
 *
 *   GET    /widget_library                   … 作成したWidget（全員の分）と、このアカウントのお気に入り
 *   POST   /widget_library/created           … 作成したWidgetを足す（全員の一覧に入る）
 *   DELETE /widget_library/created/:id       … 消す（管理者だけ＝LP作成者は lib/creator-access.ts が断る）
 *   POST   /widget_library/favorites/toggle  … お気に入りを付ける・外す（このアカウントだけ）
 *   POST   /widget_library/import            … ブラウザに残っていた分を移す（一度だけ・同じものは二重にしない）
 */
import { Router } from 'express'
import type { Request } from 'express'
import { errorEnvelope } from '../lib/envelope.ts'
import { gateEmail } from '../lib/admin-auth.ts'
import { creatorOf } from '../lib/creator-access.ts'
import { externalizeDataUrls } from '../lib/uploads.ts'
import {
  addCreatedWidget,
  deleteCreatedWidget,
  importLocalLibrary,
  listCreatedWidgets,
  listFavorites,
  toggleFavorite,
} from '../store/widget-library.ts'

export const widgetLibraryRouter: Router = Router()

/**
 * お気に入りを分けるアカウント。LP作成者は uid、管理者は入口で入れたメール。
 * 以前の入口の印（メールを持たない）で入っている管理者は、メールが分かるまで 'admin' にまとめる
 */
function accountOf(req: Request): string {
  const creator = creatorOf(req)
  if (creator !== null) return `creator:${creator.uid}`
  const email = gateEmail(req)
  return email === null ? 'admin' : `admin:${email}`
}

const body = (req: Request): Record<string, unknown> =>
  req.body !== null && typeof req.body === 'object' && !Array.isArray(req.body) ? (req.body as Record<string, unknown>) : {}

/** 埋め込みの画像（data URL）をファイルにした中身（保存データを軽くする・versions と同じ） */
const lighter = (html: unknown): string => (typeof html === 'string' ? externalizeDataUrls(html).text : '')
const lighterSource = (source: unknown): unknown =>
  source === undefined || source === null ? undefined : (JSON.parse(externalizeDataUrls(JSON.stringify(source)).text) as unknown)

widgetLibraryRouter.get('/widget_library', (req, res) => {
  res.json({ created: listCreatedWidgets(), favorites: listFavorites(accountOf(req)) })
})

widgetLibraryRouter.post('/widget_library/created', (req, res) => {
  const input = body(req)
  const out = addCreatedWidget({ ...input, html: lighter(input['html']), source: lighterSource(input['source']) })
  if (!out.ok) {
    res.status(422).json(errorEnvelope(out.code, out.message))
    return
  }
  res.status(201).json({ widget: out.widget })
})

widgetLibraryRouter.delete('/widget_library/created/:id', (req, res) => {
  if (!deleteCreatedWidget(req.params.id)) {
    res.status(404).json(errorEnvelope('not_found', '作成したWidgetが見つかりません。'))
    return
  }
  res.status(204).end()
})

widgetLibraryRouter.post('/widget_library/favorites/toggle', (req, res) => {
  const input = body(req)
  const key = typeof input['key'] === 'string' ? input['key'] : ''
  if (key === '') {
    res.status(422).json(errorEnvelope('validation_failed', 'お気に入りにするWidgetが分かりません。'))
    return
  }
  const name = typeof input['name'] === 'string' && input['name'] !== '' ? input['name'] : key
  const account = accountOf(req)
  const favorite = toggleFavorite(account, { key, name, html: lighter(input['html']) })
  res.json({ favorite, favorites: listFavorites(account) })
})

widgetLibraryRouter.post('/widget_library/import', (req, res) => {
  const input = body(req)
  const lightened = (list: unknown, fields: readonly string[]): unknown =>
    Array.isArray(list)
      ? list.map((item: unknown) => {
          if (item === null || typeof item !== 'object' || Array.isArray(item)) return item
          const record = { ...(item as Record<string, unknown>) }
          for (const field of fields) {
            if (field === 'source') record[field] = lighterSource(record[field])
            else if (typeof record[field] === 'string') record[field] = lighter(record[field])
          }
          return record
        })
      : list
  const imported = importLocalLibrary(accountOf(req), {
    created: lightened(input['created'], ['html', 'source']),
    favorites: lightened(input['favorites'], ['html']),
  })
  res.json({ imported })
})

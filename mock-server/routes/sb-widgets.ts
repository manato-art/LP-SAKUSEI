/**
 * SquadBeyond の Widget 一覧（2026-10-26 本人「SquadBeyondのものを戻して」・中身は tools/sb-widgets/build.ts が作る）。
 *
 *   GET /sb_widgets       … 分類（id・名前・件数）
 *   GET /sb_widgets/:id   … その分類の Widget（id・名前・HTML・CSS）。新しいものが上
 *
 * /api の中なので、ログインした人だけが読める（LP作成者も読める＝lib/creator-access.ts）。
 * 中身はファイルのまま返す（1分類で最大 約3MB。読み直しで組み立て直さない）。
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Router } from 'express'
import { errorEnvelope } from '../lib/envelope.ts'

const SEED = join(dirname(fileURLToPath(import.meta.url)), '..', 'seed', 'sb-widgets')

export const sbWidgetsRouter: Router = Router()

sbWidgetsRouter.get('/sb_widgets', (_req, res) => {
  res.type('json').send(`{"categories":${readFileSync(join(SEED, 'categories.json'), 'utf8')}}`)
})

sbWidgetsRouter.get('/sb_widgets/:id', (req, res) => {
  const id = req.params['id'] ?? ''
  const file = join(SEED, `parts-${id}.json`)
  if (!/^\d{1,3}$/.test(id) || !existsSync(file)) {
    res.status(404).json(errorEnvelope('not_found', 'その分類はありません。'))
    return
  }
  res.type('json').send(`{"parts":${readFileSync(file, 'utf8')}}`)
})

/**
 * SquadBeyond の Widget 一覧（2026-10-26 本人「SquadBeyondのものを戻して」・中身は tools/sb-widgets/build.ts が作る）。
 *
 *   GET /sb_widgets       … 分類（id・名前・件数）
 *   GET /sb_widgets/:id   … その分類の Widget（id・名前・HTML・CSS）。新しいものが上
 *   GET /sb_widgets/search?q= … 全部の分類から名前で探す（2026-10-27 指示㉕・合う物を60件まで＋合う数）
 *
 * /api の中なので、ログインした人だけが読める（LP作成者も読める＝lib/creator-access.ts）。
 * 中身はファイルのまま返す（1分類で最大 約3MB。読み直しで組み立て直さない）。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Router } from 'express'
import { errorEnvelope } from '../lib/envelope.ts'

const SEED = join(dirname(fileURLToPath(import.meta.url)), '..', 'seed', 'sb-widgets')

export const sbWidgetsRouter: Router = Router()

sbWidgetsRouter.get('/sb_widgets', (_req, res) => {
  res.type('json').send(`{"categories":${readFileSync(join(SEED, 'categories.json'), 'utf8')}}`)
})

interface SbPartFile {
  readonly id: number
  readonly name: string
  readonly html: string
  readonly css: string
}

/** 探すときに返す数（多すぎると一覧が重い。言葉を足してしぼってもらう） */
const SEARCH_LIMIT = 60

/** 全部の分類の Widget（初めて探したときに読み、覚えておく＝ファイルは中身が変わらない） */
let allParts: readonly SbPartFile[] | null = null
function loadAllParts(): readonly SbPartFile[] {
  allParts ??= readdirSync(SEED)
    .filter((name) => /^parts-\d{1,3}\.json$/.test(name))
    .flatMap((name) => JSON.parse(readFileSync(join(SEED, name), 'utf8')) as SbPartFile[])
  return allParts
}

/**
 * 全部の分類から名前で探す（2026-10-27 指示㉕ 本人「見本ってところ消してOK」→ 選択「全部の見本から探す」）。
 * 画面で全部（約1,600件・13MB）を読むと重いので、ここで探して合う物だけ返す。:id より前に置く
 */
sbWidgetsRouter.get('/sb_widgets/search', (req, res) => {
  const q = (typeof req.query['q'] === 'string' ? req.query['q'] : '').trim().toLowerCase().slice(0, 100)
  if (q === '') {
    res.json({ parts: [], total: 0 })
    return
  }
  const found = loadAllParts().filter((part) => part.name.toLowerCase().includes(q))
  res.json({ parts: found.slice(0, SEARCH_LIMIT), total: found.length })
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

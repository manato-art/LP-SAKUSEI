/**
 * メディア（商品検索フォーム）と商品のAPI。
 * 実SB「ツール > メディア」= /teams/product_search_forms に対応する。
 *
 * 実物は2タブ:
 *   メディア一覧（#teamSearchForms）… 検索項目の定義。テンプレートから作る
 *   商品一覧（#teamProductIndex）  … 絞り込まれる側の商品マスタ。CSVインポートあり
 *
 * 既存の `/teams/product_search_forms`（GET・一覧を返すだけ）は teams.ts にあるが、
 * 作成・更新・削除と商品側はここで足す。
 */
import { Router } from 'express'
import { getState, setState } from '../store/store.ts'
import { errorEnvelope } from '../lib/envelope.ts'
import { makeUid } from '../store/ids.ts'
import { freshUid } from '../store/actions-shared.ts'
import { currentTeamId } from '../store/current-team.ts'
import { MEDIA_TEMPLATES, findMediaTemplate, type MediaField } from '../store/media-templates.ts'
import type { Product, ProductSearchForm, State } from '../store/types.ts'
import { externalizeDataUrls } from '../lib/uploads.ts'

export const mediaRouter: Router = Router()

/** テンプレート一覧（画面のプルダウン） */
mediaRouter.get('/teams/product_search_forms/templates', (_req, res) => {
  res.json({
    templates: MEDIA_TEMPLATES.map((t) => ({ id: t.id, name: t.name })),
  })
})

/**
 * メディアを作る。
 * 実物の注記どおり「メディア名 ※入力がない場合は自動で登録されます」。
 */
mediaRouter.post('/teams/product_search_forms', (req, res) => {
  const body = (req.body ?? {}) as { template_id?: unknown; name?: unknown }
  const templateId = typeof body.template_id === 'string' ? body.template_id : ''
  const template = findMediaTemplate(templateId)
  if (template === undefined) {
    res.status(422).json(errorEnvelope('invalid', 'テンプレートを選択してください。'))
    return
  }
  const typed = typeof body.name === 'string' ? body.name.trim() : ''
  let created: ProductSearchForm | null = null
  setState((s) => {
    const id = s.nextId
    const auto = `${template.name} ${s.productSearchForms.length + 1}`
    created = {
      id,
      uid: freshUid(s.productSearchForms, id, (n) => makeUid('productSearchForm', n)),
      team_id: currentTeamId(s),
      name: typed === '' ? auto : typed,
      keyword: '',
      // テンプレートの中身をコピーする（以後この1件だけが変わる）
      fields: template.fields.map((f) => ({ ...f, options: [...f.options] })),
    }
    return { ...s, productSearchForms: [...s.productSearchForms, created], nextId: id + 1 }
  })
  res.status(201).json({ product_search_form: created })
})

/** メディアの更新（項目名・見せ方・紐付け・選択肢） */
mediaRouter.put('/teams/product_search_forms/:uid', (req, res) => {
  const body = (req.body ?? {}) as { name?: unknown; fields?: unknown }
  const state = getState()
  const found = state.productSearchForms.find((m) => m.uid === req.params.uid)
  if (found === undefined) {
    res.status(404).json(errorEnvelope('not_found', 'メディアが見つかりません。'))
    return
  }
  let updated: ProductSearchForm | null = null
  setState((s) => ({
    ...s,
    productSearchForms: s.productSearchForms.map((m) => {
      if (m.uid !== req.params.uid) return m
      updated = {
        ...m,
        name: typeof body.name === 'string' && body.name.trim() !== '' ? body.name.trim() : m.name,
        fields: Array.isArray(body.fields) ? (body.fields as MediaField[]) : m.fields,
      }
      return updated
    }),
  }))
  res.json({ product_search_form: updated })
})

mediaRouter.delete('/teams/product_search_forms/:uid', (req, res) => {
  setState((s) => ({
    ...s,
    productSearchForms: s.productSearchForms.filter((m) => m.uid !== req.params.uid),
  }))
  res.status(204).end()
})

/* ── 商品一覧 ── */

function toNumber(v: unknown, max?: number): number {
  const n = typeof v === 'number' ? v : Number(typeof v === 'string' ? v : NaN)
  if (!Number.isFinite(n) || n < 0) return 0
  return max === undefined ? Math.round(n) : Math.min(max, Math.round(n))
}

function productFrom(body: Record<string, unknown>, base: Partial<Product>): Omit<Product, 'id' | 'uid' | 'team_id'> {
  const text = (k: string, fallback: string): string =>
    typeof body[k] === 'string' ? (body[k] as string) : fallback
  return {
    name: text('name', base.name ?? ''),
    price: body['price'] === undefined ? (base.price ?? 0) : toNumber(body['price']),
    rating: body['rating'] === undefined ? (base.rating ?? 0) : toNumber(body['rating'], 5),
    site_url: text('site_url', base.site_url ?? ''),
    description: text('description', base.description ?? ''),
    // 商品画像が埋め込み（data URL）なら別ファイルにする
    image: externalizeDataUrls(text('image', base.image ?? '')).text,
  }
}

mediaRouter.get('/teams/products', (_req, res) => {
  res.json({ products: getState().products })
})

mediaRouter.post('/teams/products', (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>
  if (typeof body['name'] !== 'string' || body['name'].trim() === '') {
    res.status(422).json(errorEnvelope('invalid', '名前を入力してください。'))
    return
  }
  let created: Product | null = null
  setState((s) => {
    const id = s.nextId
    created = {
      id,
      uid: freshUid(s.products, id, (n) => makeUid('product', n)),
      team_id: currentTeamId(s),
      ...productFrom(body, {}),
    }
    return { ...s, products: [...s.products, created], nextId: id + 1 }
  })
  res.status(201).json({ product: created })
})

mediaRouter.put('/teams/products/:uid', (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>
  const found = getState().products.find((p) => p.uid === req.params.uid)
  if (found === undefined) {
    res.status(404).json(errorEnvelope('not_found', '商品が見つかりません。'))
    return
  }
  let updated: Product | null = null
  setState((s) => ({
    ...s,
    products: s.products.map((p) => {
      if (p.uid !== req.params.uid) return p
      updated = { ...p, ...productFrom(body, p) }
      return updated
    }),
  }))
  res.json({ product: updated })
})

mediaRouter.delete('/teams/products/:uid', (req, res) => {
  setState((s) => ({ ...s, products: s.products.filter((p) => p.uid !== req.params.uid) }))
  res.status(204).end()
})

/**
 * CSVインポート（実物の「サンプルCSV」「CSVインポート」に対応）。
 * 1行目は見出し。列は 名前 / 価格(税抜) / 評価(1~5) / サイトURL / 説明文 の順。
 */
export const PRODUCT_CSV_HEADER = '名前,価格(税抜),評価(1~5),サイトURL,説明文'

/** CSVの1行を分解する（引用符で囲まれたカンマを壊さない） */
export function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i] as string
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        cur += c
      }
    } else if (c === '"') {
      quoted = true
    } else if (c === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out
}

/** CSV本文 → 商品の入力。見出し行は読み飛ばす。名前が空の行は捨てる。 */
export function parseProductCsv(csv: string): Omit<Product, 'id' | 'uid' | 'team_id'>[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== '')
  const body = lines.length > 0 && (lines[0] ?? '').startsWith('名前') ? lines.slice(1) : lines
  return body
    .map((line) => {
      const [name = '', price = '', rating = '', site = '', desc = ''] = parseCsvLine(line)
      return {
        name: name.trim(),
        price: toNumber(price),
        rating: toNumber(rating, 5),
        site_url: site.trim(),
        description: desc.trim(),
        image: '',
      }
    })
    .filter((p) => p.name !== '')
}

mediaRouter.get('/teams/products/sample_csv', (_req, res) => {
  res.type('text/csv; charset=utf-8').send(
    `${PRODUCT_CSV_HEADER}\n商品A,1980,4,https://example.test/a,説明文のサンプルです\n`,
  )
})

mediaRouter.post('/teams/products/import', (req, res) => {
  const csv = typeof (req.body as { csv?: unknown })?.csv === 'string'
    ? ((req.body as { csv: string }).csv)
    : ''
  const rows = parseProductCsv(csv)
  if (rows.length === 0) {
    res.status(422).json(errorEnvelope('invalid', '取り込める行がありませんでした。'))
    return
  }
  setState((s: State) => {
    // 取り込む行ごとに、id と同じ通し番号で uid を付ける（件数から作ると、削除のあとに既存と重なる）
    const added = rows.reduce<Product[]>((list, r, i) => {
      const id = s.nextId + i
      const product: Product = {
        id,
        uid: freshUid([...s.products, ...list], id, (n) => makeUid('product', n)),
        team_id: currentTeamId(s),
        ...r,
      }
      return [...list, product]
    }, [])
    return { ...s, products: [...s.products, ...added], nextId: s.nextId + rows.length }
  })
  res.json({ imported: rows.length })
})

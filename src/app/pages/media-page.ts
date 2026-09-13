/**
 * メディア（実SB「ツール > メディア」= /teams/product_search_forms）の機能実装。
 *
 * 実物を 2026-09-10 に実機で確認した画面:
 *
 *   [メディア一覧] [商品一覧]           ← 上部の2タブ
 *   ┌──────────────────┬────────────────────────────────────┐
 *   │ メディア名 [検索]  │ 新規作成                            │
 *   │ （一覧）          │ テンプレートから選択 ※メディア名以外… │
 *   │                  │ [選択してください ▾]                 │
 *   │ + 新規作成        │ メディア名 ※入力がない場合は自動で…   │
 *   │                  │ [保存する]                          │
 *   │                  │ 項目名 / 選択肢 / メディアタイプ /    │
 *   │                  │ 商品への選択肢の紐付け / 表示プレビュー │
 *   └──────────────────┴────────────────────────────────────┘
 *
 * 商品一覧タブは 名前 / 価格(税抜) / 評価(1~5) / サイトURL / 説明文 と
 * 画像アップロード、サンプルCSV・CSVインポート。
 */
import { api, type Media, type MediaField, type Product } from '../api.ts'
import { toast } from '../ui.ts'
import { buildToolGuide } from './tool-guide.ts'

type Tab = 'media' | 'product'

const FIELD_TYPES: readonly [MediaField['type'], string][] = [
  ['button', 'ボタン'],
  ['select_box', 'セレクトボックス'],
  ['min_max', '上限下限メディア'],
  ['check_box', 'チェックボックス'],
]

const FIELD_LINKS: readonly [MediaField['link'], string][] = [
  ['single', '単一'],
  ['multiple', '複数'],
]

export async function renderMediaPage(host: HTMLElement): Promise<void> {
  injectStyles()
  host.innerHTML = ''

  let tab: Tab = 'media'
  let templates: { id: string; name: string }[] = []
  let mediaList: Media[] = []
  let products: Product[] = []
  let selectedMedia: string | null = null
  let selectedProduct: string | null = null

  const root = h('div', 'md-page')
  const tabs = h('div', 'md-tabs')
  const guideSlot = h('div', 'md-guide-slot')
  const body = h('div', 'md-body')
  const left = h('div', 'md-left')
  const right = h('div', 'md-right')
  body.append(left, right)
  root.append(tabs, guideSlot, body)
  host.append(root)

  for (const [id, label] of [
    ['media', 'メディア一覧'],
    ['product', '商品一覧'],
  ] as [Tab, string][]) {
    const b = h('button', 'md-tab', label) as HTMLButtonElement
    b.type = 'button'
    b.dataset['tab'] = id
    b.addEventListener('click', () => {
      tab = id
      selectedMedia = null
      selectedProduct = null
      render()
    })
    tabs.append(b)
  }

  async function load(): Promise<void> {
    try {
      const [t, m, p] = await Promise.all([
        api.mediaTemplates(),
        api.mediaList(),
        api.products(),
      ])
      templates = t.templates
      mediaList = m.product_search_forms
      products = p.products
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  /* ══ 左: 一覧 ══ */
  function renderLeft(): void {
    left.innerHTML = ''
    const headRow = h('div', 'md-left-head')
    headRow.append(h('span', 'md-left-title', tab === 'media' ? 'メディア名' : '商品名'))
    const search = document.createElement('input')
    search.type = 'search'
    search.className = 'md-search'
    search.placeholder = tab === 'media' ? 'メディア名検索' : '商品名検索'
    headRow.append(search)
    left.append(headRow)

    const list = h('div', 'md-list')
    left.append(list)

    const fill = (): void => {
      const q = search.value.trim()
      list.innerHTML = ''
      const rows: { uid: string; name: string }[] =
        tab === 'media'
          ? mediaList.map((m) => ({ uid: m.uid, name: m.name }))
          : products.map((p) => ({ uid: p.uid, name: p.name }))
      const shown = rows.filter((r) => q === '' || r.name.includes(q))
      for (const r of shown) {
        const on = (tab === 'media' ? selectedMedia : selectedProduct) === r.uid
        const item = h('button', `md-item${on ? ' on' : ''}`, r.name) as HTMLButtonElement
        item.type = 'button'
        item.addEventListener('click', () => {
          if (tab === 'media') selectedMedia = r.uid
          else selectedProduct = r.uid
          render()
        })
        list.append(item)
      }
      if (shown.length === 0) {
        list.append(
          h(
            'div',
            'md-empty',
            q !== ''
              ? '見つかりませんでした'
              : tab === 'media'
                ? '右のテンプレートから作成してください'
                : '右のフォームか、下のCSVインポートから登録してください',
          ),
        )
      }
    }
    search.addEventListener('input', fill)
    fill()

    const add = h('button', 'md-add', '＋ 新規作成') as HTMLButtonElement
    add.type = 'button'
    add.addEventListener('click', () => {
      if (tab === 'media') selectedMedia = null
      else selectedProduct = null
      render()
    })
    left.append(add)

    if (tab === 'product') {
      const csv = h('div', 'md-csv')
      const sample = h('button', 'md-btn-ghost', 'サンプルCSV') as HTMLButtonElement
      sample.type = 'button'
      sample.addEventListener('click', () => {
        // 取り込み用の見出しと1行を、そのままコピーできる形で出す
        toast('名前,価格(税抜),評価(1~5),サイトURL,説明文 の順で作ってください')
      })
      const file = document.createElement('input')
      file.type = 'file'
      file.accept = '.csv,text/csv'
      file.hidden = true
      const imp = h('button', 'md-btn-primary', 'CSVインポート') as HTMLButtonElement
      imp.type = 'button'
      imp.addEventListener('click', () => file.click())
      file.addEventListener('change', () => {
        const f = file.files?.[0]
        if (f === undefined) return
        void f.text().then(async (text) => {
          try {
            const res = await api.importProductCsv(text)
            toast(`${res.imported}件の商品を取り込みました`)
            await load()
            render()
          } catch (e) {
            toast((e as Error).message, 'error')
          }
        })
      })
      csv.append(sample, imp, file)
      left.append(csv)
    }
  }

  /* ══ 右: フォーム ══ */
  function renderRight(): void {
    right.innerHTML = ''
    if (tab === 'media') renderMediaForm()
    else renderProductForm()
  }

  function renderMediaForm(): void {
    const current = mediaList.find((m) => m.uid === selectedMedia) ?? null
    right.append(h('div', 'md-right-title', current === null ? '新規作成' : current.name))

    if (current === null) {
      right.append(
        h('div', 'md-note', 'テンプレートから選択 ※メディア名以外の値は保存後変更可能です。'),
      )
      const sel = document.createElement('select')
      sel.className = 'md-select'
      sel.append(opt('', '選択してください'))
      for (const t of templates) sel.append(opt(t.id, t.name))
      right.append(sel)

      right.append(h('div', 'md-note', 'メディア名 ※入力がない場合は自動で登録されます'))
      const name = textInput('GDN×美容系')
      right.append(name)

      const save = h('button', 'md-save', '保存する') as HTMLButtonElement
      save.type = 'button'
      save.addEventListener('click', () => {
        void (async () => {
          if (sel.value === '') {
            toast('テンプレートを選択してください', 'error')
            return
          }
          try {
            const res = await api.createMedia(sel.value, name.value)
            selectedMedia = res.product_search_form.uid
            await load()
            render()
            toast('メディアを作成しました')
          } catch (e) {
            toast((e as Error).message, 'error')
          }
        })()
      })
      right.append(save)

      // テンプレートを選んだら、その中身をプレビューする（実物と同じ）
      const preview = h('div', 'md-fields')
      right.append(preview)
      sel.addEventListener('change', () => {
        preview.innerHTML = ''
        // まだ保存前なので、テンプレートの中身はサーバーに聞かず作成後に出す
        preview.append(
          h('div', 'md-note', '保存すると、このテンプレートの項目が編集できるようになります。'),
        )
      })
      return
    }

    // 保存済み: 名前と項目を編集できる
    const name = textInput('メディア名')
    name.value = current.name
    right.append(h('div', 'md-note', 'メディア名'), name)

    const fields = current.fields.map((f) => ({ ...f, options: [...f.options] }))
    const list = h('div', 'md-fields')
    right.append(list)
    for (const [i, f] of fields.entries()) list.append(fieldCard(f, i, fields, list))

    const bar = h('div', 'md-actions')
    const save = h('button', 'md-save', '保存する') as HTMLButtonElement
    save.type = 'button'
    save.addEventListener('click', () => {
      void (async () => {
        try {
          await api.updateMedia(current.uid, { name: name.value, fields })
          await load()
          render()
          toast('保存しました')
        } catch (e) {
          toast((e as Error).message, 'error')
        }
      })()
    })
    const del = h('button', 'md-delete', '削除する') as HTMLButtonElement
    del.type = 'button'
    del.addEventListener('click', () => {
      void (async () => {
        try {
          await api.deleteMedia(current.uid)
          selectedMedia = null
          await load()
          render()
          toast('削除しました')
        } catch (e) {
          toast((e as Error).message, 'error')
        }
      })()
    })
    bar.append(save, del)
    right.append(bar)
  }

  /** 項目1つぶんのカード（項目名 / 選択肢 / メディアタイプ / 紐付け / 表示プレビュー） */
  function fieldCard(
    draft: MediaField,
    index: number,
    all: MediaField[],
    host2: HTMLElement,
  ): HTMLElement {
    const card = h('div', 'md-field')
    const grid = h('div', 'md-field-grid')
    const leftCol = h('div', 'md-field-col')
    const rightCol = h('div', 'md-field-col')

    leftCol.append(h('div', 'md-label', '項目名'))
    const name = textInput('')
    name.value = draft.name
    name.addEventListener('input', () => {
      draft.name = name.value
      repaint()
    })
    leftCol.append(name)

    leftCol.append(h('div', 'md-label', 'メディアタイプ'))
    const type = document.createElement('select')
    type.className = 'md-select'
    for (const [v, label] of FIELD_TYPES) type.append(opt(v, label))
    type.value = draft.type
    type.addEventListener('change', () => {
      draft.type = type.value as MediaField['type']
      repaint()
    })
    leftCol.append(type)

    leftCol.append(h('div', 'md-label', '商品への選択肢の紐付け'))
    const link = document.createElement('select')
    link.className = 'md-select'
    for (const [v, label] of FIELD_LINKS) link.append(opt(v, label))
    link.value = draft.link
    link.addEventListener('change', () => {
      draft.link = link.value as MediaField['link']
    })
    leftCol.append(link)

    rightCol.append(h('div', 'md-label', '選択肢'))
    // 先頭の「こだわらない」は実物と同じく固定（消せない）
    for (const [oi, o] of draft.options.entries()) {
      if (oi === 0) {
        rightCol.append(h('div', 'md-option-fixed', o))
        continue
      }
      const row = h('div', 'md-option-row')
      const input = textInput('未入力')
      input.value = o
      input.addEventListener('input', () => {
        draft.options[oi] = input.value
        repaint()
      })
      const rm = h('button', 'md-x', '×') as HTMLButtonElement
      rm.type = 'button'
      rm.addEventListener('click', () => {
        draft.options.splice(oi, 1)
        redraw()
      })
      row.append(input, rm)
      rightCol.append(row)
    }
    const addOpt = h('button', 'md-add-opt', '＋ 選択肢を追加') as HTMLButtonElement
    addOpt.type = 'button'
    addOpt.addEventListener('click', () => {
      draft.options.push('')
      redraw()
    })
    rightCol.append(addOpt)

    grid.append(leftCol, rightCol)
    const preview = h('div', 'md-preview')
    card.append(grid, preview)

    function repaint(): void {
      preview.innerHTML = ''
      preview.append(h('div', 'md-preview-title', '表示プレビュー'))
      preview.append(h('div', 'md-preview-name', draft.name))
      const pills = h('div', 'md-pills')
      for (const [pi, o] of draft.options.entries()) {
        if (o === '') continue
        pills.append(h('span', `md-pill${pi === 0 ? ' on' : ''}`, o))
      }
      preview.append(pills)
    }
    function redraw(): void {
      host2.replaceChild(fieldCard(draft, index, all, host2), card)
    }
    repaint()
    return card
  }

  function renderProductForm(): void {
    const current = products.find((p) => p.uid === selectedProduct) ?? null
    right.append(h('div', 'md-right-title', current === null ? '新規作成' : current.name))

    const image = document.createElement('img')
    image.className = 'md-product-image'
    image.hidden = current === null || current.image === ''
    if (current !== null && current.image !== '') image.src = current.image
    let imageData = current?.image ?? ''

    const pick = h('button', 'md-btn-ghost', '新しい画像をアップロード') as HTMLButtonElement
    pick.type = 'button'
    const file = document.createElement('input')
    file.type = 'file'
    file.accept = 'image/*'
    file.hidden = true
    pick.addEventListener('click', () => file.click())
    file.addEventListener('change', () => {
      const f = file.files?.[0]
      if (f === undefined) return
      const reader = new FileReader()
      reader.addEventListener('load', () => {
        imageData = String(reader.result ?? '')
        image.src = imageData
        image.hidden = false
      })
      reader.readAsDataURL(f)
    })
    right.append(pick, file, image)

    const name = labelled('名前', '名前', current?.name ?? '')
    const price = labelled('価格(税抜)', '価格(税抜)', String(current?.price ?? ''))
    const rating = labelled('評価(1~5)', '評価', String(current?.rating ?? ''))
    const url = labelled('サイトURL', 'サイトURL', current?.site_url ?? '')
    right.append(name.wrap, price.wrap, rating.wrap, url.wrap)

    right.append(h('div', 'md-label', '説明文'))
    const desc = document.createElement('textarea')
    desc.className = 'md-textarea'
    desc.placeholder = '説明文'
    desc.value = current?.description ?? ''
    right.append(desc)

    const bar = h('div', 'md-actions')
    const save = h('button', 'md-save', '保存する') as HTMLButtonElement
    save.type = 'button'
    save.addEventListener('click', () => {
      void (async () => {
        const payload = {
          name: name.input.value,
          price: Number(price.input.value) || 0,
          rating: Number(rating.input.value) || 0,
          site_url: url.input.value,
          description: desc.value,
          image: imageData,
        }
        try {
          if (current === null) {
            const res = await api.createProduct(payload)
            selectedProduct = res.product.uid
          } else {
            await api.updateProduct(current.uid, payload)
          }
          await load()
          render()
          toast('保存しました')
        } catch (e) {
          toast((e as Error).message, 'error')
        }
      })()
    })
    bar.append(save)
    if (current !== null) {
      const del = h('button', 'md-delete', '削除する') as HTMLButtonElement
      del.type = 'button'
      del.addEventListener('click', () => {
        void (async () => {
          try {
            await api.deleteProduct(current.uid)
            selectedProduct = null
            await load()
            render()
            toast('削除しました')
          } catch (e) {
            toast((e as Error).message, 'error')
          }
        })()
      })
      bar.append(del)
    }
    right.append(bar)
  }

  /**
   * この画面はメディア（絞り込みの条件）と商品（絞り込まれる中身）の2つでできている。
   * タブが2枚あるだけだと関係が分からないので、それぞれの役割を書く。
   */
  function renderGuide(): void {
    guideSlot.innerHTML = ''
    const guide =
      tab === 'media'
        ? buildToolGuide({
            id: 'media-forms',
            summary:
              'LPに置く「絞り込み検索」の条件を作る画面です。ここで作った条件で、商品一覧に登録した商品をしぼり込みます。',
            steps: [
              { label: 'テンプレートを選んで作成', done: mediaList.length > 0 },
              { label: '項目名や選択肢を整える' },
              { label: '「商品一覧」で商品を登録する', done: products.length > 0 },
            ],
          })
        : buildToolGuide({
            id: 'media-products',
            summary:
              '絞り込まれる側の商品を登録する画面です。件数が多いときはCSVでまとめて取り込めます。',
            steps: [
              { label: '商品を登録する（CSV取り込み可）', done: products.length > 0 },
              { label: '「メディア一覧」で絞り込み条件を作る', done: mediaList.length > 0 },
            ],
          })
    if (guide !== null) guideSlot.append(guide)
  }

  function render(): void {
    for (const b of tabs.querySelectorAll('button')) {
      b.classList.toggle('on', b.dataset['tab'] === tab)
    }
    renderGuide()
    renderLeft()
    renderRight()
  }

  await load()
  render()
}

/* ── 小さな部品 ── */

function h(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function opt(value: string, label: string): HTMLOptionElement {
  const o = document.createElement('option')
  o.value = value
  o.textContent = label
  return o
}

function textInput(placeholder: string): HTMLInputElement {
  const i = document.createElement('input')
  i.type = 'text'
  i.className = 'md-input'
  i.placeholder = placeholder
  return i
}

function labelled(
  label: string,
  placeholder: string,
  value: string,
): { wrap: HTMLElement; input: HTMLInputElement } {
  const wrap = h('div', 'md-row')
  wrap.append(h('div', 'md-label', label))
  const input = textInput(placeholder)
  input.value = value
  wrap.append(input)
  return { wrap, input }
}

function injectStyles(): void {
  if (document.getElementById('md-css') !== null) return
  const s = document.createElement('style')
  s.id = 'md-css'
  s.textContent = `
    .md-page{display:flex;flex-direction:column;height:100%;min-height:0;font-size:13px;color:var(--sb-c-333333, #333333)}
    .md-tabs{display:flex;flex-direction:row;justify-content:center;gap:60px;padding:12px 0 14px;flex-shrink:0}
    .md-tab{border:none;background:none;font-size:13px;color:var(--sb-c-666666, #666666);cursor:pointer;
      padding:5px 16px;border-radius:4px}
    .md-tab.on{background:var(--sb-c-eef0f4, #EEF0F4);color:var(--sb-c-111111, #111111);font-weight:600}
    .md-guide-slot{padding:0 20px;flex-shrink:0}
    .md-body{flex:1;min-height:0;display:grid;grid-template-columns:300px 1fr;gap:20px;
      padding:0 20px 20px}
    .md-left{background:var(--sb-c-f2f3f5, #F2F3F5);border-radius:4px;padding:14px;display:flex;flex-direction:column;min-height:0}
    .md-left-head{display:flex;flex-direction:row;align-items:center;gap:10px;margin-bottom:10px}
    .md-left-title{font-size:12px;font-weight:600;white-space:nowrap}
    .md-search{flex:1;min-width:0;border:1px solid var(--sb-c-dddddd, #DDDDDD);border-radius:16px;padding:5px 12px;font-size:12px}
    .md-list{flex:1;overflow:auto;min-height:60px}
    .md-item{display:block;width:100%;text-align:left;border:none;background:none;
      padding:7px 8px;font-size:12px;color:var(--sb-c-333333, #333333);cursor:pointer;border-radius:4px}
    .md-item:hover{background:var(--sb-c-e7e9ed, #E7E9ED)}
    .md-item.on{background:var(--sb-accent,#0091FF);color:var(--sb-accent-ink,#FFFFFF)}
    .md-empty{font-size:12px;color:#999999;padding:8px}
    .md-add{border:none;background:none;color:var(--sb-accent,#0091FF);font-size:12px;
      cursor:pointer;text-align:left;padding:8px 4px}
    .md-csv{display:flex;flex-direction:column;gap:6px;margin-top:6px}
    .md-right{overflow:auto;min-height:0;padding-right:4px}
    .md-right-title{text-align:center;font-size:13px;font-weight:600;margin-bottom:16px}
    .md-note{font-size:11px;color:var(--sb-c-666666, #666666);margin:10px 0 4px}
    .md-label{font-size:11px;color:var(--sb-c-666666, #666666);margin:10px 0 4px}
    .md-select,.md-input{width:100%;border:1px solid var(--sb-c-dddddd, #DDDDDD);border-radius:4px;padding:7px 9px;
      font:inherit;font-size:13px;background:var(--sb-c-ffffff, #FFFFFF);box-sizing:border-box}
    .md-textarea{width:100%;min-height:110px;border:1px solid var(--sb-c-dddddd, #DDDDDD);border-radius:4px;
      padding:8px 10px;font:inherit;font-size:13px;box-sizing:border-box;resize:vertical}
    .md-row{margin-bottom:4px}
    .md-actions{display:flex;flex-direction:row;gap:10px;justify-content:center;margin:18px 0 8px}
    .md-save,.md-btn-primary{border:none;border-radius:4px;padding:7px 22px;
      background:var(--sb-accent,#0091FF);color:var(--sb-accent-ink,#FFFFFF);font-size:12px;cursor:pointer}
    .md-save{display:block;margin:16px auto 0}
    .md-delete{border:1px solid #D0021B;background:var(--sb-c-ffffff, #FFFFFF);color:#D0021B;border-radius:4px;
      padding:7px 22px;font-size:12px;cursor:pointer}
    .md-btn-ghost{border:1px solid var(--sb-accent,#0091FF);background:var(--sb-c-ffffff, #FFFFFF);
      color:var(--sb-accent,#0091FF);border-radius:4px;padding:6px 12px;font-size:12px;cursor:pointer}
    .md-fields{margin-top:16px}
    .md-field{border:1px solid var(--sb-c-eeeeee, #EEEEEE);border-radius:6px;padding:14px 16px;margin-bottom:14px}
    .md-field-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
    .md-field-col{min-width:0}
    .md-option-fixed{font-size:13px;color:var(--sb-c-666666, #666666);padding:7px 0}
    .md-option-row{display:flex;flex-direction:row;align-items:center;gap:6px;margin-bottom:5px}
    .md-x{border:none;background:none;color:#999999;cursor:pointer;font-size:13px;padding:0 4px}
    .md-add-opt{border:none;background:none;color:var(--sb-accent,#0091FF);font-size:11px;
      cursor:pointer;padding:4px 0}
    .md-preview{border:1px dashed #b9d7f5;border-radius:4px;padding:10px 12px;margin-top:12px}
    .md-preview-title{color:var(--sb-accent,#0091FF);font-size:11px;margin-bottom:6px}
    .md-preview-name{font-size:12px;font-weight:700;margin-bottom:6px}
    .md-pills{display:flex;flex-direction:row;flex-wrap:wrap;gap:6px}
    .md-pill{border:1px solid var(--sb-c-dddddd, #DDDDDD);border-radius:14px;padding:3px 12px;font-size:11px;color:var(--sb-c-555555, #555555)}
    .md-pill.on{border-color:var(--sb-accent,#0091FF);color:var(--sb-accent,#0091FF);background:#f0f7ff}
    .md-product-image{display:block;max-width:180px;margin:8px 0;border-radius:4px}
  `
  document.head.append(s)
}

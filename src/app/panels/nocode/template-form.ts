/**
 * 「型から作る」の入力欄（2026-09-22・本人の依頼。ノーコードでWidgetを作る③）。
 *
 * 型の fields（templates/types.ts）から入力欄を組み立てる。型ごとの画面は書かない。
 *  - 文字を打つたびに中身を作り直して知らせる（onChange）。入力欄そのものは作り直さない（打っている途中で外れない）
 *  - 「ほかの入力しだいで出す欄」「ほかの入力から付く名前」は、そのたびに出し分け・名前だけ直す
 *  - 並び（よくある質問の1問など）の足す・消す・上下は、入力欄を組み立て直す
 */
import { isAllowedLinkUrl } from '../../../shared/link-html.ts'
import { toast } from '../../ui.ts'
import { addItem, applySymbol, moveItem, removeItem, setField, setItemField } from './form-state.ts'
import { pickLpImage } from './lp-image.ts'
import { COLOR_NAMES, items, type Field, type TemplateData } from './templates/types.ts'

type ListField = Extract<Field, { kind: 'list' }>
type Scalar = string | boolean | number
/** 値の置き場所（いちばん外か、並びの中の1件か） */
type Slot = { readonly list?: string; readonly index?: number; readonly key: string }

const ICON_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 15 12 9 18 15"/></svg>'
const ICON_DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>'

let idSeq = 0
const nextId = (): string => `ncf-${(idSeq += 1)}`

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  if (className !== '') el.className = className
  if (text !== '') el.textContent = text
  return el
}

/** データURLのおおよその大きさ（KB） */
function sizeLabel(dataUrl: string): string {
  const kb = Math.round((dataUrl.length * 0.75) / 1024)
  return kb >= 1024 ? `約${(kb / 1024).toFixed(1)}MB` : `約${kb}KB`
}

/** 今の日本時間を datetime-local の形で（過去を選べないようにする下限） */
function nowJstInput(): string {
  const jst = new Date(Date.now() + 9 * 3600 * 1000)
  return jst.toISOString().slice(0, 16)
}

export function buildTemplateForm(options: {
  fields: readonly Field[]
  data: TemplateData
  onChange: (data: TemplateData) => void
}): HTMLElement {
  let data = options.data
  const root = node('div', 'ncf-form-body')
  /** 出し分け・名前の付け直し（入力のたびに全部回す。軽い） */
  let refreshers: (() => void)[] = []

  const read = (slot: Slot): unknown =>
    slot.list === undefined ? data[slot.key] : items(data, slot.list)[slot.index ?? -1]?.[slot.key]

  const write = (slot: Slot, value: Scalar): void => {
    data =
      slot.list === undefined
        ? setField(data, slot.key, value)
        : setItemField(data, slot.list, slot.index ?? -1, slot.key, value)
    options.onChange(data)
    for (const refresh of refreshers) refresh()
  }

  /** 並びの足し引き（入力欄を組み立て直す） */
  const restructure = (next: TemplateData, focusLast?: string): void => {
    if (next === data) return
    data = next
    options.onChange(data)
    build()
    if (focusLast !== undefined) {
      const lastItem = root.querySelector<HTMLElement>(`[data-ncf-list="${focusLast}"] .ncf-item:last-of-type`)
      lastItem?.querySelector<HTMLElement>('input,textarea,select')?.focus()
    }
  }

  const scalarControl = (field: Exclude<Field, ListField>, slot: Slot, id: string): HTMLElement => {
    const value = read(slot)
    switch (field.kind) {
      case 'text':
      case 'url':
      case 'datetime': {
        const input = node('input', 'ncf-input')
        input.id = id
        input.type = field.kind === 'url' ? 'url' : field.kind === 'datetime' ? 'datetime-local' : 'text'
        input.value = typeof value === 'string' ? value : ''
        if (field.kind !== 'datetime' && field.placeholder !== undefined) input.placeholder = field.placeholder
        if (field.kind === 'text' && field.maxLength !== undefined) input.maxLength = field.maxLength
        if (field.kind === 'datetime') input.min = nowJstInput()
        if (field.kind === 'url') {
          const wrap = node('div')
          const warn = node('span', 'ncf-warn')
          const check = (): void => {
            const url = input.value.trim()
            warn.textContent =
              url !== '' && !isAllowedLinkUrl(url) ? 'このリンクは開けません。https:// から始まるURLか、# で始まるページ内の場所を書いてください' : ''
            warn.hidden = warn.textContent === ''
          }
          input.addEventListener('input', () => {
            check()
            write(slot, input.value)
          })
          check()
          wrap.append(input, warn)
          return wrap
        }
        input.addEventListener('input', () => write(slot, input.value))
        return input
      }
      case 'textarea': {
        const area = node('textarea', 'ncf-input')
        area.id = id
        area.rows = field.rows ?? 3
        area.value = typeof value === 'string' ? value : ''
        if (field.maxLength !== undefined) area.maxLength = field.maxLength
        area.addEventListener('input', () => write(slot, area.value))
        return area
      }
      case 'number': {
        const wrap = node('div', 'ncf-inline')
        const input = node('input', 'ncf-input')
        input.id = id
        input.type = 'number'
        input.inputMode = 'numeric'
        input.min = String(field.min)
        input.max = String(field.max)
        input.step = '1'
        input.value = typeof value === 'number' || typeof value === 'string' ? String(value) : ''
        input.addEventListener('input', () => {
          if (Number.isFinite(input.valueAsNumber)) write(slot, input.valueAsNumber)
        })
        wrap.append(input)
        if (field.unit !== undefined) wrap.append(node('span', 'ncf-unit', field.unit))
        return wrap
      }
      case 'select': {
        const select = node('select', 'ncf-input')
        select.id = id
        for (const option of field.options) {
          const opt = node('option', '', option.label)
          opt.value = option.value
          select.append(opt)
        }
        select.value = typeof value === 'string' ? value : (field.options[0]?.value ?? '')
        select.addEventListener('change', () => write(slot, select.value))
        return select
      }
      case 'toggle': {
        // 名前はこの中に書く（外の名前は出さない）
        const label = node('label', 'ncf-toggle')
        const box = node('input')
        box.id = id
        box.type = 'checkbox'
        box.checked = value === true
        box.addEventListener('change', () => write(slot, box.checked))
        label.append(box, node('span', '', field.label))
        return label
      }
      case 'color': {
        const wrap = node('div', 'ncf-swatches')
        wrap.setAttribute('role', 'group')
        const current = (): string => (typeof read(slot) === 'string' ? String(read(slot)).toUpperCase() : '')
        // 「ほかの色」も今の色を映す（候補を選んだあとに古い色のまま残らないように）
        const picker = node('input')
        picker.type = 'color'
        picker.id = id
        const paint = (): void => {
          for (const b of wrap.querySelectorAll<HTMLButtonElement>('.ncf-swatch')) {
            b.setAttribute('aria-pressed', String(b.dataset['color'] === current()))
          }
          if (/^#[0-9A-F]{6}$/.test(current())) picker.value = current().toLowerCase()
        }
        for (const color of field.presets) {
          const b = node('button', 'ncf-swatch')
          b.type = 'button'
          b.dataset['color'] = color
          b.style.background = color
          b.setAttribute('aria-label', COLOR_NAMES[color] ?? color)
          b.title = COLOR_NAMES[color] ?? color
          b.addEventListener('click', () => {
            write(slot, color)
            paint()
          })
          wrap.append(b)
        }
        picker.addEventListener('input', () => {
          write(slot, picker.value.toUpperCase())
          paint()
        })
        const custom = node('label', 'ncf-custom')
        custom.append(picker, node('span', '', 'ほかの色'))
        wrap.append(custom)
        paint()
        return wrap
      }
      case 'image': {
        const wrap = node('div', 'ncf-image')
        const paint = (): void => {
          const src = typeof read(slot) === 'string' ? String(read(slot)) : ''
          wrap.replaceChildren()
          if (src === '') {
            wrap.append(node('span', 'ncf-image__empty', '画像なし'))
          } else {
            const img = node('img', 'ncf-image__thumb')
            img.src = src
            img.alt = ''
            wrap.append(img)
          }
          const choose = node('button', 'ncf-btn', src === '' ? '画像を選ぶ' : '変える')
          choose.type = 'button'
          choose.id = id
          choose.addEventListener('click', () => {
            void pickLpImage().then((picked) => {
              if (picked === null) return
              write(slot, picked)
              paint()
            }, () => toast('画像を読み込めませんでした', 'error'))
          })
          wrap.append(choose)
          if (src !== '') {
            const clear = node('button', 'ncf-btn ncf-btn--quiet', '外す')
            clear.type = 'button'
            clear.addEventListener('click', () => {
              write(slot, '')
              paint()
            })
            wrap.append(clear, node('span', 'ncf-image__size', sizeLabel(src)))
          }
        }
        paint()
        return wrap
      }
      case 'symbols': {
        const wrap = node('div', 'ncf-inline')
        const input = node('input', 'ncf-input')
        input.id = id
        input.type = 'text'
        input.value = typeof value === 'string' ? value : ''
        if (field.placeholder !== undefined) input.placeholder = field.placeholder
        input.addEventListener('input', () => write(slot, input.value))
        const syms = node('div', 'ncf-syms')
        for (const symbol of field.symbols) {
          const b = node('button', 'ncf-sym', symbol)
          b.type = 'button'
          b.setAttribute('aria-label', `${symbol}にする`)
          b.addEventListener('click', () => {
            input.value = applySymbol(input.value, symbol, field.symbols)
            write(slot, input.value)
          })
          syms.append(b)
        }
        wrap.append(input, syms)
        return wrap
      }
    }
  }

  /** 1つの入力欄（名前・入力・説明）。出し分けと名前の付け直しを登録する */
  const fieldEl = (field: Exclude<Field, ListField>, slot: Slot): HTMLElement => {
    const wrap = node('div', 'ncf-field')
    const id = nextId()
    const control = scalarControl(field, slot, id)
    if (field.kind === 'toggle') {
      wrap.append(control)
    } else {
      const label = node('label', 'ncf-label', field.label)
      label.htmlFor = id
      wrap.append(label, control)
      if (field.labelOf !== undefined) {
        const labelOf = field.labelOf
        refreshers.push(() => {
          label.textContent = labelOf(data)
        })
      }
    }
    if (field.note !== undefined) wrap.append(node('span', 'ncf-note', field.note))
    if (field.showIf !== undefined) {
      const showIf = field.showIf
      refreshers.push(() => {
        wrap.hidden = !showIf(data)
      })
    }
    return wrap
  }

  const iconButton = (html: string, label: string, onClick: () => void, enabled: boolean): HTMLButtonElement => {
    const b = node('button', 'ncf-icon-btn')
    b.type = 'button'
    b.innerHTML = html
    b.setAttribute('aria-label', label)
    b.title = label
    b.disabled = !enabled
    b.addEventListener('click', onClick)
    return b
  }

  /** 並び（よくある質問の1問など）。1件ごとに上へ・下へ・消す、最後に「足す」 */
  const listEl = (field: ListField): HTMLElement => {
    const wrap = node('div', 'ncf-field')
    wrap.dataset['ncfList'] = field.key
    const list = items(data, field.key)
    const head = node('div', 'ncf-listhead')
    head.append(node('span', 'ncf-label', field.label), node('span', 'ncf-count', `${list.length} / ${field.max}`))
    const box = node('div', 'ncf-list')
    list.forEach((_, index) => {
      const item = node('div', 'ncf-item')
      const itemHead = node('div', 'ncf-item__head')
      const remove = node('button', 'ncf-icon-btn ncf-item__remove', '消す')
      remove.type = 'button'
      remove.disabled = list.length <= field.min
      remove.title = remove.disabled ? `${field.min}つより少なくはできません` : `この${field.itemLabel}を消す`
      remove.addEventListener('click', () => restructure(removeItem(data, field.key, index, field.min)))
      itemHead.append(
        node('span', 'ncf-item__name', `${field.itemLabel} ${index + 1}`),
        iconButton(ICON_UP, '上へ', () => restructure(moveItem(data, field.key, index, -1)), index > 0),
        iconButton(ICON_DOWN, '下へ', () => restructure(moveItem(data, field.key, index, 1)), index < list.length - 1),
        remove,
      )
      item.append(itemHead)
      for (const sub of field.fields) {
        if (sub.kind === 'list') continue // 並びの中の並びは作らない
        item.append(fieldEl(sub, { list: field.key, index, key: sub.key }))
      }
      box.append(item)
    })
    const add = node('button', 'ncf-add', list.length >= field.max ? `${field.itemLabel}は${field.max}つまでです` : `＋ ${field.itemLabel}を足す`)
    add.type = 'button'
    add.disabled = list.length >= field.max
    add.addEventListener('click', () => restructure(addItem(data, field.key, field.newItem(), field.max), field.key))
    wrap.append(head, box, add)
    return wrap
  }

  const build = (): void => {
    const scroller = root.closest<HTMLElement>('.ncf-form')
    const scrollTop = scroller?.scrollTop ?? 0
    refreshers = []
    root.replaceChildren(
      ...options.fields.map((field) =>
        field.kind === 'list' ? listEl(field) : fieldEl(field, { key: field.key }),
      ),
    )
    for (const refresh of refreshers) refresh()
    if (scroller !== null) scroller.scrollTop = scrollTop
  }

  build()
  return root
}

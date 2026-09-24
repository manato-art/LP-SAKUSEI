/**
 * 入力欄（template-form.ts）を組み立てる部品が共通に使うもの（2026-09-24・template-form.ts から分けた）。
 *  - FormCore: 中身を読む・差し替える・組み立て直す・見え方をそろえる入口（lp-press-rows.ts と同じ形）。
 *    分けた部品（並び・部品の設定・画面の設定・部品を足す）は、これに要るものを足した入口を受け取る
 *  - ボタン・畳める段・画面の名前（どの部品でも同じ見た目にする）
 */
import { node } from './form-controls.ts'
import { screenLabel } from './screens-state.ts'
import { str, type ItemData, type TemplateData } from './templates/types.ts'

export interface FormCore {
  /** いまの中身（読むたびに最新） */
  readonly data: () => TemplateData
  /** 中身を差し替えて知らせる（変わったら true。組み立て直しは呼ぶ側） */
  readonly replace: (next: TemplateData) => boolean
  /** 並びの足し引きなど（入力欄を組み立て直す）。focus は入力を置く場所の目印 */
  readonly restructure: (next: TemplateData, focus?: string) => void
  /** 入力欄の見え方をそろえる（出し分け・名前や選べるものの直し） */
  readonly refreshAll: () => void
  /** 組み立て直さずに見え方をそろえるときに呼ぶもの */
  readonly onRefresh: (fn: () => void) => void
}

export function screenNameAt(screen: ItemData | undefined, index: number): string {
  const name = str(screen ?? {}, 'name').trim()
  return name === '' ? screenLabel(index + 1) : name
}

export function textButton(text: string, className: string, onClick: () => void, enabled = true): HTMLButtonElement {
  const b = node('button', className, text)
  b.type = 'button'
  b.disabled = !enabled
  b.addEventListener('click', (event) => {
    // 部品の頭（押すと広がる）の中にあるボタンは、頭の押下として扱わない
    event.stopPropagation()
    onClick()
  })
  return b
}

export function iconButton(html: string, label: string, onClick: () => void, enabled: boolean): HTMLButtonElement {
  const b = textButton('', 'ncf-icon-btn', onClick, enabled)
  b.innerHTML = html
  b.setAttribute('aria-label', label)
  b.title = label
  return b
}

/** 畳める段（開き具合は組み立て直しても残す） */
export function foldable(title: string, isOpen: () => boolean, setOpen: (open: boolean) => void, body: readonly HTMLElement[]): HTMLElement {
  const details = node('details', 'ncf-fold')
  details.open = isOpen()
  const summary = node('summary', 'ncf-fold__summary', title)
  details.append(summary, ...body)
  details.addEventListener('toggle', () => setOpen(details.open))
  return details
}

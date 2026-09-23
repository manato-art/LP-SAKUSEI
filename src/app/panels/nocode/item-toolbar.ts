/**
 * 並んでいる部品の「複製・上へ・下へ・消す」（2026-09-22・本人の依頼。ノーコードでWidgetを作る②）。
 *
 * Widget編集の左（見たまま編集）で、よくある質問・口コミ・特徴リストのように同じ形が並んでいる所に
 * マウスを乗せると、その部品の右上に小さな操作ボタンを出す。コードを書かずに数を増やしたり並べ替えたりできる。
 *
 * - ボタンと点線の枠は、Widgetの中身（contentDiv）の外に置く。中に置くとコード欄へ書き出され、保存されてしまう
 * - 編集画面の枠は transform で真ん中に置いているので、position:fixed は画面ではなく枠が基準になってずれる。
 *   スクロールする中身と一緒に動く「高さ0の層」を中身の手前に置き、そこからの位置で出す
 * - 変えたら contentDiv に input を投げる（書式ボタンと同じ道でコード欄→「更新する」の保存に届く）
 * - 「消す」は1回目で確認に変わり、続けてもう一度押すと消える（元に戻すボタンでは戻らないため）。最後の1つは消せない
 * - 「01」「02」…と番号が1つずつ増えていた部品は、操作のあと上から番号を付け直す（serial-numbers.ts）
 */
import { toast } from '../../ui.ts'
import { notifyCanvasEdit } from '../widget-canvas-events.ts'
import { radioNamesToRename, renameIds, rewriteIdRefs } from './clone-ids.ts'
import { createKnownGroups, findRepeatItem, neighborOf, repeatGroupOf, repeatSignature, type NodeShape } from './repeat-logic.ts'
import { isSerialRun, parseSerial, renumberSerials } from './serial-numbers.ts'

/** 操作ボタンの色（編集画面の白地の上で目立つ濃い地） */
const BAR_BG = '#1F2A37'
const DANGER_BG = '#C0392B'
const ACCENT = 'var(--sb-accent, #0091FF)'
/** マウスが部品から操作ボタンへ移る間に消えないための猶予 */
const HIDE_DELAY_MS = 300
/** 「消す」を押してから、確認のまま待つ時間 */
const REMOVE_CONFIRM_MS = 3000

const svgChevron = (direction: 'up' | 'down'): string =>
  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ` +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
  `<polyline points="${direction === 'up' ? '6 15 12 9 18 15' : '6 9 12 15 18 9'}"/></svg>`

function asElement(node: NodeShape | null): HTMLElement | null {
  return node as HTMLElement | null
}

/** 複製を作る（中の id と、1問まるごとのときはラジオボタンのグループ名を付け替える） */
function prepareCopy(item: HTMLElement, root: HTMLElement): HTMLElement {
  const copy = item.cloneNode(true) as HTMLElement
  const all = [copy, ...copy.querySelectorAll<HTMLElement>('*')]

  const ids = all.map((el) => el.id).filter((id) => id !== '')
  if (ids.length > 0) {
    const taken = new Set([...root.querySelectorAll<HTMLElement>('[id]')].map((el) => el.id))
    const map = renameIds(ids, taken)
    for (const el of all) {
      for (const attr of [...el.attributes]) {
        const next = rewriteIdRefs(attr.name, attr.value, map)
        if (next !== attr.value) el.setAttribute(attr.name, next)
      }
    }
  }

  const radioCount = (scope: ParentNode): Map<string, number> => {
    const counts = new Map<string, number>()
    for (const radio of scope.querySelectorAll<HTMLInputElement>('input[type="radio"][name]')) {
      counts.set(radio.name, (counts.get(radio.name) ?? 0) + 1)
    }
    return counts
  }
  const inItem = radioCount(item)
  if (inItem.size > 0) {
    const rename = radioNamesToRename(inItem, radioCount(root))
    if (rename.length > 0) {
      const takenNames = new Set(
        [...root.querySelectorAll('[name]')].map((el) => el.getAttribute('name') ?? '').filter((n) => n !== ''),
      )
      const nameMap = renameIds(rename, takenNames)
      for (const radio of copy.querySelectorAll<HTMLInputElement>('input[type="radio"][name]')) {
        const next = nameMap.get(radio.name)
        if (next !== undefined) radio.setAttribute('name', next)
      }
    }
  }
  return copy
}

/** 部品の中の番号の文字（中身が番号だけの要素）。script・style の中は見ない */
function serialLeafOf(item: HTMLElement): HTMLElement | null {
  for (const el of item.querySelectorAll<HTMLElement>('*')) {
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue
    if (el.children.length === 0 && parseSerial(el.textContent ?? '') !== null) return el
  }
  return null
}

/** 部品から番号の要素までの道のり（全部の部品で同じ場所にある番号だけを使う） */
function pathOf(item: HTMLElement, leaf: HTMLElement): string {
  const steps: string[] = []
  for (let el: HTMLElement | null = leaf; el !== null && el !== item; el = el.parentElement) {
    steps.push(repeatSignature(el))
  }
  return steps.join('<')
}

/** 仲間それぞれの番号の要素（どれかに無い・場所がそろわないなら null） */
function serialLeaves(group: readonly HTMLElement[]): HTMLElement[] | null {
  const leaves: HTMLElement[] = []
  for (const item of group) {
    const leaf = serialLeafOf(item)
    if (leaf === null) return null
    leaves.push(leaf)
  }
  const first = group[0]
  const firstLeaf = leaves[0]
  if (first === undefined || firstLeaf === undefined) return null
  const path = pathOf(first, firstLeaf)
  return group.every((item, i) => pathOf(item, leaves[i] as HTMLElement) === path) ? leaves : null
}

/** もともと 1,2,3… と並んでいたか（操作の前に見る） */
function wasNumbered(group: readonly HTMLElement[]): boolean {
  const leaves = serialLeaves(group)
  return leaves !== null && isSerialRun(leaves.map((leaf) => leaf.textContent ?? ''))
}

/** 上から番号を付け直す（操作のあとに呼ぶ） */
function renumber(group: readonly HTMLElement[]): void {
  const leaves = serialLeaves(group)
  if (leaves === null) return
  const next = renumberSerials(leaves.map((leaf) => (leaf.textContent ?? '').trim()))
  for (const [i, leaf] of leaves.entries()) {
    const text = next[i]
    if (text !== undefined && (leaf.textContent ?? '').trim() !== text) leaf.textContent = text
  }
}

/** 2つの場所を入れ替える（間にある区切り線などはそのまま） */
function swapNodes(a: HTMLElement, b: HTMLElement): void {
  const marker = document.createComment('')
  a.replaceWith(marker)
  b.replaceWith(a)
  marker.replaceWith(b)
}

function barButton(html: string, label: string): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.innerHTML = html
  btn.setAttribute('aria-label', label)
  btn.title = label
  // Widget の CSS（button{...} など）の影響を受けないよう、見た目は全部ここで決める
  btn.style.cssText =
    'all:unset;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:3px;' +
    'min-width:28px;height:26px;padding:0 8px;border-radius:4px;color:#fff;cursor:pointer;' +
    'font:600 12px/1 "Hiragino Sans","Noto Sans JP",sans-serif;white-space:nowrap'
  btn.addEventListener('mouseenter', () => {
    if (!btn.disabled && btn.dataset['confirming'] !== 'true') btn.style.background = 'rgba(255,255,255,.16)'
  })
  btn.addEventListener('mouseleave', () => {
    if (btn.dataset['confirming'] !== 'true') btn.style.background = 'transparent'
  })
  // 押しても文字の選択やカーソル位置を失わない
  btn.addEventListener('mousedown', (e) => e.preventDefault())
  return btn
}

function setEnabled(btn: HTMLButtonElement, enabled: boolean, reason = ''): void {
  btn.disabled = !enabled
  btn.style.opacity = enabled ? '1' : '.35'
  btn.style.cursor = enabled ? 'pointer' : 'default'
  btn.title = enabled ? (btn.getAttribute('aria-label') ?? '') : reason
}

export interface ItemToolbarOptions {
  /** この要素に操作ボタンを出してよいか（部品で作ったWidgetでは、見本の部品の中だけ。部品そのものは右で並べ替える） */
  readonly allow?: (item: Element) => boolean
}

/** 見たまま編集に、並んでいる部品の操作ボタンを付ける */
export function attachItemToolbar(editorBody: HTMLElement, contentDiv: HTMLElement, options: ItemToolbarOptions = {}): void {
  const known = createKnownGroups()

  const layer = document.createElement('div')
  layer.dataset['nocodeItemLayer'] = 'true'
  layer.style.cssText = 'position:relative;height:0;width:0'
  editorBody.prepend(layer)

  const frame = document.createElement('div')
  frame.style.cssText =
    `position:absolute;display:none;pointer-events:none;z-index:9998;box-sizing:border-box;` +
    `outline:2px dashed ${ACCENT};outline-offset:2px`

  const bar = document.createElement('div')
  bar.dataset['nocodeItemBar'] = 'true'
  bar.setAttribute('role', 'toolbar')
  bar.setAttribute('aria-label', '並んでいる部品の操作')
  bar.style.cssText =
    `position:absolute;display:none;z-index:9999;align-items:center;gap:2px;padding:3px;` +
    `background:${BAR_BG};border-radius:6px;box-shadow:0 2px 10px rgba(0,0,0,.28)`

  const copyBtn = barButton('複製', '下に複製')
  const upBtn = barButton(svgChevron('up'), '上へ')
  const downBtn = barButton(svgChevron('down'), '下へ')
  const removeBtn = barButton('消す', '消す')
  bar.append(copyBtn, upBtn, downBtn, removeBtn)
  layer.append(frame, bar)

  let current: HTMLElement | null = null
  let hideTimer = 0
  let removeTimer = 0

  const resetRemove = (): void => {
    window.clearTimeout(removeTimer)
    removeBtn.dataset['confirming'] = 'false'
    removeBtn.textContent = '消す'
    removeBtn.style.background = 'transparent'
  }

  const hide = (): void => {
    window.clearTimeout(hideTimer)
    resetRemove()
    current = null
    frame.style.display = 'none'
    bar.style.display = 'none'
  }
  const scheduleHide = (): void => {
    window.clearTimeout(hideTimer)
    hideTimer = window.setTimeout(hide, HIDE_DELAY_MS)
  }
  const cancelHide = (): void => window.clearTimeout(hideTimer)

  /** 枠とボタンを部品の位置へ（ボタンは部品の右上の内側。見えている範囲からはみ出さない） */
  const place = (item: HTMLElement): void => {
    const origin = layer.getBoundingClientRect()
    const rect = item.getBoundingClientRect()
    const view = editorBody.getBoundingClientRect()
    frame.style.display = 'block'
    frame.style.top = `${rect.top - origin.top}px`
    frame.style.left = `${rect.left - origin.left}px`
    frame.style.width = `${rect.width}px`
    frame.style.height = `${rect.height}px`

    bar.style.display = 'flex'
    const top = Math.max(rect.top + 4, view.top + 4)
    const left = Math.min(Math.max(rect.right - bar.offsetWidth - 4, rect.left + 4, view.left + 4), view.right - bar.offsetWidth - 4)
    bar.style.top = `${top - origin.top}px`
    bar.style.left = `${left - origin.left}px`
  }

  const show = (item: HTMLElement): void => {
    cancelHide()
    if (item !== current) resetRemove()
    current = item
    const group = repeatGroupOf(item)
    setEnabled(upBtn, neighborOf(group, item, -1) !== null, 'いちばん上です')
    setEnabled(downBtn, neighborOf(group, item, 1) !== null, 'いちばん下です')
    setEnabled(removeBtn, group.length > 1, '最後の1つは消せません')
    place(item)
  }

  const itemAt = (target: EventTarget | null): HTMLElement | null => {
    if (!(target instanceof Element) || !contentDiv.contains(target)) return null
    const item = asElement(findRepeatItem(target, contentDiv, known))
    if (item !== null && options.allow !== undefined && !options.allow(item)) return null
    return item
  }

  /** 変えたことをコード欄・設定データへ伝える（書式ボタンと同じ道。どの要素を変えたかを添える） */
  const sync = (changed: HTMLElement): void => {
    notifyCanvasEdit(contentDiv, changed)
  }

  contentDiv.addEventListener('mousemove', (e) => {
    const item = itemAt(e.target)
    if (item === null) scheduleHide()
    else if (item !== current || bar.style.display === 'none') show(item)
  })
  contentDiv.addEventListener('mouseleave', scheduleHide)
  // 指で触ったとき（マウスが乗らない）
  contentDiv.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return
    const item = itemAt(e.target)
    if (item === null) hide()
    else show(item)
  })
  // 文字を打っている間は邪魔をしない（次にマウスを動かしたらまた出る）
  contentDiv.addEventListener('keydown', hide)
  // コード欄からの書き換えなどで部品が無くなったら片付ける。あれば位置だけ合わせ直す
  contentDiv.addEventListener('input', () => {
    if (current === null) return
    if (!contentDiv.contains(current)) hide()
    else if (bar.style.display !== 'none') place(current)
  })
  editorBody.addEventListener('scroll', () => {
    if (current !== null && bar.style.display !== 'none') place(current)
  })
  bar.addEventListener('mouseenter', cancelHide)
  bar.addEventListener('mouseleave', scheduleHide)

  const target = (): HTMLElement | null => {
    if (current === null || !contentDiv.contains(current)) {
      hide()
      return null
    }
    return current
  }

  /** いまの仲間（HTMLElement として） */
  const groupOf = (item: HTMLElement): HTMLElement[] => repeatGroupOf(item) as unknown as HTMLElement[]

  copyBtn.addEventListener('click', () => {
    const item = target()
    if (item === null) return
    const numbered = wasNumbered(groupOf(item))
    const copy = prepareCopy(item, contentDiv)
    item.after(copy)
    known.remember(copy)
    if (numbered) renumber(groupOf(item))
    sync(copy)
    copy.scrollIntoView({ block: 'nearest' })
    show(copy)
  })

  const move = (direction: -1 | 1): void => {
    const item = target()
    if (item === null) return
    const group = groupOf(item)
    const other = neighborOf(group, item, direction)
    if (other === null) return
    const numbered = wasNumbered(group)
    swapNodes(item, other)
    if (numbered) renumber(groupOf(item))
    sync(item)
    item.scrollIntoView({ block: 'nearest' })
    show(item)
  }
  upBtn.addEventListener('click', () => move(-1))
  downBtn.addEventListener('click', () => move(1))

  removeBtn.addEventListener('click', () => {
    const item = target()
    if (item === null) return
    const group = groupOf(item)
    if (group.length <= 1) {
      toast('最後の1つは消せません', 'error')
      return
    }
    if (removeBtn.dataset['confirming'] !== 'true') {
      removeBtn.dataset['confirming'] = 'true'
      removeBtn.textContent = 'もう一度押すと消えます'
      removeBtn.style.background = DANGER_BG
      removeTimer = window.setTimeout(resetRemove, REMOVE_CONFIRM_MS)
      place(item)
      return
    }
    const numbered = wasNumbered(group)
    const survivor = group.find((member) => member !== item)
    const parent = item.parentElement ?? contentDiv
    item.remove()
    if (numbered && survivor !== undefined) renumber(groupOf(survivor))
    hide()
    sync(survivor ?? parent)
  })
}

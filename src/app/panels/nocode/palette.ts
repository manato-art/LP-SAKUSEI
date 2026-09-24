/**
 * 左の列の「部品を足す」（2026-09-24 画面の作り直し・本人「ドラッグ&ドロップで追加できるように」。
 * 同日「ここに表示するのは11個＋もっと見る。もっと見るを押したら、同じ左のツールバーのままでサムネ付きで全部表示」）。
 *
 * - ふだん: よく使う11個のタイル＋「もっと見る」。下に「ライブラリの見本から選ぶ」
 * - もっと見る: 同じ場所で、全部の部品を種類ごとにサムネ付きで並べる（型の部品＝まとまった型もここ）。「戻る」でふだんへ
 * - どれも、押すとその画面のいちばん下に入る。つかんで見たまま画面の好きな所へ運ぶと、そこに入る（NC_BLOCK_MIME）
 *   移行先は部品の上に被せて使うので、運んでいる間はそれと分かる目印（NC_HOTSPOT_MIME）も付ける
 */
import { node } from './form-controls.ts'
import { HOTSPOT_TYPE } from './hotspot-model.ts'
import { thumbnailFor } from './palette-thumbs.ts'
import { isTemplateBlock } from './templates/builder-blocks.ts'
import type { BlockType, ScreensField } from './templates/types.ts'

/** 「部品を足す」からドラッグで運ぶときの目印（見たまま画面が受け取る。中身は部品の種類） */
export const NC_BLOCK_MIME = 'application/x-nc-block'
/** 運んでいるのが移行先（部品の上に被せる。運んでいる間は中身を読めないので、種類は目印で知らせる） */
export const NC_HOTSPOT_MIME = 'application/x-nc-hotspot'

/** ふだん見せる11個（本人の選択「今の10種＋移行先」） */
export const PALETTE_FIRST: readonly string[] = [
  'heading',
  'text',
  'button',
  'image',
  HOTSPOT_TYPE,
  'imageText',
  'list',
  'shape',
  'video',
  'spacer',
  'divider',
]

/** もっと見るの並び（種類ごと）。型の部品は「まとまった型」にまとめて最後 */
export const PALETTE_GROUPS: readonly { readonly title: string; readonly types: readonly string[] }[] = [
  { title: '文字', types: ['heading', 'text', 'list', 'speech', 'box', 'note', 'point', 'accordion'] },
  { title: '画像・動画', types: ['image', 'imageText', 'gallery', 'video'] },
  { title: '押す・移る', types: ['button', HOTSPOT_TYPE] },
  { title: '数字・評価', types: ['price', 'stat', 'rating', 'badge', 'table'] },
  { title: 'かざり・すき間', types: ['shape', 'divider', 'spacer', 'cue'] },
]

/** サムネの枠の幅（左の列 320px の2列） */
const THUMB_WIDTH = 136

const MORE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">' +
  '<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/>' +
  '<path d="M17 14v6M14 17h6"/></svg>'
const BACK_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M15 18l-6-6 6-6"/></svg>'

export interface PaletteHost {
  /** 押したとき（その画面のいちばん下へ。移行先は選んでいる部品か、いちばん下の部品に被せる） */
  readonly add: (type: BlockType) => void
  /** 見本を選べる（ライブラリの一覧を開ける） */
  readonly canPickSample: boolean
}

export interface Palette {
  /** 今の状態（ふだん／もっと見る）で作る。count はその画面の部品の数 */
  readonly render: (field: ScreensField, count: number, host: PaletteHost) => HTMLElement
}

export function createPalette(): Palette {
  /** もっと見るを開いている（部品を足して組み立て直しても、開いたまま） */
  let isCatalog = false

  const dragSource = (el: HTMLElement, type: BlockType, full: boolean): void => {
    const target = el
    target.draggable = !full
    target.addEventListener('dragstart', (event) => {
      const transfer = event.dataTransfer
      if (transfer === null) return
      transfer.setData(NC_BLOCK_MIME, type.type)
      if (type.type === HOTSPOT_TYPE) transfer.setData(NC_HOTSPOT_MIME, '1')
      transfer.setData('text/plain', type.label)
      transfer.effectAllowed = 'copy'
      target.classList.add('ncf-palette--dragging')
    })
    target.addEventListener('dragend', () => target.classList.remove('ncf-palette--dragging'))
  }

  const titleOf = (type: BlockType, full: boolean, max: number): string => {
    if (full) return `部品は1画面に${max}こまでです`
    if (type.type === HOTSPOT_TYPE) return '移行先（ボタンや画像・見本の上に運んで被せます。押すと、選んでいる部品に被せます）'
    return `${type.label}（つかんで好きな所へ。押すと、いちばん下に入ります）`
  }

  const button = (className: string, label: string, onClick: () => void, enabled: boolean): HTMLButtonElement => {
    const b = node('button', className)
    b.type = 'button'
    b.disabled = !enabled
    if (label !== '') b.textContent = label
    b.addEventListener('click', onClick)
    return b
  }

  const tile = (type: BlockType, full: boolean, max: number, host: PaletteHost): HTMLElement => {
    const b = button(isTemplateBlock(type.type) ? 'ncf-palette__chip' : 'ncf-palette__tile', '', () => host.add(type), !full)
    const icon = node('span', 'ncf-palette__icon')
    icon.innerHTML = type.icon
    b.append(icon, node('span', 'ncf-palette__label', type.label))
    b.title = titleOf(type, full, max)
    dragSource(b, type, full)
    return b
  }

  const card = (type: BlockType, full: boolean, max: number, host: PaletteHost): HTMLElement => {
    const b = button('ncf-cat__card', '', () => host.add(type), !full)
    b.dataset['ncfCatType'] = type.type
    const name = node('span', 'ncf-cat__name')
    const icon = node('span', 'ncf-palette__icon')
    icon.innerHTML = type.icon
    name.append(icon, node('span', 'ncf-palette__label', type.label))
    b.append(thumbnailFor(type, THUMB_WIDTH), name)
    b.title = titleOf(type, full, max)
    dragSource(b, type, full)
    return b
  }

  const libraryButton = (field: ScreensField, full: boolean, host: PaletteHost): HTMLElement | null => {
    const sample = field.types.find((t) => t.type === 'sample')
    if (sample === undefined || !host.canPickSample) return null
    return button('ncf-palette__library', 'ライブラリの見本から選ぶ', () => host.add(sample), !full)
  }

  const everyday = (field: ScreensField, full: boolean, host: PaletteHost): HTMLElement => {
    const wrap = node('div', 'ncf-palette')
    const head = node('div', 'ncf-palette__head')
    head.append(
      node('span', 'ncf-palette__title', full ? `部品は1画面に${field.blockMax}こまでです` : '部品を足す'),
      node('span', 'ncf-palette__hint', 'つかんで好きな所へ'),
    )
    const grid = node('div', 'ncf-palette__grid')
    for (const key of PALETTE_FIRST) {
      const type = field.types.find((t) => t.type === key)
      if (type !== undefined) grid.append(tile(type, full, field.blockMax, host))
    }
    const more = button(
      'ncf-palette__tile ncf-palette__tile--more',
      '',
      () => {
        isCatalog = true
        wrap.replaceWith(catalog(field, full, host))
      },
      true,
    )
    more.dataset['ncfPaletteMore'] = 'true'
    more.setAttribute('aria-expanded', 'false')
    more.title = 'すべての部品をサムネ付きで見る'
    const moreIcon = node('span', 'ncf-palette__icon')
    moreIcon.innerHTML = MORE_ICON
    more.append(moreIcon, node('span', 'ncf-palette__label', 'もっと見る'))
    grid.append(more)
    wrap.append(head, grid)
    const library = libraryButton(field, full, host)
    if (library !== null) wrap.append(library)
    return wrap
  }

  const catalog = (field: ScreensField, full: boolean, host: PaletteHost): HTMLElement => {
    const wrap = node('div', 'ncf-palette ncf-cat')
    wrap.dataset['ncfCatalog'] = 'true'
    const head = node('div', 'ncf-cat__head')
    const back = button(
      'ncf-cat__back',
      '',
      () => {
        isCatalog = false
        wrap.replaceWith(everyday(field, full, host))
      },
      true,
    )
    back.innerHTML = `${BACK_ICON}<span>戻る</span>`
    back.title = 'よく使う部品に戻る'
    const shown = field.types.filter((t) => t.type !== 'sample')
    head.append(back, node('span', 'ncf-palette__title', `すべての部品（${shown.length}）`))
    wrap.append(head)
    if (full) wrap.append(node('p', 'ncf-palette__hint', `部品は1画面に${field.blockMax}こまでです`))
    const section = (title: string, types: readonly BlockType[]): void => {
      if (types.length === 0) return
      const grid = node('div', 'ncf-cat__grid')
      for (const type of types) grid.append(card(type, full, field.blockMax, host))
      wrap.append(node('span', 'ncf-palette__title ncf-palette__title--sub', title), grid)
    }
    const listed = new Set<string>()
    for (const group of PALETTE_GROUPS) {
      const types = group.types.map((key) => shown.find((t) => t.type === key)).filter((t): t is BlockType => t !== undefined)
      for (const t of types) listed.add(t.type)
      section(group.title, types)
    }
    section('まとまった型', shown.filter((t) => isTemplateBlock(t.type)))
    for (const t of shown) if (isTemplateBlock(t.type)) listed.add(t.type)
    // 分類に入っていない部品（これから足した部品）も、どこかには必ず出す
    section('そのほか', shown.filter((t) => !listed.has(t.type)))
    const library = libraryButton(field, full, host)
    if (library !== null) wrap.append(library)
    return wrap
  }

  return {
    render: (field, count, host) => {
      const full = count >= field.blockMax
      return isCatalog ? catalog(field, full, host) : everyday(field, full, host)
    },
  }
}

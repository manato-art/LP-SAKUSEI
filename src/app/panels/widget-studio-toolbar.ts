/**
 * 上のツールバーのうち、部品で作ったWidgetで受け持つもの（widget-studio-builder.ts から分けた・2026-09-24 点検の直し）。
 *
 * - 配置 ⌄: 見出し・文章は文字の寄せ、ほかは置く位置
 * - サイズ: 選んだ部品の幅と置く位置の小窓
 * - 文字の飾り（太字・色・書体など）: 文字を選んでいなければ、選んだ部品の文字全体に効かせる（Canva式）＝partText
 * - サイズ−／＋: 文字を選んでいなければ、見出し・文章は部品の「文字の大きさ」を1pxずつ変える
 * - リンク: 部品の文字の中にはリンクを持てない（描き直すと消えていた）→ 押せる部品は「押したとき」をリンクにする。
 *   見出し・文章など押せない部品には、リンクを開く「移行先」を被せる。どちらも右の欄の「開くページ」に入力の印を置く
 * - 画像（PCから追加）: 部品の文字の中には画像を持てない（描き直すと消えていた）→ 画像の部品として、選んだ部品の下に足す
 * 見本の部品は、今までどおり中身に直接（リンク・画像・飾り）入れる＝受け持たない（false・null）
 */
import type { AlignTarget } from './align-menu.ts'
import { groupEndOf } from './nocode/hotspot-model.ts'
import { ALIGNS, ALL_BLOCK_TYPES, HEADING_SIZES, PLACES, TEXT_SIZES, sizeOf, widthKeyOf } from './nocode/templates/builder-blocks.ts'
import { int, items, pick, str, type ItemData, type TemplateData } from './nocode/templates/types.ts'
import type { Path } from './nocode/form-state.ts'
import { openSizePopover } from './size-popover.ts'

export interface ToolbarDeps {
  readonly data: () => TemplateData
  /** 選んでいる部品（画面・何番目・中身・見たまま画面の要素） */
  readonly selected: () => { readonly screenIndex: number; readonly blockIndex: number; readonly block: ItemData; readonly el: HTMLElement | null } | null
  /** 部品の1つの値を書く（入力欄と見え方もそろえる） */
  readonly commit: (path: Path, key: string, value: number | string) => void
  /** いま開いている画面の at 番目に部品を入れて選ぶ */
  readonly insertBlock: (type: string, at: number, init?: ItemData) => void
  /** 右の欄の入れ物（「開くページ」に入力の印を置く） */
  readonly inspector: () => HTMLElement | null
}

export interface ToolbarHooks {
  readonly alignTarget: () => AlignTarget | null
  readonly onSizeButton: (anchor: HTMLElement) => boolean
  readonly partText: () => HTMLElement[] | null
  readonly fontSizeStep: (delta: number) => number | null
  readonly onLink: () => boolean
  readonly onImage: (dataUrl: string) => boolean
}

const pathOf = (screenIndex: number, blockIndex: number): Path => ['screens', screenIndex, 'blocks', blockIndex]

/** 見たまま画面で文字を打てる部品の、文字の入れ物（canvas-sync.ts の読み戻しと同じ所） */
function textHolders(el: HTMLElement, type: string): HTMLElement[] | null {
  const all = (selector: string): HTMLElement[] => [...el.querySelectorAll<HTMLElement>(selector)]
  switch (type) {
    case 'heading':
    case 'text':
      return [el]
    case 'button':
      return all('.nc-b-button__label')
    case 'shape':
      return all('.nc-b-shape__text')
    case 'list':
      return all('.nc-b-list__text')
    case 'imageText':
      return all('.nc-b-imageText__heading,.nc-b-imageText__text')
    default:
      return null
  }
}

/** 押したときを持つ部品か（「押したとき」の欄がある。型の部品は、押す所が1つの型だけ持つ） */
const hasPress = (type: string): boolean => ALL_BLOCK_TYPES.find((t) => t.type === type)?.fields.some((f) => f.kind === 'goto') === true

export function createToolbarHooks(deps: ToolbarDeps): ToolbarHooks {
  const focusUrl = (): void => {
    // 右の欄が組み立て直されてから、「開くページ」に入力の印を置く
    setTimeout(() => deps.inspector()?.querySelector<HTMLInputElement>('input[type="url"]')?.focus(), 60)
  }
  return {
    alignTarget: () => {
      const s = deps.selected()
      if (s === null) return null
      const type = str(s.block, 'type')
      const path = pathOf(s.screenIndex, s.blockIndex)
      if (type === 'heading' || type === 'text') {
        return { kind: 'text', value: pick(s.block, 'align', ALIGNS, 'left'), set: (v) => deps.commit(path, 'align', v) }
      }
      if (type === 'sample' || widthKeyOf(type) === null) return null
      return { kind: 'place', value: pick(s.block, 'place', PLACES, 'center'), set: (v) => deps.commit(path, 'place', v) }
    },
    onSizeButton: (anchor) => {
      const s = deps.selected()
      if (s === null || str(s.block, 'type') === 'sample') return false
      const key = widthKeyOf(str(s.block, 'type'))
      if (key === null) return false
      const path = pathOf(s.screenIndex, s.blockIndex)
      openSizePopover(anchor, {
        width: int(s.block, key, 10, 100, 100),
        place: pick(s.block, 'place', PLACES, 'center'),
        onWidth: (n) => deps.commit(path, key, n),
        onPlace: (p) => deps.commit(path, 'place', p),
      })
      return true
    },
    partText: () => {
      const s = deps.selected()
      if (s === null || s.el === null) return null
      const holders = textHolders(s.el, str(s.block, 'type'))
      return holders === null || holders.length === 0 ? null : holders
    },
    fontSizeStep: (delta) => {
      const s = deps.selected()
      if (s === null) return null
      const type = str(s.block, 'type')
      if (type !== 'heading' && type !== 'text') return null
      const isHeading = type === 'heading'
      const now = isHeading ? sizeOf(s.block, 'size', HEADING_SIZES, 12, 48, 21) : sizeOf(s.block, 'size', TEXT_SIZES, 10, 24, 15)
      const next = Math.min(isHeading ? 48 : 24, Math.max(isHeading ? 12 : 10, Math.round(now) + delta))
      if (next !== now) deps.commit(pathOf(s.screenIndex, s.blockIndex), 'size', next)
      return next
    },
    onLink: () => {
      const s = deps.selected()
      if (s === null || str(s.block, 'type') === 'sample') return false
      const type = str(s.block, 'type')
      if (hasPress(type)) {
        deps.commit(pathOf(s.screenIndex, s.blockIndex), 'action', 'link')
        focusUrl()
        return true
      }
      // 押せない部品（見出し・文章など）は、リンクを開く移行先を部品まるごとに被せる
      const blocks = items(items(deps.data(), 'screens')[s.screenIndex] ?? {}, 'blocks')
      deps.insertBlock('hotspot', groupEndOf(blocks, s.blockIndex), { x: 0, y: 0, w: 100, h: 100, action: 'link' })
      focusUrl()
      return true
    },
    onImage: (dataUrl) => {
      const s = deps.selected()
      if (s !== null && str(s.block, 'type') === 'sample') return false
      const blocks = s === null ? [] : items(items(deps.data(), 'screens')[s.screenIndex] ?? {}, 'blocks')
      const at = s === null ? Number.MAX_SAFE_INTEGER : groupEndOf(blocks, s.blockIndex)
      deps.insertBlock('image', at, { image: dataUrl })
      return true
    },
  }
}

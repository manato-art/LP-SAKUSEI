/**
 * Widget編集のキー操作（2026-09-24・点検の残り7〜9）。
 *
 * 7 ⌘C（Ctrl+C）で選んだ部品を覚え、⌘V で選んでいる部品の下へ貼る（別の画面・別のWidgetへも。何も選んでいなければいちばん下）。
 *   ⌘D でその場に複製。どれも被せた移行先ごと。型の部品は名前（uid）を付け直す（hotspot-model.ts `freshCopy`）
 * 8 ↑↓ で隣の部品を選ぶ・⌥↑↓ で並べ替え（移行先ごと）。移行先を選んでいるときは、矢印で 1% ずつ動かす（⇧で 10%）
 * 9 1回押して（部品を選んで）そのまま打つと、その部品の文字の末尾から打ち始める（日本語入力の最初のキーも）
 * 文字を打っている途中は、どのキーも文字の操作に任せる（⌘C は文字のコピー、矢印は入力の印の移動）
 */
import { setAt } from './nocode/form-state.ts'
import { clampRect, coveredIndexOf, duplicateGroup, freshCopy, groupEndOf, groupStep, hotspotRect, isHotspot } from './nocode/hotspot-model.ts'
import { items, type ItemData, type TemplateData } from './nocode/templates/types.ts'

export type PartKeyAction = 'copy' | 'paste' | 'duplicate' | 'prev' | 'next' | 'moveUp' | 'moveDown' | 'nudge' | 'startTyping' | 'none'

export interface PartKeyState {
  readonly hasSelected: boolean
  /** 文字を打っている途中（ダブルクリック・Enter・打ち始めたあと） */
  readonly isTyping: boolean
  readonly selectedIsHotspot: boolean
  /** 選んでいる部品が、見たまま画面で文字を打てる部品か */
  readonly selectedIsText: boolean
}

/** キーで何をするか（Backspace・Delete は widget-studio-delete-key.ts、⌘Z は widget-studio-history.ts） */
export function partKeyAction(
  event: { readonly key: string; readonly metaKey: boolean; readonly ctrlKey: boolean; readonly altKey: boolean; readonly shiftKey: boolean },
  state: PartKeyState,
): PartKeyAction {
  if (state.isTyping) return 'none'
  if ((event.metaKey || event.ctrlKey) && !event.altKey) {
    const key = event.key.toLowerCase()
    if (key === 'v') return 'paste'
    if (!state.hasSelected) return 'none'
    return key === 'c' ? 'copy' : key === 'd' ? 'duplicate' : 'none'
  }
  if (!state.hasSelected || event.metaKey || event.ctrlKey) return 'none'
  if (event.key.startsWith('Arrow')) {
    if (state.selectedIsHotspot && !event.altKey) return 'nudge'
    if (event.key === 'ArrowUp') return event.altKey ? 'moveUp' : 'prev'
    if (event.key === 'ArrowDown') return event.altKey ? 'moveDown' : 'next'
    return 'none'
  }
  // 1文字のキー（と日本語入力の最初のキー＝Process）で打ち始める
  if (!event.altKey && state.selectedIsText && (event.key === 'Process' || [...event.key].length === 1)) return 'startTyping'
  return 'none'
}

export interface PartOpsDeps {
  readonly data: () => TemplateData
  readonly screen: () => number
  readonly selected: () => number | null
  /** 中身を入れ替えて、その画面の blockIndex 番目を選ぶ（元に戻すにも残る） */
  readonly load: (next: TemplateData, screenIndex: number, blockIndex: number | null) => void
  readonly select: (screenIndex: number, blockIndex: number | null) => void
  readonly blockMax: number
  readonly toast: (message: string) => void
}

export interface PartOps {
  readonly copy: () => boolean
  readonly paste: () => boolean
  readonly duplicate: () => boolean
  readonly step: (direction: -1 | 1) => boolean
  readonly move: (direction: -1 | 1) => boolean
  readonly nudge: (dx: number, dy: number) => boolean
}

/** 覚えた部品（Widgetをまたいで残る＝別のWidgetにも貼れる） */
let clipboard: readonly ItemData[] | null = null

export function createPartOps(deps: PartOpsDeps): PartOps {
  const blocksOf = (screen: number): readonly ItemData[] => items(items(deps.data(), 'screens')[screen] ?? {}, 'blocks')
  const withBlocks = (screen: number, list: readonly ItemData[]): TemplateData => setAt(deps.data(), ['screens', screen, 'blocks'], list)
  const full = (): boolean => {
    deps.toast(`部品は1画面に${deps.blockMax}こまでです`)
    return true
  }
  return {
    copy: () => {
      const sel = deps.selected()
      const list = blocksOf(deps.screen())
      if (sel === null || list[sel] === undefined) return false
      clipboard = list.slice(sel, groupEndOf(list, sel))
      return true
    },
    paste: () => {
      if (clipboard === null || clipboard.length === 0) return false
      const screen = deps.screen()
      const list = blocksOf(screen)
      const sel = deps.selected()
      // 移行先を選んでいたら、その移行先が被さる部品のまとまりの後ろへ（ほかの部品と移行先の間に入れない）
      const base = sel === null || list[sel] === undefined ? null : isHotspot(list[sel]) ? (coveredIndexOf(list, sel) ?? sel) : sel
      const at = base === null ? list.length : groupEndOf(list, base)
      const pasted = clipboard.map(freshCopy)
      if (isHotspot(pasted[0]) && coveredIndexOf([...list.slice(0, at), ...pasted], at) === null) {
        deps.toast('移行先は、被せる部品を選んでから貼り付けてください')
        return false
      }
      if (list.length + pasted.length > deps.blockMax) return full()
      deps.load(withBlocks(screen, [...list.slice(0, at), ...pasted, ...list.slice(at)]), screen, at)
      return true
    },
    duplicate: () => {
      const screen = deps.screen()
      const sel = deps.selected()
      if (sel === null) return false
      const copied = duplicateGroup(blocksOf(screen), sel, deps.blockMax)
      if (copied === null) return full()
      deps.load(withBlocks(screen, copied.list), screen, copied.index)
      return true
    },
    step: (direction) => {
      const screen = deps.screen()
      const sel = deps.selected()
      const count = blocksOf(screen).length
      if (sel === null || count === 0) return false
      deps.select(screen, Math.min(count - 1, Math.max(0, sel + direction)))
      return true
    },
    move: (direction) => {
      const screen = deps.screen()
      const sel = deps.selected()
      if (sel === null) return false
      const moved = groupStep(blocksOf(screen), sel, direction)
      if (moved !== null) deps.load(withBlocks(screen, moved.list), screen, moved.index)
      return true
    },
    nudge: (dx, dy) => {
      const screen = deps.screen()
      const sel = deps.selected()
      const list = blocksOf(screen)
      const item = sel === null ? undefined : list[sel]
      if (sel === null || item === undefined || !isHotspot(item)) return false
      const rect = hotspotRect(item)
      const next = clampRect({ ...rect, x: rect.x + dx, y: rect.y + dy })
      if (next.x === rect.x && next.y === rect.y) return true
      deps.load(withBlocks(screen, list.map((b, i) => (i === sel ? { ...b, x: next.x, y: next.y } : b))), screen, sel)
      return true
    },
  }
}

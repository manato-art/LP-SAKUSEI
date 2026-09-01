/**
 * テキスト選択ツールバー（企画書 §9-1 / §11 capture-and-rehydrate）。
 *
 * **手書きでUIを似せない。** マークアップは採取した実DOMをそのまま使う:
 *   - 折りたたみ時の11個は土台（`fragments/ab_tests__UID__articles__editor-target.html`）に
 *     最初から入っているので、それを**そのまま**配線する。
 *   - 展開時にだけ現れる分（書式 / 文字サイズ / フォント / 設定 / 書式クリア / 折りたたむ）は
 *     `toolbar/text-format.ts` が `toolbar-expanded/dom.html` から verbatim で差し込む。
 *   - リンクのパネルは `toolbar/link-dropdown.ts` が `toolbar-link-open` から verbatim で出す。
 *   - 表示の切替は実物と同じく `data-is-show` 属性（実CSS: `[data-is-show="false"]{display:none}`）。
 *
 * このファイルは「どのボタンが何をするか」の配線だけを持ち、
 * 部品はすべて `toolbar/` 配下（色 / 整列・ドロップダウン / 書式 / リンク / 位置）に分けてある。
 *
 * **実物の入れ違いは直さない**（企画書 §3-5「勝手にUIを改善しない」）:
 *   `EditorToolbar-BtnItalic` に下線アイコン、`EditorToolbar-BtnUnderline` に斜体アイコンが
 *   割り当たっている。アイコンの取り違えは本物の状態なのでそのまま再現し、
 *   フォーマットの割り当ては要素の素性（`data-test` 名）に従う。
 */
import type Quill from 'quill'
import { showAppError } from '../crash.ts'
import { toast } from '../ui.ts'
import { CLS, HOOK, setItemShown } from './toolbar/hooks.ts'
import { closeAllDropdowns, wireDropdowns, type ToolbarState } from './toolbar/dropdown.ts'
import { openColorPicker } from './toolbar/color-picker.ts'
import { pickAndInsertMedia } from './media-insert.ts'
import { mountLinkDropdown } from './toolbar/link-dropdown.ts'
import { shouldCrashOnLinkOpen } from './toolbar/link-form.ts'
import { positionToolbar } from './toolbar/placement.ts'
import {
  allowPxSizeAndFreeFont,
  cssFontFamilyValue,
  fontFamilyLabel,
  fontSizeLabel,
  headerLabel,
  insertExpandedOnlyItems,
  wireFreeFontSize,
} from './toolbar/text-format.ts'

// 既存の呼び出し元とテストのために、部品側の公開物をここからも出す（入口は1つのまま）
export type { Box, QuillRange, ToolbarPlacement } from './toolbar/placement.ts'
export { computeToolbarPosition } from './toolbar/placement.ts'
export type { FreeFontSize } from './toolbar/text-format.ts'
export {
  FREE_FONT_SIZE_UNITS,
  TOOLBAR_FONT_FAMILIES,
  TOOLBAR_FONT_SIZES,
  cssFontFamilyValue,
  fontFamilyLabel,
  fontSizeLabel,
  headerLabel,
  parseFreeFontSize,
} from './toolbar/text-format.ts'
export type { Hsv } from './toolbar/color-picker.ts'
export { TOOLBAR_SWATCHES, hexToHsv, hexToRgbCss, hsvToHex, normalizeHex, swatchMarkup } from './toolbar/color-picker.ts'

/** アイコンの明暗差し替え（押下状態は白背景になるので黒アイコンへ）。実在するファイルだけ */
/** 整列（ドロップダウンのアイコン順。Quill の align 値。左寄せは値なし） */
const ALIGN_VALUES: readonly (string | false)[] = [false, 'center', 'right', 'justify']

/** リンクパネルが開いている間も出したままにするツールバー項目（採取物では鎖アイコンだけ） */
const LINK_OPEN_KEEPS: readonly string[] = [HOOK.link]

export interface EditorToolbarOptions {
  /** リンクパネルの「計測ツールの変更 ※別タブが開きます」の遷移先 */
  readonly trackingSettingsHref: string
}

/**
 * 採取済みのツールバーを Quill に配線する。
 * `root` は土台（採取した実DOM）を差し込んだ要素、`quill` はそこに立っている Quill。
 */
export function mountEditorToolbar(root: HTMLElement, quill: Quill, options: EditorToolbarOptions): void {
  const found = root.querySelector<HTMLElement>(HOOK.wrapper)
  if (found === null) {
    console.warn('[editor-toolbar] 土台に EditorToolbar-EditorToolbarWrapper が見つからないので配線しない')
    return
  }
  const wrapper: HTMLElement = found
  if (wrapper.dataset['sbToolbar'] === 'mounted') return
  wrapper.dataset['sbToolbar'] = 'mounted'

  allowPxSizeAndFreeFont(quill)
  insertExpandedOnlyItems(wrapper)

  const state: ToolbarState = { lastRange: null, keepOpen: false }

  /** 折りたたみ / 展開（実物は `data-is-show` の付け替えで出し入れしている） */
  const setExpanded = (expanded: boolean): void => {
    setItemShown(wrapper.querySelector(HOOK.more), !expanded)
    for (const selector of [HOOK.header, HOOK.fontSize, HOOK.fontFamily, HOOK.removeFormat, HOOK.shrink]) {
      setItemShown(wrapper.querySelector(selector), expanded)
    }
  }

  /**
   * 選択がある状態の見え方に合わせる（editor-text-selected/dom.html と同じ）:
   * リンクは出る / 画像は消える。
   */
  setItemShown(wrapper.querySelector(HOOK.link), true)
  setItemShown(wrapper.querySelector(HOOK.photo), false)
  setExpanded(false)

  // ツールバー内の mousedown で編集中の選択が消えないようにする（入力欄だけは例外）
  wrapper.addEventListener('mousedown', (event) => {
    const target = event.target as HTMLElement | null
    if (target?.closest('input, select, textarea') !== null) return
    event.preventDefault()
  })

  const dropdowns = wireDropdowns(wrapper, state)

  const applyInline = (name: string, value: unknown): void => {
    const range = state.lastRange
    if (range === null || range.length === 0) return
    quill.formatText(range.index, range.length, name, value, 'user')
    quill.setSelection(range.index, range.length, 'silent')
    refresh()
  }
  const applyBlock = (name: string, value: unknown): void => {
    const range = state.lastRange
    if (range === null) return
    quill.formatLine(range.index, range.length, name, value, 'user')
    quill.setSelection(range.index, range.length, 'silent')
    refresh()
  }
  const currentFormats = (): Record<string, unknown> => {
    const range = state.lastRange
    return range === null ? {} : quill.getFormat(range.index, range.length)
  }

  // ── 折りたたみ時の11個 ──
  const toggleInline = (name: string): void => {
    applyInline(name, currentFormats()[name] === true ? false : true)
  }
  wrapper.querySelector(HOOK.bold)?.addEventListener('click', () => toggleInline('bold'))
  // 実物は data-test とアイコンが入れ違い（BtnItalic=下線アイコン / BtnUnderline=斜体アイコン）。
  // ユーザーが押すのは**見えているアイコン**なので、フォーマットはアイコンに合わせる
  // （下線アイコンのボタン→下線 / 斜体アイコンのボタン→斜体）。
  wrapper.querySelector(HOOK.italic)?.addEventListener('click', () => toggleInline('underline'))
  wrapper.querySelector(HOOK.underline)?.addEventListener('click', () => toggleInline('italic'))
  wrapper.querySelector(HOOK.strike)?.addEventListener('click', () => toggleInline('strike'))
  wrapper.querySelector(HOOK.scriptSuper)?.addEventListener('click', () => {
    applyInline('script', currentFormats()['script'] === 'super' ? false : 'super')
  })
  wrapper.querySelector(HOOK.scriptSub)?.addEventListener('click', () => {
    applyInline('script', currentFormats()['script'] === 'sub' ? false : 'sub')
  })
  wireLink(wrapper, quill, root, options, {
    setKeepOpen: (value) => {
      state.keepOpen = value
    },
    refresh: () => refresh(),
  })
  // ツールバーの「画像」ボタン＝カーソル位置へ画像/GIF/動画を差し込む（右レールの挿入と同じ）
  wrapper.querySelector(HOOK.photo)?.addEventListener('click', () => pickAndInsertMedia(quill))

  // ── 色パレット ──
  const colorButton = wrapper.querySelector<HTMLElement>(HOOK.color)
  colorButton?.addEventListener('click', () => {
    openColorPicker(colorButton, '文字色', (hex) => applyInline('color', hex), state, refresh)
  })
  const backgroundButton = wrapper.querySelector<HTMLElement>(HOOK.background)
  backgroundButton?.addEventListener('click', () => {
    openColorPicker(backgroundButton, '背景色', (hex) => applyInline('background', hex), state, refresh)
  })

  // ── 整列 ──
  const alignIcons = dropdowns.align?.body.querySelectorAll<HTMLElement>(HOOK.alignIcon) ?? []
  alignIcons.forEach((icon, index) => {
    icon.addEventListener('click', () => {
      applyBlock('align', ALIGN_VALUES[index] ?? false)
      dropdowns.align?.close()
    })
  })

  // ── 書式（Normal / 見出し1-3） ──
  for (const heading of dropdowns.header?.body.querySelectorAll<HTMLElement>('h1, h2, h3') ?? []) {
    const level = Number(heading.tagName.slice(1))
    heading.addEventListener('click', () => {
      applyBlock('header', currentFormats()['header'] === level ? false : level)
      dropdowns.header?.close()
    })
  }

  // ── 文字サイズ（10段 ＋ 自由設定） ──
  for (const tab of dropdowns.fontSize?.body.querySelectorAll<HTMLElement>(HOOK.fontSizeTab) ?? []) {
    tab.addEventListener('click', () => {
      applyInline('size', (tab.textContent ?? '').trim())
      dropdowns.fontSize?.close()
    })
  }
  wireFreeFontSize(dropdowns.fontSize, applyInline)

  // ── フォント ──
  const fontOptions = dropdowns.fontFamily?.body.querySelector(HOOK.fontOptions)
  for (const option of fontOptions?.querySelectorAll<HTMLElement>(':scope > div') ?? []) {
    option.addEventListener('click', () => {
      applyInline('font', cssFontFamilyValue((option.textContent ?? '').trim()))
      dropdowns.fontFamily?.close()
    })
  }

  // ── 書式クリア / 展開 / 折りたたみ ──
  wrapper.querySelector(HOOK.removeFormat)?.addEventListener('click', () => {
    const range = state.lastRange
    if (range === null || range.length === 0) return
    quill.removeFormat(range.index, range.length, 'user')
    quill.setSelection(range.index, range.length, 'silent')
    refresh()
  })
  wrapper.querySelector(HOOK.more)?.addEventListener('click', () => {
    setExpanded(true)
    refresh()
  })
  wrapper.querySelector(HOOK.shrink)?.addEventListener('click', () => {
    setExpanded(false)
    refresh()
  })

  /** 選択／カーソルに合わせて 表示 / 位置 / 押下状態 を更新する */
  function refresh(): void {
    const range = quill.getSelection()
    // カーソルのみ（collapsed）でも位置追従できるよう、範囲があれば常に lastRange を更新する。
    if (range !== null) state.lastRange = { index: range.index, length: range.length }

    const hasSelection = range !== null && range.length > 0
    // **エディタにカーソルが入っていれば常に表示**（選択が無くても）。
    // ＝「ここに入ったら常に出る」。エディタ外へ出ると range が null になり隠れる。
    const focused = range !== null
    const visible = focused || (state.keepOpen && state.lastRange !== null)
    wrapper.classList.toggle(CLS.wrapperActive, visible)
    if (!visible) {
      closeAllDropdowns(dropdowns)
      return
    }
    // カーソルのみ＝画像の差し込みモード（画像ボタンを出す）。
    // 選択あり＝整列・色などの書式モード（実物の text-selected 状態に合わせ画像は隠す）。
    setItemShown(wrapper.querySelector(HOOK.photo), !hasSelection)
    const target = state.lastRange
    if (target === null) return
    positionToolbar(wrapper, quill, target)
    syncActiveState(wrapper, quill.getFormat(target.index, target.length))
  }

  quill.on('selection-change', () => refresh())
  quill.on('text-change', () => refresh())
  refresh()
}

interface LinkHost {
  /** パネルを開いている間は、選択が外れてもツールバーを消さない */
  readonly setKeepOpen: (value: boolean) => void
  readonly refresh: () => void
}

/**
 * 鎖アイコン。
 *
 * **選択が無いまま押すと実物はアプリごとクラッシュする**（docs/findings-live-observation.md）。
 * バグではなく再現対象なので、同じ条件で採取した `global/app-error` 画面をそのまま出す。
 */
function wireLink(
  wrapper: HTMLElement,
  quill: Quill,
  root: HTMLElement,
  options: EditorToolbarOptions,
  host: LinkHost,
): void {
  const button = wrapper.querySelector(HOOK.link)
  if (button === null) return

  /** 開いている間は鎖アイコン以外を隠す（採取物 toolbar-link-open の `data-is-show` そのまま） */
  const setLinkOnly = (linkOnly: boolean): void => {
    for (const item of wrapper.querySelectorAll<HTMLElement>(HOOK.item)) {
      if (LINK_OPEN_KEEPS.some((selector) => item.querySelector(selector) !== null)) continue
      if (linkOnly) {
        item.dataset['sbShowBeforeLink'] = item.getAttribute('data-is-show') ?? 'false'
        item.setAttribute('data-is-show', 'false')
        continue
      }
      const before = item.dataset['sbShowBeforeLink']
      if (before !== undefined) item.setAttribute('data-is-show', before)
      delete item.dataset['sbShowBeforeLink']
    }
  }

  const panel = mountLinkDropdown(root, quill, {
    trackingSettingsHref: options.trackingSettingsHref,
    onClose: () => {
      setLinkOnly(false)
      host.setKeepOpen(false)
      host.refresh()
    },
  })

  button.addEventListener('click', () => {
    const range = quill.getSelection()
    // `range === null` は shouldCrashOnLinkOpen の判定に含まれる。型を絞るために先に書いてある。
    if (range === null || shouldCrashOnLinkOpen(range)) {
      showAppError()
      return
    }
    if (panel === null) {
      toast('リンクパネルを開けませんでした', 'error')
      return
    }
    host.setKeepOpen(true)
    setLinkOnly(true)
    panel.open({ index: range.index, length: range.length })
  })
}

/** 押下状態（白丸背景＋黒アイコン）を現在の書式に合わせる */
function syncActiveState(wrapper: HTMLElement, formats: Record<string, unknown>): void {
  const mark = (selector: string, active: boolean): void => {
    const node = wrapper.querySelector<HTMLElement>(selector)
    const item = node?.closest(HOOK.item)
    item?.classList.toggle(CLS.itemActive, active)
    // アイコン色の統一。ただし **img アイコンだけ** に当てる。
    // x²/x₂ はCSS描画の div なので invert すると潰れる（消える）→ 非アクティブは素の色のまま。
    //   img 非アクティブ … 暗いツールバー上なので白（brightness(0) invert(1)）
    //   すべて アクティブ … 白丸の背景に乗るので黒（brightness(0)）
    if (node !== null && node !== undefined) {
      const isImg = node.tagName === 'IMG'
      node.style.filter = active ? 'brightness(0)' : isImg ? 'brightness(0) invert(1)' : ''
    }
  }
  mark(HOOK.bold, formats['bold'] === true)
  // アイコン入れ違いに合わせて素性も入れ替え（BtnItalic=下線アイコン / BtnUnderline=斜体アイコン）
  mark(HOOK.italic, formats['underline'] === true)
  mark(HOOK.underline, formats['italic'] === true)
  mark(HOOK.strike, formats['strike'] === true)
  mark(HOOK.scriptSuper, formats['script'] === 'super')
  mark(HOOK.scriptSub, formats['script'] === 'sub')

  setTriggerLabel(wrapper, HOOK.header, headerLabel(formats['header']))
  setTriggerLabel(wrapper, HOOK.fontSize, fontSizeLabel(formats['size']))
  setTriggerLabel(wrapper, HOOK.fontFamily, fontFamilyLabel(formats['font']))
}

function setTriggerLabel(wrapper: HTMLElement, itemSelector: string, label: string): void {
  const node = wrapper.querySelector<HTMLElement>(`${itemSelector} ${HOOK.selectForm}`)
  if (node !== null) node.textContent = label
}

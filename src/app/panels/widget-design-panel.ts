/**
 * Widget編集の右側「デザイン（要素ごとに編集）」。
 *
 * 離脱防止ポップアップのデザインタブと同じく、Widget を要素ごとのカードに分けて、
 * その場で変えられるようにする（本人指定）。カードの中は種類ごとにまとめる:
 *   色         … その要素に当たるCSSの色／要素に直接書かれた色
 *   大きさ・余白 … 幅・高さ・文字の大きさ・余白（上下・左右）・角の丸み …
 *   動き       … 動き1回の時間・変化にかける時間・待ち
 *   その他     … 変形や影など、数字が組み合わさった値（値まるごと書き換える）
 * 文字を持つ要素には「文言」も出す。
 *
 * 本人の矢印Widgetのように CSS変数で作られているものは、変数を宣言している要素のカードに
 * 変数ごと1行ずつ（行末のコメントが名前）出る。
 *
 * カードが増えすぎないための決まり（ライブラリ25件の全件確認で、1件に777行出たのを受けて）:
 *   - 当たるCSSがまったく同じ要素（リンクが並ぶ・矢印が3本 など）は1枚にまとめ、文言だけ並べる
 *   - 1度どこかのカードに出した設定は、後のカードに重ねて出さない
 *
 * 2026-09-23（第2弾・Canva風）:
 *   - 左で要素を押すと、その要素のカードだけを出す（`select`）。「全部のカードを見る」で元の一覧
 *   - 数字の行は、名前を左右にドラッグで増減・下にスライダー（number-scrub.ts）
 *   - 幅・高さ・文字の大きさの行は、左の選択枠のハンドルでもドラッグできる（`handlesFor`）
 *
 * 普段はこれを出し、「デフォルト時のコードを表示」を押すと今のHTML/CSSに切り替わる（本人指定）。
 */
import { T, el } from '../ui.ts'
import { directText } from '../pages/exit-popup-fields.ts'
import { designCardCss } from './design-card-styles.ts'
import { openColorPicker } from './toolbar/color-picker.ts'
import { lpMediaMatches } from './lp-width-media.ts'
import { handleKindOf, sliderRange } from './drag-math.ts'
import { attachScrub, makeSlider } from './number-scrub.ts'
import type { SelectionHandle } from './selection-layer.ts'
import { applyMediaWidth, currentMediaWidthPct } from './widget-media-control.ts'
import {
  colorToHex,
  numberStep,
  numberToken,
  replaceSetting,
  sanitizeValue,
  scanSettings,
  type Setting,
  type SettingGroup,
} from './widget-settings.ts'

export interface DesignPanelDeps {
  /** 左のプレビューの本文（contenteditable）。文言・直書きの色の書き換え先 */
  readonly content: HTMLElement
  /** いまの CSS（コード欄の textarea が正本。「更新する」もそこから保存する） */
  readonly readCss: () => string
  /** CSS を書き換える（コード欄の色付け・行番号・プレビューまで同じ道で更新される） */
  readonly writeCss: (css: string) => void
}

export interface DesignPanel {
  readonly element: HTMLElement
  /** 作り直す（コード欄を直接書き換えてから、こちらへ戻ってきたときなど） */
  readonly refresh: () => void
  /**
   * 左で押した要素を選ぶ（カードのある要素＝自分か外側を返す）。null は選ぶのをやめる。
   * 選ぶと、その要素のカードだけを出す
   */
  readonly select: (target: HTMLElement | null) => { node: HTMLElement; label: string } | null
  /** 選んだ要素の選択枠に付けるハンドル（幅・高さ・文字の大きさ。画像は幅%。Widgetの外側は上下の余白） */
  readonly handlesFor: (node: HTMLElement) => SelectionHandle[]
}

/** カード1行ぶん。CSS の設定か、要素に直接書く色（まとめた要素があれば全部に書く） */
type RowSource =
  | {
      readonly kind: 'css'
      readonly setting: Setting
      readonly state: string
      /** この要素に当たったセレクタ（クラスの無い要素のカード名に使う） */
      readonly selector: string
    }
  | { readonly kind: 'inline'; readonly nodes: readonly HTMLElement[]; readonly property: 'color' | 'background-color' }

type CssRow = Extract<RowSource, { kind: 'css' }>

interface Card {
  readonly kind: string
  readonly snippet: string
  /** まとめた要素の数 */
  readonly count: number
  /** このカードにまとめた要素（左で押した要素がどのカードか、を探すのに使う） */
  readonly nodes: readonly HTMLElement[]
  /** 文言を書き換える要素（同じ見た目の要素が並ぶときは全部） */
  readonly texts: readonly HTMLElement[]
  readonly rows: readonly RowSource[]
}

const GROUP_ORDER: readonly SettingGroup[] = ['color', 'size', 'motion', 'other']
const GROUP_TITLES: Readonly<Record<SettingGroup, string>> = {
  color: '色',
  size: '大きさ・余白',
  motion: '動き',
  other: 'その他',
}

/** 文言の行を最初に出す件数（リンクが何十個も並ぶWidgetで、カードが縦に伸びすぎないように） */
const TEXT_ROWS_VISIBLE = 10

/** プレビュー側で書式を変えたとき、カードを作り直すまでの待ち（打つたびに作り直さない） */
const REFRESH_DELAY_MS = 250

/** 文字の大きさのハンドルは、マウスを 3px 動かして 1px（細かく動かせるように） */
const FONT_PX_PER_UNIT = 3
/** em・rem の1単位はおよそ 16px */
const EM_PX = 16

/** 読めないセレクタ（`:-ms-input-placeholder` のようなブラウザ固有の書き方）は「当たらない」扱い */
function queryAll(root: HTMLElement, selector: string): Element[] {
  try {
    return [...root.querySelectorAll(selector)]
  } catch {
    return []
  }
}

function groupOf(row: RowSource): SettingGroup {
  return row.kind === 'inline' ? 'color' : row.setting.group
}

function rowId(row: RowSource): string {
  return row.kind === 'css' ? `${row.setting.key}/${row.state}` : ''
}

function collectCards(content: HTMLElement, css: string): Card[] {
  const byNode = new Map<Element, RowSource[]>()
  const globals: RowSource[] = []
  for (const setting of scanSettings(css)) {
    if (setting.isGlobal) {
      globals.push({ kind: 'css', setting, state: '', selector: '' })
      continue
    }
    for (const target of setting.targets) {
      for (const node of queryAll(content, target.selector)) {
        const list = byNode.get(node) ?? []
        if (list.some((r) => r.kind === 'css' && r.setting.key === setting.key)) continue
        byNode.set(node, [...list, { kind: 'css', setting, state: target.state, selector: target.selector }])
      }
    }
  }

  // 組み立て中だけ書き換える下書き（まとめた要素の数と文言をあとから足す）
  interface Draft {
    kind: string
    snippet: string
    count: number
    nodes: HTMLElement[]
    texts: HTMLElement[]
    rows: RowSource[]
  }
  const drafts: Draft[] = []
  if (globals.length > 0) {
    drafts.push({ kind: '全体', snippet: 'Widget全体に効く設定', count: 1, nodes: [], texts: [], rows: globals })
  }
  /** 当たる設定がまったく同じ要素は1枚にまとめる */
  const bySignature = new Map<string, Draft>()
  /** 1度カードに出した設定（後のカードに重ねて出さない） */
  const shown = new Set<string>()

  for (const node of content.querySelectorAll<HTMLElement>('*')) {
    if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') continue
    const leafText = node.children.length === 0 ? directText(node).trim() : ''
    const cssRows = byNode.get(node) ?? []
    const inline: RowSource[] = (['color', 'background-color'] as const)
      .filter((property) => node.style.getPropertyValue(property) !== '')
      .map((property) => ({ kind: 'inline', nodes: [node], property }))
    if (leafText === '' && cssRows.length === 0 && inline.length === 0) continue

    // CSSが何も当たらない要素どうしは、別物なのでまとめない（直書きの色がある要素もまとめない）
    const signature = cssRows.map(rowId).join('|')
    const same = signature !== '' && inline.length === 0 ? bySignature.get(signature) : undefined
    if (same !== undefined) {
      same.count++
      same.nodes.push(node)
      if (leafText !== '') same.texts.push(node)
      continue
    }

    const texts: HTMLElement[] = leafText !== '' ? [node] : []
    const rows: RowSource[] = [...cssRows.filter((r) => !shown.has(rowId(r))), ...inline]
    const hasTextColor = [...cssRows, ...inline].some((r) =>
      r.kind === 'inline' ? r.property === 'color' : r.setting.kind === 'color' && r.setting.property === 'color',
    )
    // 文字はあるのに文字色がどこにも無ければ、直接つける行を出す（まとめた文言すべてに付く）
    if (leafText !== '' && !hasTextColor) rows.push({ kind: 'inline', nodes: texts, property: 'color' })
    for (const r of cssRows) shown.add(rowId(r))
    if (rows.length === 0 && texts.length === 0) continue

    const tag = node.tagName.toLowerCase()
    const kind = tag === 'button' || tag === 'a' ? 'ボタン' : leafText !== '' ? 'テキスト' : '要素'
    const namedClass = [...node.classList].find((c) => !/^(?:css-|Mui|sb-)/.test(c))
    // クラスの無い要素（並んだ <li> など）は、当たったセレクタの方がどれのことか分かる
    const firstSelector = cssRows.find((r) => r.kind === 'css')
    const selectorName = firstSelector?.kind === 'css' ? firstSelector.selector : ''
    const snippet =
      leafText !== ''
        ? leafText.slice(0, 24)
        : namedClass !== undefined
          ? `.${namedClass}`
          : selectorName !== ''
            ? selectorName
            : `<${tag}>`
    const draft: Draft = { kind, snippet, count: 1, nodes: [node], texts, rows }
    drafts.push(draft)
    if (signature !== '' && inline.length === 0) bySignature.set(signature, draft)
  }

  // 同じ名前のカードが並ぶと、どれがどれか分からない（矢印小刻みで「.arrow」が3枚並んだ）。
  // 名前がかぶった文字なしのカードは、そのカードの行を出している一番くわしいセレクタで呼ぶ
  // （.arrow:nth-child(2) など）。それでもかぶるものには「何つ目か」を添える。
  const countSnippets = (): Map<string, number> => {
    const counts = new Map<string, number>()
    for (const d of drafts) counts.set(d.snippet, (counts.get(d.snippet) ?? 0) + 1)
    return counts
  }
  const firstCounts = countSnippets()
  for (const d of drafts) {
    if ((firstCounts.get(d.snippet) ?? 0) < 2 || d.texts.length > 0) continue
    const best = d.rows
      .map((r) => (r.kind === 'css' ? r.selector : ''))
      .reduce((a, b) => (b.length > a.length ? b : a), '')
    if (best !== '') d.snippet = best
  }
  const finalCounts = countSnippets()
  const order = new Map<string, number>()
  for (const d of drafts) {
    if ((finalCounts.get(d.snippet) ?? 0) < 2) continue
    const n = (order.get(d.snippet) ?? 0) + 1
    order.set(d.snippet, n)
    d.snippet = `${d.snippet}（${n}つ目）`
  }
  return drafts
}

export function buildDesignPanel(deps: DesignPanelDeps): DesignPanel {
  injectStyles()
  const root = el('div', { class: 'wdp-root' })

  /** 同じ色の見本はカードをまたいで出ることがあるので、まとめて塗り替えられるように控える */
  let swatches = new Map<string, { swatch: HTMLElement; hex: HTMLElement }[]>()
  /** 変えた後の色（ピッカーを開き直したとき、今の色から始めるため） */
  const currentColors = new Map<string, string>()
  /**
   * 数値・値まるごとの入力欄。同じ設定が状態違いで別のカードにも出ることがあるので、
   * 片方を変えたらもう片方の表示もそろえる（色の見本は swatches で同じことをしている）。
   */
  let valueInputs = new Map<string, { input: HTMLInputElement; unitEl: HTMLElement | null; slider: HTMLInputElement | null }[]>()
  /** 数値の行で最後に書いた単位（無単位の 0 を変えると px が付くので、別の行とも共有する） */
  const units = new Map<string, string>()
  /** カードからの変更で飛ぶ input では作り直さない（打っている入力欄が消えないように） */
  let isApplying = false
  let refreshTimer: ReturnType<typeof setTimeout> | undefined
  /** 行の中から作り直しを頼むための入口（render は行を組み立てる関数より後で決まる） */
  const rebuild = { now: (): void => undefined }
  /** 左で選んだ要素（そのカードだけを出す）。null は選んでいない */
  let selectedNode: HTMLElement | null = null
  /** 選んでいても全部のカードを出す（「全部のカードを見る」） */
  let showAll = false
  /** 直近に組み立てたカード（選んだ要素がどのカードかを探す） */
  let lastCards: Card[] = []

  const touchContent = (): void => {
    isApplying = true
    deps.content.dispatchEvent(new Event('input', { bubbles: true }))
    isApplying = false
  }

  const writeSetting = (key: string, next: string): void => {
    deps.writeCss(replaceSetting(deps.readCss(), key, next))
  }

  /** 数値の行に今の値を書く（入力欄・スライダー・単位を全部そろえ、CSSへ書く） */
  const writeNumber = (setting: Setting, n: number, from?: HTMLInputElement): void => {
    const next = numberToken({ ...setting, unit: units.get(setting.key) ?? setting.unit }, n)
    units.set(setting.key, next.unit)
    for (const other of valueInputs.get(setting.key) ?? []) {
      if (other.input !== from) other.input.value = String(n)
      if (other.slider !== null && other.slider !== from) other.slider.value = String(n)
      if (other.unitEl !== null) other.unitEl.textContent = next.unit
    }
    writeSetting(setting.key, next.token)
  }

  const labelEl = (text: string, extra = ''): HTMLElement =>
    el('label', { class: `ep-design-label wdp-label ${extra}`.trim(), text })

  const colorRow = (
    label: string,
    key: string,
    value: string,
    onPick: (hex: string) => void,
  ): HTMLElement => {
    const row = el('div', { class: 'ep-design-row' })
    const swatch = el('button', { class: 'ep-design-color wdp-swatch' })
    swatch.type = 'button'
    swatch.title = `${label}を変える`
    swatch.style.background = value === '' ? '#ffffff' : value
    const hex = el('span', { class: 'ep-design-hex', text: value === '' ? '未設定' : value.toUpperCase() })
    swatches.set(key, [...(swatches.get(key) ?? []), { swatch, hex }])
    swatch.addEventListener('click', () => {
      openColorPicker(
        swatch,
        label,
        (picked) => {
          onPick(picked)
          currentColors.set(key, picked)
          for (const s of swatches.get(key) ?? []) {
            s.swatch.style.background = picked
            s.hex.textContent = picked.toUpperCase()
          }
        },
        // Widget編集は常時表示なので、ツールバーの開閉状態は持たない
        { lastRange: null, keepOpen: false },
        () => undefined,
        colorToHex(currentColors.get(key) ?? value) ?? undefined,
      )
    })
    row.append(labelEl(label), swatch, hex)
    return row
  }

  /** 数値の行（名前を左右にドラッグで増減）と、その下のスライダー */
  const numberRow = (label: string, setting: Setting): HTMLElement[] => {
    const row = el('div', { class: 'ep-design-row' })
    const input = el('input', { class: 'ep-design-input wdp-number' })
    input.type = 'number'
    const step = numberStep(setting)
    input.step = String(step)
    // `.5` は number 入力欄が受け付けないので、数として正規化してから入れる
    const value = Number(setting.value)
    input.value = String(value)
    const unit = units.get(setting.key) ?? setting.unit
    const unitEl = el('span', { class: 'ep-design-hex wdp-unit', text: unit })
    const range = sliderRange(unit, setting.property, value)
    const slider = range === null ? null : makeSlider(range, value, 'wdp-slider', (n) => writeNumber(setting, n))
    valueInputs.set(setting.key, [...(valueInputs.get(setting.key) ?? []), { input, unitEl, slider }])
    input.addEventListener('input', () => {
      const n = input.valueAsNumber
      if (!Number.isFinite(n)) return
      writeNumber(setting, n, input)
    })
    const name = labelEl(label)
    attachScrub(name, {
      read: () => (Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : value),
      step,
      range: range ?? undefined,
      apply: (n) => writeNumber(setting, n),
    })
    row.append(name, input, unitEl)
    if (slider === null) return [row]
    const sliderRow = el('div', { class: 'ep-design-row wdp-slider-row' })
    sliderRow.append(slider)
    return [row, sliderRow]
  }

  const textRow = (label: string, setting: Setting): HTMLElement => {
    const row = el('div', { class: 'ep-design-row' })
    const input = el('input', { class: 'ep-design-input' })
    input.type = 'text'
    input.value = setting.value
    input.spellcheck = false
    valueInputs.set(setting.key, [...(valueInputs.get(setting.key) ?? []), { input, unitEl: null, slider: null }])
    input.addEventListener('input', () => {
      const clean = sanitizeValue(input.value)
      if (clean !== input.value) input.value = clean
      for (const other of valueInputs.get(setting.key) ?? []) {
        if (other.input !== input) other.input.value = clean
      }
      writeSetting(setting.key, clean)
    })
    // 書き終わったら作り直す（同じ宣言にある色の見本などの位置を最新にする）
    input.addEventListener('change', () => rebuild.now())
    row.append(labelEl(label, 'wdp-label-text'), input)
    return row
  }

  const buildRow = (source: RowSource, cardIndex: number): HTMLElement[] => {
    if (source.kind === 'inline') {
      const { nodes, property } = source
      return [
        colorRow(
          property === 'color' ? '文字色' : '背景色',
          `inline:${cardIndex}:${property}`,
          nodes[0]?.style.getPropertyValue(property) ?? '',
          (hex) => {
            for (const node of nodes) node.style.setProperty(property, hex)
            touchContent()
          },
        ),
      ]
    }
    const { setting, state } = source
    // 状態（ホバー時など）と効く条件（画面幅768px以上など）を名前の後ろに添える
    const notes = [state, setting.context].filter((n) => n !== '')
    const label = notes.length === 0 ? setting.label : `${setting.label}（${notes.join('・')}）`
    if (setting.kind === 'number') return numberRow(label, setting)
    if (setting.kind === 'text') return [textRow(label, setting)]
    return [
      colorRow(label, setting.key, currentColors.get(setting.key) ?? setting.value, (hex) => writeSetting(setting.key, hex)),
    ]
  }

  const textRows = (texts: readonly HTMLElement[]): HTMLElement[] =>
    texts.map((node, i) => {
      const target = node
      const row = el('div', { class: 'ep-design-row' })
      const input = el('input', { class: 'ep-design-input' })
      input.type = 'text'
      input.value = directText(target)
      input.addEventListener('input', () => {
        target.textContent = input.value
        touchContent()
      })
      row.append(
        el('label', { class: 'ep-design-label', text: texts.length === 1 ? '文言' : `文言${i + 1}` }),
        input,
      )
      return row
    })

  const cardTitle = (card: Card, index: number): string => `${card.kind}${index + 1}`

  const buildCard = (card: Card, index: number): HTMLElement => {
    const box = el('div', { class: 'ep-design-card' })
    const head = el('div', { class: 'ep-design-card-head' })
    head.append(
      el('span', { class: 'ep-design-card-kind', text: cardTitle(card, index) }),
      el('span', {
        class: 'ep-design-card-snippet',
        text: card.count > 1 ? `${card.snippet} ×${card.count}` : card.snippet,
      }),
    )
    box.append(head)

    const texts = textRows(card.texts)
    box.append(...texts.slice(0, TEXT_ROWS_VISIBLE))
    const rest = texts.slice(TEXT_ROWS_VISIBLE)
    if (rest.length > 0) {
      const more = el('button', { class: 'wdp-more', text: `ほかの文言 ${rest.length}件も表示` })
      more.type = 'button'
      more.addEventListener('click', () => more.replaceWith(...rest))
      box.append(more)
    }

    // いまのプレビューで効いていない行を見分ける。
    // 編集画面は @media を LPの幅（620px）で判定する（本人指定）。そのため公開ページをPCで見たときに使われる
    // 「画面幅768px以上」などの値は、編集画面では使われない。行は変えられるまま、薄くして理由を添える。
    const isMediaInEffect = (setting: Setting): boolean => setting.media.every((query) => lpMediaMatches(query))
    const winners = card.rows.filter(
      (r): r is CssRow => r.kind === 'css' && r.setting.media.length > 0 && isMediaInEffect(r.setting),
    )
    /** いま効いている条件つきの行 winner が、条件なしの行 row を上書きしているか */
    const overrides = (winner: CssRow, row: CssRow): boolean => {
      if (winner.state !== row.state) return false
      const w = winner.setting
      const r = row.setting
      if (w.label === r.label) return true
      if (w.kind === 'color' || r.kind === 'color' || w.isVariable || r.isVariable) return false
      // まとめ書きは個別の指定を上書きする（PCの margin:0 が スマホの margin-top:7.5% を上書き）
      if (r.property.startsWith(`${w.property}-`)) return true
      // 同じまとめ書きで、PC側が1つの値なら、スマホ側の「上下」「左右」などの部分も全部上書き
      return w.property === r.property && !w.label.includes('・')
    }
    const inactiveNote = (r: RowSource): string => {
      if (r.kind !== 'css') return ''
      if (r.setting.media.length > 0) {
        return isMediaInEffect(r.setting) ? '' : 'LPの幅（620px）では使われていません（広い画面で見たときの値です）'
      }
      const winner = winners.find((w) => overrides(w, r))
      return winner === undefined ? '' : `LPの幅（620px）では（${winner.setting.context}）の値が使われています`
    }

    for (const group of GROUP_ORDER) {
      // いつもの値を先に、状態や画面幅などの条件つきの値を後に並べる（同じ名前の行が離れないよう、元の順は保つ）
      const rank = (r: RowSource): number =>
        r.kind === 'inline' ? 0 : (r.setting.context === '' ? 0 : 2) + (r.state === '' ? 0 : 1)
      const rows = card.rows
        .map((row, order) => ({ row, order }))
        .filter(({ row }) => groupOf(row) === group)
        .sort((a, b) => rank(a.row) - rank(b.row) || a.order - b.order)
        .map(({ row }) => row)
      if (rows.length === 0) continue
      box.append(el('div', { class: 'wdp-group', text: GROUP_TITLES[group] }))
      for (const row of rows) {
        const rowEls = buildRow(row, index)
        box.append(...rowEls)
        const note = inactiveNote(row)
        if (note === '') continue
        for (const rowEl of rowEls) rowEl.classList.add('wdp-inactive')
        box.append(el('div', { class: 'wdp-row-note', text: note }))
      }
    }
    return box
  }

  /** 要素（自分か外側）のカード。Widgetの中身の外に出たら null */
  const cardOf = (target: HTMLElement, cards: readonly Card[]): { card: Card; index: number; node: HTMLElement } | null => {
    for (let node: HTMLElement | null = target; node !== null && node !== deps.content; node = node.parentElement) {
      const index = cards.findIndex((card) => card.nodes.includes(node as HTMLElement))
      const card = cards[index]
      if (card !== undefined) return { card, index, node }
    }
    return null
  }

  const render = (): void => {
    swatches = new Map()
    valueInputs = new Map()
    currentColors.clear()
    units.clear()
    const cards = collectCards(deps.content, deps.readCss())
    lastCards = cards
    if (selectedNode !== null && !deps.content.contains(selectedNode)) selectedNode = null
    const picked = selectedNode === null ? null : cardOf(selectedNode, cards)
    const onlyPicked = picked !== null && !showAll

    const bar = el('div', { class: 'wdp-select-bar' })
    if (picked === null) {
      bar.append(el('span', { class: 'wdp-select-note', text: '左で直したい所を押すと、その要素の設定だけを出します。' }))
    } else {
      bar.append(
        el('span', { class: 'wdp-select-name', text: `選んでいるもの: ${cardTitle(picked.card, picked.index)}　${picked.card.snippet}` }),
      )
      const toggle = el('button', { class: 'wdp-select-toggle', text: onlyPicked ? '全部のカードを見る' : '選んだ要素だけ見る' })
      toggle.type = 'button'
      toggle.addEventListener('click', () => {
        showAll = !showAll
        render()
      })
      bar.append(toggle)
    }

    const grid = el('div', { class: 'ep-design-grid' })
    const shownCards = onlyPicked ? [picked] : cards.map((card, index) => ({ card, index }))
    if (shownCards.length === 0) {
      grid.append(
        el('div', {
          class: 'ep-design-empty',
          text: '変えられる設定が見つかりませんでした。「デフォルト時のコードを表示」から直接編集してください。',
        }),
      )
    }
    for (const { card, index } of shownCards) grid.append(buildCard(card, index))
    root.replaceChildren(
      el('div', { class: 'wdp-title', text: 'デザイン（要素ごとに編集）' }),
      el('div', {
        class: 'ep-design-note',
        text: 'Widgetを要素ごとのカードに分けています。色・大きさ・余白・動きを変えると、左のプレビューとコードにそのまま反映されます。数字は名前を左右にドラッグでも変えられます。',
      }),
      bar,
      grid,
    )
  }
  rebuild.now = render

  // 左のプレビューで文字や書式を変えたら、少し待ってからカードを作り直す
  deps.content.addEventListener('input', () => {
    if (isApplying) return
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(render, REFRESH_DELAY_MS)
  })

  /** CSSの設定1つを、選択枠のハンドルにする */
  const cssHandle = (kind: 'width' | 'height' | 'font', setting: Setting, node: HTMLElement): SelectionHandle => {
    const current = (): Setting | undefined => scanSettings(deps.readCss()).find((s) => s.key === setting.key)
    const unit = units.get(setting.key) ?? setting.unit
    const range = sliderRange(unit, setting.property, Number(setting.value)) ?? { min: 0, max: 2000, step: 1 }
    const pxPerUnit = (): number => {
      if (kind === 'font') return unit === 'em' || unit === 'rem' ? FONT_PX_PER_UNIT * EM_PX : FONT_PX_PER_UNIT
      if (unit === '%') {
        const parent = node.parentElement
        return (kind === 'width' ? (parent?.clientWidth ?? node.clientWidth) : (parent?.clientHeight ?? node.clientHeight)) / 100 || 1
      }
      if (unit === 'em' || unit === 'rem') return EM_PX
      if (unit === 'vw') return window.innerWidth / 100
      return 1
    }
    const write = (n: number): void => {
      const latest = current()
      if (latest !== undefined) writeNumber(latest, n)
    }
    return {
      kind,
      label: setting.label,
      unit,
      range,
      read: () => Number(current()?.value ?? setting.value),
      pxPerUnit,
      preview: write,
      commit: write,
    }
  }

  /** 画像・動画の幅（%）。CSSに幅の設定が無いときの直書き（画像の操作パネルと同じ書き方） */
  const mediaHandle = (media: HTMLElement): SelectionHandle => ({
    kind: 'width',
    label: '幅',
    unit: '%',
    range: { min: 10, max: 100, step: 1 },
    read: () => currentMediaWidthPct(media),
    pxPerUnit: () => (media.parentElement?.clientWidth ?? media.clientWidth) / 100 || 1,
    preview: (n) => applyMediaWidth(media, n),
    commit: (n) => {
      applyMediaWidth(media, n)
      touchContent()
    },
  })

  /** Widgetの外側の上下の余白（余白の欄と同じ、直書きの padding） */
  const paddingHandles = (outer: HTMLElement): SelectionHandle[] =>
    (['Top', 'Bottom'] as const).map((side) => {
      const property = `padding-${side.toLowerCase()}`
      const write = (n: number): void => outer.style.setProperty(property, `${n}px`)
      return {
        kind: side === 'Top' ? 'padTop' : 'padBottom',
        label: side === 'Top' ? '上の余白' : '下の余白',
        unit: 'px',
        range: { min: 0, max: 200, step: 1 },
        read: () => {
          const v = parseInt(getComputedStyle(outer)[`padding${side}`], 10)
          return Number.isNaN(v) ? 0 : v
        },
        pxPerUnit: () => 1,
        preview: write,
        commit: (n) => {
          write(n)
          touchContent()
        },
      }
    })

  render()
  return {
    element: root,
    refresh: render,
    select: (target) => {
      if (target === null) {
        selectedNode = null
        render()
        return null
      }
      const cards = collectCards(deps.content, deps.readCss())
      const found = cardOf(target, cards)
      selectedNode = found?.node ?? null
      showAll = false
      render()
      root.scrollTop = 0
      return found === null ? null : { node: found.node, label: `${cardTitle(found.card, found.index)}　${found.card.snippet}` }
    },
    handlesFor: (node) => {
      const handles: SelectionHandle[] = []
      const found = cardOf(node, lastCards)
      if (found !== null && found.node === node) {
        const taken = new Set<string>()
        for (const row of found.card.rows) {
          if (row.kind !== 'css') continue
          const kind = handleKindOf(row.setting)
          if (kind === null || taken.has(kind) || row.state !== '' || row.setting.context !== '') continue
          taken.add(kind)
          handles.push(cssHandle(kind, row.setting, node))
        }
      }
      if ((node.tagName === 'IMG' || node.tagName === 'VIDEO') && !handles.some((h) => h.kind === 'width')) handles.push(mediaHandle(node))
      if (node === deps.content.firstElementChild) handles.push(...paddingHandles(node))
      return handles
    },
  }
}

function injectStyles(): void {
  if (document.getElementById('wdp-css') !== null) return
  const s = document.createElement('style')
  s.id = 'wdp-css'
  s.textContent = `
    /* 画面いっぱいの「コード表示」では右が全幅になるので、カードは読みやすい幅で止めて真ん中に置く */
    .wdp-root{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;
      background:#f5f6f8;padding:16px 16px 24px;box-sizing:border-box;
      font-family:${T.font};color:${T.text}}
    .wdp-root>*{width:100%;max-width:900px;margin-left:auto;margin-right:auto;box-sizing:border-box}
    .wdp-title{font-size:14px;font-weight:600;margin-bottom:6px}
    ${designCardCss()}
    .wdp-group{font-size:11px;font-weight:600;color:${T.sub};letter-spacing:.04em;
      margin:12px 0 0;padding-top:10px;border-top:1px solid #eef0f3}
    .ep-design-card-head + .wdp-group{border-top:none;padding-top:0;margin-top:4px}
    .wdp-root .ep-design-label.wdp-label{width:auto;min-width:52px;flex:1;line-height:1.5}
    .wdp-root .ep-design-label.wdp-label-text{flex:0 1 auto;max-width:45%}
    .wdp-root .ep-design-input.wdp-number{flex:none;width:96px;font-variant-numeric:tabular-nums}
    .wdp-unit{min-width:22px}
    .wdp-slider-row{padding:0 0 4px}
    .wdp-slider{width:100%;margin:0;height:18px;accent-color:var(--sb-accent,${T.primary});cursor:pointer}
    .wdp-select-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 10px;
      padding:8px 12px;border-radius:8px;background:#fff;border:1px solid #e3e6ea;font-size:12.5px;line-height:1.5}
    .wdp-select-note{color:${T.sub}}
    .wdp-select-name{min-width:0;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .wdp-select-toggle{flex-shrink:0;border:1px solid #cfd5dd;background:#fff;color:var(--sb-accent,${T.primary});
      border-radius:6px;padding:5px 10px;font-size:12px;font-family:inherit;font-weight:600;cursor:pointer;white-space:nowrap}
    .wdp-select-toggle:hover{border-color:var(--sb-accent,${T.primary})}
    .wdp-swatch{cursor:pointer;flex:none}
    .wdp-swatch:focus-visible{outline:2px solid var(--sb-accent,${T.primary});outline-offset:2px}
    .wdp-inactive .wdp-label,.wdp-inactive .ep-design-hex{color:${T.sub}}
    .wdp-inactive input,.wdp-inactive .wdp-swatch{opacity:.6}
    .wdp-row-note{font-size:11px;color:${T.sub};line-height:1.5;margin-top:2px}
    .wdp-more{margin-top:8px;width:100%;border:1px dashed #cfd5dd;background:#fff;color:${T.sub};
      border-radius:6px;padding:6px 10px;font-size:12px;font-family:inherit;cursor:pointer}
    .wdp-more:hover{border-color:var(--sb-accent,${T.primary});color:var(--sb-accent,${T.primary})}
  `
  document.head.append(s)
}

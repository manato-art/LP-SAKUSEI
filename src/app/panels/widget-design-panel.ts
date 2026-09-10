/**
 * Widget編集の右側「デザイン（要素ごとに編集）」。
 *
 * 離脱防止ポップアップのデザインタブと同じく、Widget を1要素ずつのカードに分けて
 * 文言と色をその場で変えられるようにする（本人指定）。
 *   文言 … 直下に文字を持つ要素。書き換えると左のプレビューとHTMLに反映
 *   色   … その要素に当たるCSSの色（`widget-colors.ts` が宣言ごとに拾う）。変えるとCSSに反映。
 *          要素に直接書かれた色（style="color:…"）もここで変えられる
 *
 * 普段はこれを出し、「デフォルト時のコードを表示」を押すと今のHTML/CSSに切り替わる（本人指定）。
 *
 * 矢印のように `::before` / `::after` を CSS変数で塗っている Widget は、変える場所が
 * 変数の1か所だけなので、その変数を宣言している要素のカードに「色」として1行だけ出る。
 */
import { T, el } from '../ui.ts'
import { directText } from '../pages/exit-popup-fields.ts'
import { designCardCss } from './design-card-styles.ts'
import { openColorPicker } from './toolbar/color-picker.ts'
import { colorToHex, replaceColor, scanColorDecls, type ColorDecl } from './widget-colors.ts'

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
}

/** カード1行ぶんの色。CSS の宣言か、要素に直接書かれた style */
type ColorSource =
  | { readonly kind: 'css'; readonly decl: ColorDecl; readonly state: string }
  | { readonly kind: 'inline'; readonly node: HTMLElement; readonly property: 'color' | 'background-color' }

interface Card {
  readonly kind: string
  readonly snippet: string
  readonly count: number
  /** 文言を書き換える要素（文字を持たない要素なら null） */
  readonly text: HTMLElement | null
  readonly colors: readonly ColorSource[]
}

/** プレビュー側で書式を変えたとき、カードを作り直すまでの待ち（打つたびに作り直さない） */
const REFRESH_DELAY_MS = 250

/** 読めないセレクタ（`:-ms-input-placeholder` のようなブラウザ固有の書き方）は「当たらない」扱い */
function queryAll(root: HTMLElement, selector: string): Element[] {
  try {
    return [...root.querySelectorAll(selector)]
  } catch {
    return []
  }
}

function collectCards(content: HTMLElement, css: string): Card[] {
  const byNode = new Map<Element, ColorSource[]>()
  const globals: ColorSource[] = []
  for (const decl of scanColorDecls(css)) {
    if (decl.isGlobal) {
      globals.push({ kind: 'css', decl, state: '' })
      continue
    }
    for (const target of decl.targets) {
      for (const node of queryAll(content, target.selector)) {
        const list = byNode.get(node) ?? []
        if (list.some((s) => s.kind === 'css' && s.decl.key === decl.key)) continue
        byNode.set(node, [...list, { kind: 'css', decl, state: target.state }])
      }
    }
  }

  const cards: Card[] = []
  if (globals.length > 0) {
    cards.push({ kind: '全体', snippet: 'Widget全体に効く色', count: 1, text: null, colors: globals })
  }
  /** 文字も直書きの色も無く、当たるCSSがまったく同じ要素（矢印の3本など）は1枚にまとめる */
  const mergedAt = new Map<string, number>()

  for (const node of content.querySelectorAll<HTMLElement>('*')) {
    if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') continue
    const leafText = node.children.length === 0 ? directText(node).trim() : ''
    const inline: ColorSource[] = (['color', 'background-color'] as const)
      .filter((property) => node.style.getPropertyValue(property) !== '')
      .map((property) => ({ kind: 'inline', node, property }))
    const colors: ColorSource[] = [...(byNode.get(node) ?? []), ...inline]
    // 文字はあるのに文字色がどこにも無ければ、直接つける行を出す（離脱防止ポップアップと同じ）
    const hasTextColor = colors.some((c) =>
      c.kind === 'inline' ? c.property === 'color' : c.decl.property === 'color',
    )
    if (leafText !== '' && !hasTextColor) colors.push({ kind: 'inline', node, property: 'color' })
    if (leafText === '' && colors.length === 0) continue

    if (leafText === '' && inline.length === 0) {
      const signature = colors
        .map((c) => (c.kind === 'css' ? `${c.decl.key}/${c.state}` : ''))
        .join('|')
      const at = mergedAt.get(signature)
      const merged = at === undefined ? undefined : cards[at]
      if (at !== undefined && merged !== undefined) {
        cards[at] = { ...merged, count: merged.count + 1 }
        continue
      }
      mergedAt.set(signature, cards.length)
    }

    const tag = node.tagName.toLowerCase()
    const kind = tag === 'button' || tag === 'a' ? 'ボタン' : leafText !== '' ? 'テキスト' : '要素'
    const namedClass = [...node.classList].find((c) => !/^(?:css-|Mui|sb-)/.test(c))
    const snippet =
      leafText !== '' ? leafText.slice(0, 24) : namedClass !== undefined ? `.${namedClass}` : `<${tag}>`
    cards.push({ kind, snippet, count: 1, text: leafText !== '' ? node : null, colors })
  }
  return cards
}

export function buildDesignPanel(deps: DesignPanelDeps): DesignPanel {
  injectStyles()
  const root = el('div', { class: 'wdp-root' })

  /** 同じ宣言の見本はカードをまたいで出ることがあるので、まとめて塗り替えられるように控える */
  let swatches = new Map<string, { swatch: HTMLElement; hex: HTMLElement }[]>()
  /** 変えた後の色（ピッカーを開き直したとき、今の色から始めるため） */
  const current = new Map<string, string>()
  /** カードからの変更で飛ぶ input では作り直さない（打っている入力欄が消えないように） */
  let isApplying = false
  let refreshTimer: ReturnType<typeof setTimeout> | undefined

  const touchContent = (): void => {
    isApplying = true
    deps.content.dispatchEvent(new Event('input', { bubbles: true }))
    isApplying = false
  }

  const paint = (key: string, value: string): void => {
    current.set(key, value)
    for (const s of swatches.get(key) ?? []) {
      s.swatch.style.background = value
      s.hex.textContent = value.toUpperCase()
    }
  }

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
          paint(key, picked)
        },
        // Widget編集は常時表示なので、ツールバーの開閉状態は持たない
        { lastRange: null, keepOpen: false },
        () => undefined,
        colorToHex(current.get(key) ?? value) ?? undefined,
      )
    })
    row.append(el('label', { class: 'ep-design-label wdp-label', text: label }), swatch, hex)
    return row
  }

  const buildCard = (card: Card, index: number): HTMLElement => {
    const box = el('div', { class: 'ep-design-card' })
    const head = el('div', { class: 'ep-design-card-head' })
    head.append(
      el('span', { class: 'ep-design-card-kind', text: `${card.kind}${index + 1}` }),
      el('span', {
        class: 'ep-design-card-snippet',
        text: card.count > 1 ? `${card.snippet} ×${card.count}` : card.snippet,
      }),
    )
    box.append(head)

    if (card.text !== null) {
      const target = card.text
      const row = el('div', { class: 'ep-design-row' })
      const input = el('input', { class: 'ep-design-input' })
      input.type = 'text'
      input.value = directText(target)
      input.addEventListener('input', () => {
        target.textContent = input.value
        touchContent()
      })
      row.append(el('label', { class: 'ep-design-label', text: '文言' }), input)
      box.append(row)
    }

    for (const source of card.colors) {
      if (source.kind === 'css') {
        const { decl, state } = source
        box.append(
          colorRow(
            state === '' ? decl.label : `${decl.label}（${state}）`,
            decl.key,
            current.get(decl.key) ?? decl.value,
            (hex) => deps.writeCss(replaceColor(deps.readCss(), decl.key, hex)),
          ),
        )
      } else {
        const { node, property } = source
        box.append(
          colorRow(
            property === 'color' ? '文字色' : '背景色',
            `inline:${index}:${property}`,
            node.style.getPropertyValue(property),
            (hex) => {
              node.style.setProperty(property, hex)
              touchContent()
            },
          ),
        )
      }
    }
    return box
  }

  const render = (): void => {
    swatches = new Map()
    current.clear()
    const cards = collectCards(deps.content, deps.readCss())
    const grid = el('div', { class: 'ep-design-grid' })
    if (cards.length === 0) {
      grid.append(
        el('div', {
          class: 'ep-design-empty',
          text: '変えられる文言・色が見つかりませんでした。「デフォルト時のコードを表示」から直接編集してください。',
        }),
      )
    }
    cards.forEach((card, i) => grid.append(buildCard(card, i)))
    root.replaceChildren(
      el('div', { class: 'wdp-title', text: 'デザイン（要素ごとに編集）' }),
      el('div', {
        class: 'ep-design-note',
        text: 'Widgetを要素1個ずつのカードに分けています。文言や色を変えると、左のプレビューとコードにそのまま反映されます。',
      }),
      grid,
    )
  }

  // 左のプレビューで文字や書式を変えたら、少し待ってからカードを作り直す
  deps.content.addEventListener('input', () => {
    if (isApplying) return
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(render, REFRESH_DELAY_MS)
  })

  render()
  return { element: root, refresh: render }
}

function injectStyles(): void {
  if (document.getElementById('wdp-css') !== null) return
  const s = document.createElement('style')
  s.id = 'wdp-css'
  s.textContent = `
    .wdp-root{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;
      background:#f5f6f8;padding:16px 16px 24px;box-sizing:border-box;
      font-family:${T.font};color:${T.text}}
    .wdp-title{font-size:14px;font-weight:600;margin-bottom:6px}
    ${designCardCss()}
    .wdp-root .ep-design-label.wdp-label{width:auto;min-width:52px;flex:1;line-height:1.5}
    .wdp-swatch{cursor:pointer;flex:none}
    .wdp-swatch:focus-visible{outline:2px solid var(--sb-accent,${T.primary});outline-offset:2px}
  `
  document.head.append(s)
}

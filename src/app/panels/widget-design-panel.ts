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
 * 普段はこれを出し、「デフォルト時のコードを表示」を押すと今のHTML/CSSに切り替わる（本人指定）。
 */
import { T, el } from '../ui.ts'
import { directText } from '../pages/exit-popup-fields.ts'
import { designCardCss } from './design-card-styles.ts'
import { openColorPicker } from './toolbar/color-picker.ts'
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

interface Card {
  readonly kind: string
  readonly snippet: string
  /** まとめた要素の数 */
  readonly count: number
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
    texts: HTMLElement[]
    rows: RowSource[]
  }
  const drafts: Draft[] = []
  if (globals.length > 0) {
    drafts.push({ kind: '全体', snippet: 'Widget全体に効く設定', count: 1, texts: [], rows: globals })
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
    const draft: Draft = { kind, snippet, count: 1, texts, rows }
    drafts.push(draft)
    if (signature !== '' && inline.length === 0) bySignature.set(signature, draft)
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
  /** カードからの変更で飛ぶ input では作り直さない（打っている入力欄が消えないように） */
  let isApplying = false
  let refreshTimer: ReturnType<typeof setTimeout> | undefined
  /** 行の中から作り直しを頼むための入口（render は行を組み立てる関数より後で決まる） */
  const rebuild = { now: (): void => undefined }

  const touchContent = (): void => {
    isApplying = true
    deps.content.dispatchEvent(new Event('input', { bubbles: true }))
    isApplying = false
  }

  const writeSetting = (key: string, next: string): void => {
    deps.writeCss(replaceSetting(deps.readCss(), key, next))
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

  const numberRow = (label: string, setting: Setting): HTMLElement => {
    const row = el('div', { class: 'ep-design-row' })
    const input = el('input', { class: 'ep-design-input wdp-number' })
    input.type = 'number'
    input.step = String(numberStep(setting))
    // `.5` は number 入力欄が受け付けないので、数として正規化してから入れる
    input.value = String(Number(setting.value))
    let unit = setting.unit
    const unitEl = el('span', { class: 'ep-design-hex wdp-unit', text: unit })
    input.addEventListener('input', () => {
      const n = input.valueAsNumber
      if (!Number.isFinite(n)) return
      const next = numberToken({ ...setting, unit }, n)
      unit = next.unit
      unitEl.textContent = unit
      writeSetting(setting.key, next.token)
    })
    row.append(labelEl(label), input, unitEl)
    return row
  }

  const textRow = (label: string, setting: Setting): HTMLElement => {
    const row = el('div', { class: 'ep-design-row' })
    const input = el('input', { class: 'ep-design-input' })
    input.type = 'text'
    input.value = setting.value
    input.spellcheck = false
    input.addEventListener('input', () => {
      const clean = sanitizeValue(input.value)
      if (clean !== input.value) input.value = clean
      writeSetting(setting.key, clean)
    })
    // 書き終わったら作り直す（同じ宣言にある色の見本などの位置を最新にする）
    input.addEventListener('change', () => rebuild.now())
    row.append(labelEl(label, 'wdp-label-text'), input)
    return row
  }

  const buildRow = (source: RowSource, cardIndex: number): HTMLElement => {
    if (source.kind === 'inline') {
      const { nodes, property } = source
      return colorRow(
        property === 'color' ? '文字色' : '背景色',
        `inline:${cardIndex}:${property}`,
        nodes[0]?.style.getPropertyValue(property) ?? '',
        (hex) => {
          for (const node of nodes) node.style.setProperty(property, hex)
          touchContent()
        },
      )
    }
    const { setting, state } = source
    // 状態（ホバー時など）と効く条件（画面幅768px以上など）を名前の後ろに添える
    const notes = [state, setting.context].filter((n) => n !== '')
    const label = notes.length === 0 ? setting.label : `${setting.label}（${notes.join('・')}）`
    if (setting.kind === 'number') return numberRow(label, setting)
    if (setting.kind === 'text') return textRow(label, setting)
    return colorRow(label, setting.key, currentColors.get(setting.key) ?? setting.value, (hex) =>
      writeSetting(setting.key, hex),
    )
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
    // 編集画面のプレビューは @media をブラウザの画面幅で判定するので、PCで開くと
    // スマホ向けの値（条件なし）が「画面幅768px以上」の値に上書きされ、変えても見た目が動かない
    // （テキストバルーンで実際に起きた）。行は変えられるまま、薄くして理由を添える。
    const isMediaInEffect = (setting: Setting): boolean =>
      setting.media.every((query) => window.matchMedia(query).matches)
    const winners = new Map<string, string>()
    for (const r of card.rows) {
      if (r.kind === 'css' && r.setting.media.length > 0 && isMediaInEffect(r.setting)) {
        winners.set(`${r.setting.label}|${r.state}`, r.setting.context)
      }
    }
    const inactiveNote = (r: RowSource): string => {
      if (r.kind !== 'css') return ''
      if (r.setting.media.length > 0) {
        return isMediaInEffect(r.setting) ? '' : 'いまのプレビューの画面幅では使われていません'
      }
      const winner = winners.get(`${r.setting.label}|${r.state}`)
      return winner === undefined ? '' : `いまのプレビューでは（${winner}）の値が使われています`
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
        const rowEl = buildRow(row, index)
        box.append(rowEl)
        const note = inactiveNote(row)
        if (note === '') continue
        rowEl.classList.add('wdp-inactive')
        box.append(el('div', { class: 'wdp-row-note', text: note }))
      }
    }
    return box
  }

  const render = (): void => {
    swatches = new Map()
    currentColors.clear()
    const cards = collectCards(deps.content, deps.readCss())
    const grid = el('div', { class: 'ep-design-grid' })
    if (cards.length === 0) {
      grid.append(
        el('div', {
          class: 'ep-design-empty',
          text: '変えられる設定が見つかりませんでした。「デフォルト時のコードを表示」から直接編集してください。',
        }),
      )
    }
    cards.forEach((card, i) => grid.append(buildCard(card, i)))
    root.replaceChildren(
      el('div', { class: 'wdp-title', text: 'デザイン（要素ごとに編集）' }),
      el('div', {
        class: 'ep-design-note',
        text: 'Widgetを要素ごとのカードに分けています。色・大きさ・余白・動きを変えると、左のプレビューとコードにそのまま反映されます。同じ見た目の要素は1枚にまとめています。',
      }),
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
    .wdp-group{font-size:11px;font-weight:600;color:${T.sub};letter-spacing:.04em;
      margin:12px 0 0;padding-top:10px;border-top:1px solid #eef0f3}
    .ep-design-card-head + .wdp-group{border-top:none;padding-top:0;margin-top:4px}
    .wdp-root .ep-design-label.wdp-label{width:auto;min-width:52px;flex:1;line-height:1.5}
    .wdp-root .ep-design-label.wdp-label-text{flex:0 1 auto;max-width:45%}
    .wdp-root .ep-design-input.wdp-number{flex:none;width:96px;font-variant-numeric:tabular-nums}
    .wdp-unit{min-width:22px}
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

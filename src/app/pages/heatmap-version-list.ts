/**
 * ヒートマップ左の「Version一覧」（2026-09-25・本人「全体的に視覚的にわかりやすく」「utm_source=fb … がわかりずらい」）。
 *
 * 以前は採取物の1行をテンプレートに複製していた。そのせいで
 *  - 「離脱 CLICK CV」の見出しが一覧の上に離れていて、行には文字の無いチェックが3つ並ぶだけ
 *  - 選ぶとチェックの上に赤い弧（採取CSSの border-top）が出る
 *  - 名前が1行で切れる（全部読むにはマウスを乗せる）
 *  - 広告は `utm_source=fb` の生の文字。何人来たのか、選ぶと何が起きるのかが分からない
 *  - 「元に戻す」がいつも出ている（何を戻すのか分からない）
 * ここで組み直す:
 *  - 名前は2行まで折り返して見せ、PVは右に「79 PV」
 *  - 指標は文字の入ったボタン。押すと青く塗られて印が付き、右に列が増える
 *  - 広告は種類ごと（流入元・キャンペーン…）にまとめ、値と人数を並べる。生の名前は title に残す
 *  - 「外す」は広告を選んでいるときだけ出す
 *  - 指標を選んでいる行は白い面にして、右のヒートマップとつながって見せる（実物の選択中の行と同じ考え）
 * チェックボックスはそのまま使う（見えなくして文字のボタンで包む）。キーボードでも押せ、
 * カードの「非表示にする」から外す配線（checked を変えて change を投げる）もそのまま通る。
 */
import type { HeatmapParameter, ReportVersionRow } from '../api.ts'
import type { HeatmapMetric } from './heatmap-columns.ts'
import { groupAdParams, paramsForVersion } from './heatmap-params.ts'

export interface VersionListDeps {
  /** 今チェックされている `versionUid|metric`（並び替えで描き直しても選択を保つ） */
  selection: ReadonlySet<string>
  onToggle: (versionUid: string, metric: HeatmapMetric, on: boolean) => void
  /** カードの「非表示にする」から外せるように、指標のチェックを預ける */
  registerMetric: (key: string, box: HTMLInputElement) => void
  params: {
    parameters: readonly HeatmapParameter[]
    /** 今チェックされている `versionUid|utm_source=fb` */
    selected: ReadonlySet<string>
    onToggle: (versionUid: string, param: string, on: boolean) => void
    register: (key: string, box: HTMLInputElement) => void
  }
}

const METRICS: readonly { metric: HeatmapMetric; label: string; hint: string }[] = [
  { metric: 'exit', label: '離脱', hint: 'どこで読むのをやめたか' },
  { metric: 'click', label: 'クリック', hint: 'どこが押されたか' },
  { metric: 'cv', label: 'CV', hint: '申し込みの数（画面のどこで起きたかは記録していません）' },
]

const CSS_ID = 'sb-heatmap-version-list-css'

function injectStyles(): void {
  if (document.getElementById(CSS_ID) !== null) return
  const s = document.createElement('style')
  s.id = CSS_ID
  // ダークの自動変換（dark-runtime-css.ts）の対象から外す。色は全部ダークでも切り替わる変数（index.html）で書いてあり、
  // 自動変換に任せると、あとから足される変換後の地の色が「選んだときの青」より強くなって青が消えた（2026-09-25 実測）
  s.dataset['darkRuntime'] = 'skip'
  s.textContent = `
    .hm-vl-item {
      list-style:none; margin:0 0 6px; padding:14px 14px 14px 20px;
      border-radius:12px 0 0 12px; background:transparent; transition:background .15s;
    }
    /* 指標を選んでいる行＝右のヒートマップに出ている行。白い面で右とつなげる */
    .hm-vl-item:has(.hm-vl-metrics input:checked) { background:var(--sb-c-ffffff, #FFFFFF); }
    /* ダークは周りも右も同じ暗さなので、選んだ行だけ少し明るい面にして分かるようにする */
    html[data-theme="dark"] .hm-vl-item:has(.hm-vl-metrics input:checked) { background:rgb(38, 40, 48); }
    .hm-vl-top { display:flex; align-items:flex-start; gap:10px; }
    .hm-vl-name {
      flex:1; min-width:0; font-size:13px; font-weight:700; line-height:1.45;
      color:var(--sb-c-1a1a1a, #1A1A1A); overflow-wrap:anywhere;
      display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
    }
    .hm-vl-pv {
      flex:none; font-size:11px; line-height:19px; color:var(--sb-c-6a6a72, #6A6A72);
      font-variant-numeric:tabular-nums; white-space:nowrap;
    }
    .hm-vl-pv b { font-size:13px; font-weight:700; color:var(--sb-c-1a1a1a, #1A1A1A); }
    .hm-vl-input { position:absolute; width:1px; height:1px; margin:0; opacity:0; pointer-events:none; }
    .hm-vl-check { display:none; flex:none; }
    .hm-vl-metrics { display:flex; gap:6px; margin-top:10px; }
    .hm-vl-toggle {
      position:relative; flex:1 1 0; min-width:0; display:flex; align-items:center; justify-content:center; gap:4px;
      height:32px; border:1px solid var(--sb-c-d5d5db, #D5D5DB); border-radius:8px;
      background:var(--sb-c-ffffff, #FFFFFF); color:var(--sb-c-444444, #444444);
      font-size:12px; font-weight:700; cursor:pointer; user-select:none; transition:background .12s, border-color .12s;
    }
    .hm-vl-toggle:hover { border-color:var(--sb-accent, #0091FF); }
    .hm-vl-toggle:has(input:checked) {
      background:var(--sb-accent, #0091FF); border-color:var(--sb-accent, #0091FF); color:#FFFFFF;
    }
    .hm-vl-toggle:has(input:checked) .hm-vl-check,
    .hm-vl-chip:has(input:checked) .hm-vl-check { display:inline-block; }
    .hm-vl-toggle:has(input:focus-visible),
    .hm-vl-chip:has(input:focus-visible) { outline:2px solid var(--sb-accent, #0091FF); outline-offset:2px; }
    .hm-vl-ads { margin-top:12px; padding-top:10px; border-top:1px solid var(--sb-c-dcdce2, #DCDCE2); }
    .hm-vl-ads-head { display:flex; align-items:baseline; justify-content:space-between; gap:8px; }
    .hm-vl-ads-title { font-size:11px; font-weight:700; color:var(--sb-c-444444, #444444); }
    .hm-vl-clear {
      border:0; background:none; padding:0; font:inherit; font-size:11px; font-weight:700;
      color:var(--sb-accent, #0091FF); cursor:pointer;
    }
    .hm-vl-clear[hidden] { display:none; }
    .hm-vl-hint, .hm-vl-none {
      margin:3px 0 0; font-size:10.5px; line-height:1.55; color:var(--sb-c-6a6a72, #6A6A72); text-wrap:pretty;
    }
    .hm-vl-hint[hidden] { display:none; }
    .hm-vl-group { margin-top:8px; }
    .hm-vl-group-name { display:block; margin-bottom:4px; font-size:10.5px; color:var(--sb-c-6a6a72, #6A6A72); }
    .hm-vl-chips { display:flex; flex-wrap:wrap; gap:5px; }
    .hm-vl-chip {
      position:relative; display:inline-flex; align-items:center; gap:6px; max-width:100%; min-height:28px;
      padding:3px 10px; border:1px solid var(--sb-c-d5d5db, #D5D5DB); border-radius:999px;
      background:var(--sb-c-ffffff, #FFFFFF); cursor:pointer; user-select:none; box-sizing:border-box;
      transition:background .12s, border-color .12s;
    }
    .hm-vl-chip:hover { border-color:var(--sb-accent, #0091FF); }
    .hm-vl-chip-value {
      min-width:0; font-size:12px; font-weight:700; color:var(--sb-c-1a1a1a, #1A1A1A); overflow-wrap:anywhere;
    }
    .hm-vl-chip-pv { font-size:10.5px; color:var(--sb-c-6a6a72, #6A6A72); font-variant-numeric:tabular-nums; }
    .hm-vl-chip:has(input:checked) { background:var(--sb-accent, #0091FF); border-color:var(--sb-accent, #0091FF); }
    .hm-vl-chip:has(input:checked) .hm-vl-chip-value,
    .hm-vl-chip:has(input:checked) .hm-vl-chip-pv,
    .hm-vl-chip:has(input:checked) .hm-vl-check { color:#FFFFFF; }
    /* 一覧の上の「離脱 CLICK CV」の見出しは、ボタンに文字が入ったので出さない */
    [class*="_articleList_"] [class*="_selections_"] { display:none !important; }
    .hm-vl-sort-label { margin-left:6px; font-size:11px; font-weight:700; color:var(--sb-c-6a6a72, #6A6A72); white-space:nowrap; }
    [class*="_articleList_"] [class*="_filters_"] [class*="_trigger_"] { display:flex; align-items:center; }
    @media (prefers-reduced-motion: reduce) {
      .hm-vl-item, .hm-vl-toggle, .hm-vl-chip { transition:none; }
    }
    /* スマホは一覧が画面の幅いっぱいになるので、右とつなげる形をやめて角を全部丸める */
    @media (max-width: 768px) {
      .hm-vl-item { border-radius:12px; }
      .hm-vl-toggle { height:40px; }
      .hm-vl-chip { min-height:36px; }
    }
  `
  document.head.append(s)
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

/** 選んでいるときだけ出るチェックの印（色だけに頼らず、形でも選んでいると分かるように） */
function checkIcon(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('class', 'hm-vl-check')
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('width', '12')
  svg.setAttribute('height', '12')
  svg.setAttribute('aria-hidden', 'true')
  const path = document.createElementNS(ns, 'path')
  path.setAttribute('d', 'M3 8.5l3 3 7-7')
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', 'currentColor')
  path.setAttribute('stroke-width', '2.2')
  path.setAttribute('stroke-linecap', 'round')
  path.setAttribute('stroke-linejoin', 'round')
  svg.append(path)
  return svg
}

/** 見えないチェックボックスを文字のボタンで包む */
function hiddenCheckbox(checked: boolean): HTMLInputElement {
  const box = document.createElement('input')
  box.type = 'checkbox'
  box.className = 'hm-vl-input'
  box.checked = checked
  return box
}

function metricToggles(row: ReportVersionRow, deps: VersionListDeps): HTMLElement {
  const group = el('div', 'hm-vl-metrics')
  group.setAttribute('role', 'group')
  group.setAttribute('aria-label', `${row.name}のヒートマップに出す指標`)
  for (const m of METRICS) {
    const key = `${row.entity_uid}|${m.metric}`
    const label = el('label', 'hm-vl-toggle')
    label.title = `${m.label}のヒートマップを右に並べる（${m.hint}）`
    const box = hiddenCheckbox(deps.selection.has(key))
    box.dataset['metric'] = m.metric
    box.addEventListener('change', () => deps.onToggle(row.entity_uid, m.metric, box.checked))
    deps.registerMetric(key, box)
    label.append(box, checkIcon(), el('span', '', m.label))
    group.append(label)
  }
  return group
}

function adFilters(versionUid: string, deps: VersionListDeps['params']): HTMLElement {
  const wrap = el('div', 'hm-vl-ads')
  const head = el('div', 'hm-vl-ads-head')
  const clear = el('button', 'hm-vl-clear', '外す')
  clear.type = 'button'
  clear.title = '広告の絞り込みを外して、全部の広告を合わせた列に戻す'
  head.append(el('span', 'hm-vl-ads-title', '広告で絞る'), clear)
  wrap.append(head)

  const list = paramsForVersion(deps.parameters, versionUid)
  if (list.length === 0) {
    clear.hidden = true
    wrap.append(el('p', 'hm-vl-none', '広告パラメータ（utm_〜）付きで来た人は、まだありません'))
    return wrap
  }
  wrap.append(el('p', 'hm-vl-hint', '選ぶと、その広告から来た人だけで見ます。数字はPVです'))

  const boxes: HTMLInputElement[] = []
  const syncClear = (): void => {
    clear.hidden = !boxes.some((b) => b.checked)
  }
  for (const group of groupAdParams(list)) {
    const block = el('div', 'hm-vl-group')
    const chips = el('div', 'hm-vl-chips')
    chips.setAttribute('role', 'group')
    chips.setAttribute('aria-label', group.label)
    for (const item of group.items) {
      const chip = el('label', 'hm-vl-chip')
      chip.title = `${item.param}（${item.pv.toLocaleString('ja-JP')} PV）から来た人だけで見る`
      const box = hiddenCheckbox(deps.selected.has(`${versionUid}|${item.param}`))
      box.addEventListener('change', () => {
        deps.onToggle(versionUid, item.param, box.checked)
        syncClear()
      })
      deps.register(`${versionUid}|${item.param}`, box)
      boxes.push(box)
      chip.append(
        box,
        checkIcon(),
        el('span', 'hm-vl-chip-value', item.value),
        el('span', 'hm-vl-chip-pv', item.pv.toLocaleString('ja-JP')),
      )
      chips.append(chip)
    }
    block.append(el('span', 'hm-vl-group-name', group.label), chips)
    wrap.append(block)
  }
  clear.addEventListener('click', () => {
    for (const box of boxes) {
      if (!box.checked) continue
      box.checked = false
      box.dispatchEvent(new Event('change'))
    }
    syncClear()
  })
  syncClear()
  return wrap
}

/** 一覧の中身（行）を組み立てて、受け取った ul の中身と入れ替える */
export function renderVersionItems(ul: HTMLElement, rows: readonly ReportVersionRow[], deps: VersionListDeps): void {
  injectStyles()
  const items = rows.map((row) => {
    const li = el('li', 'hm-vl-item')
    li.dataset['versionUid'] = row.entity_uid
    const top = el('div', 'hm-vl-top')
    const name = el('span', 'hm-vl-name', row.name)
    name.title = row.name
    const pv = el('span', 'hm-vl-pv')
    pv.append(el('b', '', row.pv.toLocaleString('ja-JP')), document.createTextNode(' PV'))
    top.append(name, pv)
    li.append(top, metricToggles(row, deps), adFilters(row.entity_uid, deps.params))
    return li
  })
  // 説明は同じ文なので、広告が来ているいちばん上の行にだけ出す
  const hints = items
    .map((li) => li.querySelector<HTMLElement>('.hm-vl-hint'))
    .filter((hint): hint is HTMLElement => hint !== null)
  for (const [i, hint] of hints.entries()) hint.hidden = i > 0
  ul.replaceChildren(...items)
}

/** 一覧の上の「並び替え」の印に、何の印かを書き添える（印だけだと押すものだと分からない） */
export function labelSortTrigger(root: HTMLElement): void {
  injectStyles()
  const trigger = root.querySelector<HTMLElement>('[class*="_articleList_"] [class*="_filters_"] [class*="_trigger_"]')
  if (trigger === null || trigger.querySelector('.hm-vl-sort-label') !== null) return
  trigger.append(el('span', 'hm-vl-sort-label', '並び替え・絞り込み'))
}

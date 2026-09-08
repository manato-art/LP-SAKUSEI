/**
 * ヒートマップの列（実物の採取に合わせた作り）。
 *
 * 実物（`/ab_tests/:uid/reports/lp?tab=heatmap`）の構造:
 *   左のVersionごとに「離脱 / CLICK / CV」のチェックがあり、**チェックした数だけ右に列が増える**。
 *   各列は  Version名 / 指標名 + PV・CTR・CV / 「全パラメータ合算」 /
 *          スマホ・PC切替 + 期間 + ラインのモード選択  を持ち、
 *   その下にLPを縦スクロールで表示し、上にヒートの帯を重ねる。
 *
 * ラインのモードは実物と同じ5種類:
 *   ライン非表示 / 到達率 / 離脱率 / 滞在時間(中央値/平均値) / クリック数
 * 数値は計測タグ由来の実測（`GET /ab_tests/:uid/heatmaps/stats`）。
 * まだ計測が無いバンドは色を塗らず「-」にする（0と「データ無し」を混ぜない）。
 */
import type { HeatmapVersionStat } from '../api.ts'

/** 列の指標（左のチェックボックスに対応）。実物は指標ごとに配色が違う。 */
export type HeatmapMetric = 'exit' | 'click' | 'cv'

export const METRIC_LABEL: Readonly<Record<HeatmapMetric, string>> = {
  exit: '離脱',
  click: 'CLICK',
  cv: 'CV',
}

/** 指標ごとの色相（実物: CV=紫系 / CLICK・離脱=橙〜赤）。 */
const METRIC_HUE: Readonly<Record<HeatmapMetric, number>> = {
  exit: 12,
  click: 28,
  cv: 275,
}

/** ラインのモード（実物の select の value と表記をそのまま使う） */
export type LineMode = 'none' | 'arrival' | 'exit' | 'attention' | 'elementClick'

export const LINE_MODES: readonly { value: LineMode; label: string }[] = [
  { value: 'none', label: 'ライン非表示' },
  { value: 'arrival', label: '到達率' },
  { value: 'exit', label: '離脱率' },
  { value: 'attention', label: '滞在時間(中央値/平均値)' },
  { value: 'elementClick', label: 'クリック数' },
]

const CSS_ID = 'sb-heatmap-columns-css'

function injectStyles(): void {
  if (document.getElementById(CSS_ID) !== null) return
  const s = document.createElement('style')
  s.id = CSS_ID
  s.textContent = `
    .hm-cols { display:flex; gap:16px; overflow-x:auto; padding:4px 2px 12px; align-items:flex-start; }
    .hm-col {
      flex:0 0 320px; background:#1c1c1e; border-radius:10px; overflow:hidden;
      display:flex; flex-direction:column; max-height:70vh;
    }
    .hm-col-head { padding:12px 14px 10px; display:flex; flex-direction:column; gap:4px; flex-shrink:0; }
    .hm-col-version { font-size:13px; font-weight:700; color:#f2f2f4; }
    .hm-col-metric { font-size:12px; color:#c9c9ce; display:flex; gap:8px; align-items:baseline; flex-wrap:wrap; }
    .hm-col-metric b { font-size:13px; }
    .hm-col-note { font-size:11px; color:#8a8a90; }
    .hm-col-ctrl { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:6px; }
    .hm-dev { display:flex; gap:4px; }
    .hm-dev button {
      width:24px; height:22px; border-radius:4px; border:1px solid #3a3a3e; background:#2a2a2e;
      color:#c9c9ce; cursor:pointer; font-size:11px; line-height:1; padding:0;
    }
    .hm-dev button.on { background:#f0960a; border-color:#f0960a; color:#fff; }
    .hm-range { font-size:11px; color:#c9c9ce; font-variant-numeric:tabular-nums; }
    .hm-line-select {
      margin-left:auto; background:#2a2a2e; color:#e8e8ea; border:1px solid #3a3a3e;
      border-radius:4px; font-size:11px; padding:3px 6px; font-family:inherit;
    }
    .hm-col-body { position:relative; overflow:auto; flex:1; background:#0f0f10; }
    .hm-canvas { position:relative; }
    .hm-lp { transform-origin:top left; }
    .hm-lp img { max-width:100%; }
    .hm-overlay { position:absolute; inset:0; pointer-events:none; }
    .hm-band { position:absolute; left:0; right:0; display:flex; align-items:center; justify-content:flex-end; }
    .hm-band span {
      font-size:10px; color:#fff; background:rgba(0,0,0,.55); padding:0 4px; border-radius:2px;
      font-variant-numeric:tabular-nums; margin-right:4px;
    }
    .hm-dot { position:absolute; width:10px; height:10px; margin:-5px 0 0 -5px; border-radius:50%; }
    .hm-empty { padding:28px 14px; color:#8a8a90; font-size:12px; text-align:center; line-height:1.9; }
  `
  document.head.append(s)
}

/** 0-1 の強さを、その指標の色へ。データ無し(null)は塗らない。 */
function bandColor(metric: HeatmapMetric, strength: number): string {
  const hue = METRIC_HUE[metric]
  // 強いほど濃く・不透明に（薄いところを塗りつぶさないよう上限0.62）
  const alpha = 0.08 + Math.min(1, Math.max(0, strength)) * 0.40
  const light = 62 - Math.min(1, Math.max(0, strength)) * 22
  return `hsla(${hue}, 90%, ${light}%, ${alpha})`
}

/** モードごとの「そのバンドの値」と表示文字列 */
function bandValue(
  stat: HeatmapVersionStat,
  mode: LineMode,
  i: number,
): { strength: number; label: string } | null {
  if (mode === 'none') return null
  if (mode === 'arrival' || mode === 'exit') {
    const v = (mode === 'arrival' ? stat.arrival : stat.exit)[i]
    if (v === null || v === undefined) return null
    return { strength: v, label: `${(v * 100).toFixed(1)}%` }
  }
  if (mode === 'attention') {
    const ms = stat.attention[i] ?? 0
    const max = Math.max(1, ...stat.attention)
    return { strength: ms / max, label: `${(ms / 1000).toFixed(1)}s` }
  }
  const n = stat.elementClick[i] ?? 0
  const max = Math.max(1, ...stat.elementClick)
  return { strength: n / max, label: String(n) }
}

export interface ColumnSpec {
  versionUid: string
  versionName: string
  metric: HeatmapMetric
  /** LPの本文HTML（プレビュー用） */
  html: string
  /** レポートの指標（ヘッダーに出す） */
  pv: number
  ctr: number | null
  cv: number
}

export interface ColumnDeps {
  stats: readonly HeatmapVersionStat[]
  /**
   * LP全体（ab_testスコープ）の指標。外部LPの計測はVersionに紐づかないので、
   * Version単位の数字を出すと常に0になる。version無しの集計を使う列ではこちらを出す。
   */
  totals: { pv: number; ctr: number | null; cv: number }
  /**
   * 外部LPの実HTML（サーバーが取得・無害化したもの）。
   * 外部LPの列はこのシステム側にVersion HTMLが無く、背景がサンプルLPになってしまうため、
   * これがあるときは実LPを背景に敷く。取得できていなければ null。
   */
  externalHtml: string | null
  range: { startDate: string; endDate: string }
  /** 全ページ表示（true）か スクロール表示（false） */
  fullPage: boolean
}

/** 1列ぶんを組み立てる */
function buildColumn(spec: ColumnSpec, deps: ColumnDeps): HTMLElement {
  // 外部LPの計測タグは Version を送らない（外部LPは当システム上「1ページ」で
  // Version別の内訳を持たないため）。その場合データは version_uid='' で入るので、
  // Version一致が無ければ version無しの集計にフォールバックする。
  // これが無いと、タグを貼っても列が永久に「まだありません」のままになる。
  const exact = deps.stats.find((s) => s.version_uid === spec.versionUid) ?? null
  const shared = deps.stats.find((s) => s.version_uid === '') ?? null
  const stat = exact ?? shared
  const isShared = exact === null && shared !== null

  const col = document.createElement('div')
  col.className = 'hm-col'
  col.dataset['versionUid'] = spec.versionUid
  col.dataset['metric'] = spec.metric

  const head = document.createElement('div')
  head.className = 'hm-col-head'
  const ver = document.createElement('div')
  ver.className = 'hm-col-version'
  ver.textContent = spec.versionName
  const met = document.createElement('div')
  met.className = 'hm-col-metric'
  const metName = document.createElement('b')
  metName.textContent = METRIC_LABEL[spec.metric]
  const metStats = document.createElement('span')
  // 外部LP（version無し）の列は、Version単位ではなくLP全体の数字を出す。
  // そうしないとタグが動いていてもヘッダーが常に PV: 0 になり誤解を招く。
  const shown = isShared ? deps.totals : { pv: spec.pv, ctr: spec.ctr, cv: spec.cv }
  metStats.textContent =
    `PV: ${shown.pv}  CTR: ${shown.ctr === null ? '-' : `${(shown.ctr * 100).toFixed(2)}%`}  CV: ${shown.cv}`
  met.append(metName, metStats)
  const note = document.createElement('div')
  note.className = 'hm-col-note'
  note.textContent = isShared ? '全パラメータ合算・外部LP（Version区別なし）' : '全パラメータ合算'

  const ctrl = document.createElement('div')
  ctrl.className = 'hm-col-ctrl'
  const dev = document.createElement('div')
  dev.className = 'hm-dev'
  const sp = document.createElement('button')
  sp.type = 'button'
  sp.textContent = 'SP'
  sp.className = 'on'
  const pc = document.createElement('button')
  pc.type = 'button'
  pc.textContent = 'PC'
  for (const b of [sp, pc]) {
    b.addEventListener('click', () => {
      sp.classList.toggle('on', b === sp)
      pc.classList.toggle('on', b === pc)
      lp.style.width = b === pc ? '980px' : '375px'
      applyScale()
    })
  }
  dev.append(sp, pc)
  const rangeEl = document.createElement('span')
  rangeEl.className = 'hm-range'
  rangeEl.textContent = `${deps.range.startDate} ~ ${deps.range.endDate}`
  const lineSelect = document.createElement('select')
  lineSelect.className = 'hm-line-select'
  for (const m of LINE_MODES) {
    const o = document.createElement('option')
    o.value = m.value
    o.textContent = m.label
    lineSelect.append(o)
  }
  lineSelect.value = 'arrival'
  ctrl.append(dev, rangeEl, lineSelect)
  head.append(ver, met, note, ctrl)

  const body = document.createElement('div')
  body.className = 'hm-col-body'
  const canvas = document.createElement('div')
  canvas.className = 'hm-canvas'
  // 背景。外部LPは実LPを iframe で敷く（自前配信は従来どおりVersionのHTML）。
  // iframe にしているのは、他所のLPのCSSがこの画面に漏れ出さないようにするためと、
  // sandbox でスクリプトを**実行させない**ため（サーバー側の除去と合わせて二重の防御）。
  const useExternal = isShared && deps.externalHtml !== null
  const lp: HTMLElement = useExternal
    ? document.createElement('iframe')
    : document.createElement('div')
  lp.className = 'hm-lp'
  lp.style.width = '375px'
  if (useExternal) {
    const frame = lp as HTMLIFrameElement
    // allow-scripts は与えない＝中のJSは動かない。allow-same-origin は高さ測定のため。
    // （危険なのは allow-scripts と allow-same-origin の**同時**指定で、これは該当しない）
    frame.setAttribute('sandbox', 'allow-same-origin')
    frame.setAttribute('referrerpolicy', 'no-referrer')
    frame.setAttribute('scrolling', 'no')
    frame.style.border = '0'
    frame.style.height = '2000px'
    frame.srcdoc = deps.externalHtml as string
  } else {
    lp.innerHTML = spec.html
  }
  const overlay = document.createElement('div')
  overlay.className = 'hm-overlay'
  canvas.append(lp, overlay)
  body.append(canvas)

  // 列幅にLPを収める（実物も縮小表示）
  /** 背景の実高さ。iframe は中の文書を測る（sandbox に allow-scripts が無いので安全に読める）。 */
  const lpHeight = (): number => {
    if (!useExternal) return lp.scrollHeight
    const doc = (lp as HTMLIFrameElement).contentDocument
    return doc?.documentElement.scrollHeight ?? 2000
  }

  const applyScale = (): void => {
    const w = body.clientWidth || 320
    const lpW = parseFloat(lp.style.width) || 375
    const scale = Math.min(1, w / lpW)
    lp.style.transform = `scale(${scale})`
    if (useExternal) lp.style.height = `${lpHeight()}px`
    canvas.style.width = `${lpW * scale}px`
    canvas.style.height = `${lpHeight() * scale}px`
  }
  // iframe は中身の読み込みが終わってからでないと高さが出ない
  if (useExternal) lp.addEventListener('load', applyScale)

  const drawOverlay = (): void => {
    overlay.innerHTML = ''
    const mode = lineSelect.value as LineMode
    if (stat === null || stat.pv === 0) {
      return
    }
    if (mode === 'none') return
    const bands = stat.bands
    for (let i = 0; i < bands; i++) {
      const v = bandValue(stat, mode, i)
      if (v === null) continue
      const band = document.createElement('div')
      band.className = 'hm-band'
      band.style.top = `${(i / bands) * 100}%`
      band.style.height = `${(1 / bands) * 100}%`
      band.style.background = bandColor(spec.metric, v.strength)
      const label = document.createElement('span')
      label.textContent = v.label
      band.append(label)
      overlay.append(band)
    }
    // クリック数モードのときは実際の座標も打つ（帯だけだと横位置が分からない）
    if (mode === 'elementClick') {
      for (const c of stat.clicks.slice(-400)) {
        const dot = document.createElement('div')
        dot.className = 'hm-dot'
        dot.style.left = `${c.x * 100}%`
        dot.style.top = `${c.y * 100}%`
        dot.style.background = bandColor(spec.metric, 0.9)
        overlay.append(dot)
      }
    }
  }

  lineSelect.addEventListener('change', drawOverlay)

  col.append(head, body)
  if (stat === null || stat.pv === 0) {
    const empty = document.createElement('div')
    empty.className = 'hm-empty'
    empty.textContent =
      'このVersionのヒートマップはまだありません。\nLPに計測タグを貼ると、到達率・離脱率・滞在時間・クリックが集まります。'
    empty.style.whiteSpace = 'pre-line'
    body.prepend(empty)
  }

  // 背景タブでは requestAnimationFrame が発火しないので、rAFに依存しない。
  // 直後に一度・レイアウト確定後にもう一度・幅が変わったら再計算する。
  const refresh = (): void => {
    applyScale()
    drawOverlay()
  }
  refresh()
  setTimeout(refresh, 0)
  window.addEventListener('resize', refresh)
  return col
}

/** 選ばれた列をまとめて描画する（0件なら空にする） */
export function renderHeatmapColumns(
  host: HTMLElement,
  specs: readonly ColumnSpec[],
  deps: ColumnDeps,
): void {
  injectStyles()
  // eslint-disable-next-line no-param-reassign -- 描画先を空にするのはこの関数の責務
  host.innerHTML = ''
  if (specs.length === 0) return
  const wrap = document.createElement('div')
  wrap.className = 'hm-cols'
  for (const spec of specs) wrap.append(buildColumn(spec, deps))
  host.append(wrap)
}

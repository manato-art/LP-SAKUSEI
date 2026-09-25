/**
 * ヒートマップの色の面とクリックの点を、**LPの中に**重ねる（2026-09-25・数値面分析テスト）。
 *
 * 以前は面と点をLPの外（スマホ枠）に置いていた。LPは枠の中（iframe）でスクロールするので、
 *  - 色の面: LPの0〜100%を枠の高さ667pxに押し込んで貼っていた＝LPを動かしても面は動かず、色とLPの場所が合わない
 *  - クリックの点: 高さ0の入れ物に「上から◯%」で置いていた＝全部の点が枠のいちばん上に重なっていた
 * LPの文書の中に、LPと同じ高さの層として置けば、LPと一緒に動き、深さもLPの高さそのものになる。
 * iframe はスクリプトを動かさない（sandbox）が、同じオリジンなので外から書き込める。
 */

const LAYER_ID = 'sb-heatmap-layer'
/** 「近くで押された」とみなす距離（LPの中のpx） */
const NEAR_PX = 24

/**
 * 点ごとに「近くで押された回数」を数える（2026-09-25・指示185）。
 * 以前は全部の点が同じ薄いオレンジで、同じ所を何回も押された（ボタン）のか、1回だけなのか見分けられなかった。
 */
function nearCounts(points: readonly { px: number; py: number }[], near: number): number[] {
  return points.map((p) => points.filter((q) => (q.px - p.px) ** 2 + (q.py - p.py) ** 2 <= near * near).length)
}

/**
 * 回数の強さ 0〜1。回数は「倍」で効かせる（1→2→4→8…で一段ずつ変わる）。
 * そのまま比で割り当てると、ボタンに25回あるとき2〜6回の点がほとんど同じ青になり見分けられなかった。
 */
function countStrength(count: number, max: number): number {
  return max <= 1 ? 0 : Math.log(count) / Math.log(max)
}

/** 少ない＝青 → 多い＝赤（面の色と同じ並び） */
function countColor(count: number, max: number): string {
  return `hsl(${Math.round((1 - countStrength(count, max)) * 240)}, 90%, 50%)`
}
/** ぼかしで端が薄くならないよう、上下にこれだけ広げてから切り取る */
const BLUR_PAD = 40

export interface LpLayerSpec {
  /** 面の色（上からの割合 0〜1 と色）。null なら面を出さない */
  stops: readonly { at: number; color: string }[] | null
  /**
   * クリックの点（x・y とも 0〜1。y はページの高さに対する割合）。
   * cx（画面の真ん中から何px）があればそれで横の位置を決める（真ん中寄せのLPは、画面の幅が違っても同じ場所になる）
   */
  dots: readonly { x: number; y: number; cx?: number }[]
  /** 点の直径（LPの中のpx）。LPを縮めて見せるとき（PC）は、画面で同じ大きさに見えるよう大きくする。既定10 */
  dotSize?: number
  /** 「熟読箇所を非表示にする」で面だけ隠す */
  hideHeat: boolean
}

/**
 * LPの文書に面と点の層を置き直す（前の層は消す）。置いた層の高さ（＝LPの高さ）を返す。
 * 高さは前の層を消してから測る（層の分だけ伸びた高さで描き直し続けないため）。
 */
export function paintLpLayer(doc: Document, spec: LpLayerSpec): number {
  doc.getElementById(LAYER_ID)?.remove()
  const root = doc.documentElement
  const height = Math.max(root.scrollHeight, doc.body?.scrollHeight ?? 0)
  if ((spec.stops === null || spec.stops.length === 0) && spec.dots.length === 0) return height

  const layer = doc.createElement('div')
  layer.id = LAYER_ID
  layer.setAttribute('aria-hidden', 'true')
  layer.style.cssText =
    `position:absolute;left:0;top:0;width:100%;height:${height}px;overflow:hidden;` +
    'pointer-events:none;z-index:2147483646;margin:0;padding:0;'

  if (spec.stops !== null && spec.stops.length > 0 && !spec.hideHeat) {
    const heat = doc.createElement('div')
    // 位置は px で指定する（上下に広げた分だけずらす）。割合で書くと、広げた高さに対する割合になって深さがずれる
    const stops = spec.stops.map((s) => `${s.color} ${(BLUR_PAD + s.at * height).toFixed(1)}px`).join(',')
    heat.style.cssText =
      `position:absolute;left:0;right:0;top:-${BLUR_PAD}px;height:${height + BLUR_PAD * 2}px;` +
      `filter:blur(16px);background:linear-gradient(to bottom,${stops});`
    heat.dataset['heat'] = '1'
    layer.append(heat)
  }
  // 点の色と大きさは「近くで押された回数」で決める（少ない＝青・小さい → 多い＝赤・大きい）。多い点を上に重ねる
  const size = spec.dotSize ?? 10
  const width = root.clientWidth
  const placed = spec.dots.map((c) => ({ c, px: c.cx === undefined ? c.x * width : width / 2 + c.cx, py: c.y * height }))
  const counts = nearCounts(placed, NEAR_PX * (size / 10))
  const max = Math.max(1, ...counts)
  const order = placed.map((p, i) => ({ ...p, count: counts[i] ?? 1 })).sort((a, b) => a.count - b.count)
  for (const { c, count } of order) {
    const dot = doc.createElement('div')
    const left =
      c.cx === undefined ? `${(c.x * 100).toFixed(2)}%` : `calc(50% ${c.cx < 0 ? '-' : '+'} ${Math.abs(c.cx)}px)`
    const d = Number((size * (1 + countStrength(count, max) * 0.6)).toFixed(1))
    const half = Number((d / 2).toFixed(1))
    const ring = Number(Math.max(1, size * 0.15).toFixed(1))
    dot.style.cssText =
      `position:absolute;left:${left};top:${(c.y * height).toFixed(1)}px;` +
      `width:${d}px;height:${d}px;margin:-${half}px 0 0 -${half}px;` +
      `border-radius:50%;background:${countColor(count, max)};opacity:.9;box-shadow:0 0 0 ${ring}px rgba(255,255,255,.9);`
    dot.dataset['dot'] = '1'
    dot.dataset['count'] = String(count)
    layer.append(dot)
  }
  root.append(layer)
  return height
}

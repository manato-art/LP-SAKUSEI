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
  dotColor: string
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
  const size = spec.dotSize ?? 10
  for (const c of spec.dots) {
    const dot = doc.createElement('div')
    const left =
      c.cx === undefined ? `${(c.x * 100).toFixed(2)}%` : `calc(50% ${c.cx < 0 ? '-' : '+'} ${Math.abs(c.cx)}px)`
    dot.style.cssText =
      `position:absolute;left:${left};top:${(c.y * height).toFixed(1)}px;` +
      `width:${size}px;height:${size}px;margin:-${size / 2}px 0 0 -${size / 2}px;border-radius:50%;background:${spec.dotColor};`
    dot.dataset['dot'] = '1'
    layer.append(dot)
  }
  root.append(layer)
  return height
}

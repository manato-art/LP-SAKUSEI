/**
 * 見たまま画面で「移行先」（被せた部品の中の、押せる透明な範囲）を直す（2026-09-24・本人「範囲を自由に置く」）。
 *
 * - 斜線の枠そのものをつかんで動かすと、被せた部品の中で位置が変わる（左右と上下のまん中・端に吸い付く。
 *   Alt（Mac は option）を押しながらだと吸い付かない）
 * - 四辺のつまみで大きさ（左の辺・上の辺は、反対の辺を動かさずに広げる）
 * - 位置と大きさは被せた部品に対する %（hotspot-model.ts）。動かしている間は見た目だけ、離したら設定データへ
 */
import { dragValue, nearestSnap, snapThreshold } from './drag-math.ts'
import { HOTSPOT_MIN, clampRect, type HotspotRect } from './nocode/hotspot-model.ts'
import type { GuideLine, SelectionHandle, SelectionLayer, SelectionMove, SnapPoint } from './selection-layer.ts'

export interface HotspotEditDeps {
  readonly selection: SelectionLayer
  /** 動かしている間だけ直に当てた見た目（描き直すときに外す） */
  readonly previewed: Set<HTMLElement>
  /** 今の位置と大きさ */
  readonly rect: () => HotspotRect
  /** 離したとき（確定） */
  readonly commit: (next: Partial<HotspotRect>) => void
}

/** 被せた部品の四角（移行先の % の基準） */
const hostBox = (el: HTMLElement): DOMRect => (el.parentElement ?? el).getBoundingClientRect()

/** 四辺のつまみ（右・左＝幅、下・上＝高さ） */
export function hotspotHandles(hotspot: HTMLElement, deps: HotspotEditDeps): SelectionHandle[] {
  const el = hotspot // eslint-safe alias（no-param-reassign 回避。動かしている間は style を直に書く）
  const r = deps.rect()
  const perX = (): number => hostBox(el).width / 100 || 1
  const perY = (): number => hostBox(el).height / 100 || 1
  const show = (style: Partial<Record<'left' | 'top' | 'width' | 'height', number>>): void => {
    deps.previewed.add(el)
    for (const [key, value] of Object.entries(style)) el.style.setProperty(key, `${value}%`)
  }
  return [
    {
      kind: 'width',
      label: '幅',
      unit: '%',
      range: { min: HOTSPOT_MIN, max: 100 - r.x, step: 0.5 },
      read: () => r.w,
      pxPerUnit: perX,
      preview: (n) => show({ width: n }),
      commit: (n) => deps.commit({ w: n }),
    },
    {
      kind: 'widthLeft',
      label: '幅',
      unit: '%',
      range: { min: HOTSPOT_MIN, max: r.x + r.w, step: 0.5 },
      read: () => r.w,
      pxPerUnit: perX,
      preview: (n) => show({ width: n, left: r.x + r.w - n }),
      commit: (n) => deps.commit({ w: n, x: r.x + r.w - n }),
    },
    {
      kind: 'height',
      label: '高さ',
      unit: '%',
      range: { min: HOTSPOT_MIN, max: 100 - r.y, step: 0.5 },
      read: () => r.h,
      pxPerUnit: perY,
      preview: (n) => show({ height: n }),
      commit: (n) => deps.commit({ h: n }),
    },
    {
      kind: 'padTop',
      label: '高さ',
      unit: '%',
      range: { min: HOTSPOT_MIN, max: r.y + r.h, step: 0.5 },
      read: () => r.h,
      pxPerUnit: perY,
      preview: (n) => show({ height: n, top: r.y + r.h - n }),
      commit: (n) => deps.commit({ h: n, y: r.y + r.h - n }),
    },
  ]
}

/** 左端・まん中・右端（上端・まん中・下端）にそろう位置。edge はそろえた線の場所（被せた部品の 0・50・100%） */
const snapPoints = (size: number): (SnapPoint & { readonly edge: number })[] => [
  { value: 0, edge: 0, lines: [] },
  { value: 50 - size / 2, edge: 50, lines: [] },
  { value: 100 - size, edge: 100, lines: [] },
]

/** 枠そのものをつかんで動かす（被せた部品の中だけ） */
export function hotspotMove(hotspot: HTMLElement, deps: HotspotEditDeps): SelectionMove {
  const el = hotspot // eslint-safe alias（no-param-reassign 回避）
  let from: { rect: HotspotRect; box: DOMRect } | null = null
  let next: HotspotRect | null = null
  const finish = (): void => {
    from = null
    deps.selection.guides([])
  }
  return {
    update: ({ x, y, startX, startY, isFree }) => {
      if (from === null) from = { rect: deps.rect(), box: hostBox(el) }
      const { rect, box } = from
      const perX = box.width / 100 || 1
      const perY = box.height / 100 || 1
      const rawX = dragValue(rect.x, x - startX, perX, { min: 0, max: 100 - rect.w, step: 0.5 })
      const rawY = dragValue(rect.y, y - startY, perY, { min: 0, max: 100 - rect.h, step: 0.5 })
      const hitX = nearestSnap(rawX, snapPoints(rect.w), perX, snapThreshold(isFree))
      const hitY = nearestSnap(rawY, snapPoints(rect.h), perY, snapThreshold(isFree))
      next = clampRect({ ...rect, x: hitX?.value ?? rawX, y: hitY?.value ?? rawY })
      deps.previewed.add(el)
      el.style.left = `${next.x}%`
      el.style.top = `${next.y}%`
      // 左右でそろったら、そろえた線（被せた部品の左端・まん中・右端）をピンクの線で見せる
      const lines: GuideLine[] = hitX === null ? [] : [{ x: box.left + (hitX.edge / 100) * box.width, top: box.top, bottom: box.bottom }]
      deps.selection.guides(lines)
      return `左から ${next.x}%・上から ${next.y}%`
    },
    commit: () => {
      if (from === null || next === null) return
      finish()
      deps.commit({ x: next.x, y: next.y })
    },
    cancel: () => {
      if (from === null) return
      finish()
    },
  }
}

/**
 * 移行先だけが入っている部品に「空」の印を付ける（見たまま画面だけ。保存する中身は設定データから作るので入らない）。
 * 空の部品の案内（「画像を選んでください」の灰色の箱など）は :empty で出しているが、移行先が中に入ると空に見えなくなり、
 * 高さが無くなって移行先も見えなくなる → この印でも同じ案内を出す
 */
export function markEmptyHotspotHosts(root: HTMLElement): void {
  for (const hot of root.querySelectorAll<HTMLElement>('.nc-b-hotspot')) {
    const host = hot.parentElement
    if (host === null) continue
    const copy = host.cloneNode(true) as HTMLElement
    for (const inner of copy.querySelectorAll('.nc-b-hotspot')) inner.remove()
    if (copy.innerHTML.trim() === '') host.setAttribute('data-nc-empty', 'true')
  }
}

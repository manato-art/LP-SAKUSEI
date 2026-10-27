/**
 * ページ一覧の数字の列を横に送ったら、見出し・合計・ほかの行も同じだけ送る（2026-10-27 本人「こんな感じにリデザインしたい」で見える列が増えた）。
 * 採取物は行ごとに別々の横の送り（見出し・合計・行がそれぞれ overflow:auto）で、1つの行を送ると列がずれていた。
 */

/** 横に送れる数字の列（見出し・合計・各行） */
const KPI_SCROLLERS = '.el51yfs3, .en4zj402, .e14sgd471'

/** area の中の数字の列の横の送りをそろえる。scroll は伝わらないので、area で先に受ける（capture） */
export function syncKpiScroll(area: HTMLElement, signal: AbortSignal): void {
  area.addEventListener(
    'scroll',
    (event) => {
      const source = event.target as HTMLElement | null
      if (source === null || typeof source.matches !== 'function' || !source.matches(KPI_SCROLLERS)) return
      const left = source.scrollLeft
      for (const other of area.querySelectorAll<HTMLElement>(KPI_SCROLLERS)) {
        // 同じ位置なら動かさない（動かした側から届く scroll で行き来しない）
        if (other !== source && other.scrollLeft !== left) other.scrollLeft = left
      }
    },
    { capture: true, signal },
  )
}

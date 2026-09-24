/**
 * 「レポートに載せるもの」の選択（2026-09-15・本人の依頼）。
 *
 * タスクごとに決める。朝は全部・夕方は数字だけ、のような使い分けができる。
 * 既定は全部入り（1通で状況が分かるほうが、足りなくて画面を見に行くより良い）。
 *
 * 項目の定義そのものは `mock-server/report-items.ts` にある。
 * ここは並べ方と説明文だけを持つ。
 */
import { T, el } from '../ui.ts'
import type { ReportItemsInput } from '../api.ts'

/** 並び順と説明。上から読んで意味が通る順にする。 */
const ITEMS: readonly { key: keyof ReportItemsInput; label: string; note: string }[] = [
  { key: 'basics', label: '主要数値', note: 'PV / CLICK / CTR / CV / CVR' },
  { key: 'versions', label: 'Versionの内訳', note: 'ページの下に各案。CVRがいちばん高い案に★' },
  { key: 'heatmap', label: 'ヒートマップの要点', note: 'FV通過率・いちばん離脱が多い位置・オファー到達' },
  { key: 'compare', label: '前の期間との比較', note: '昨日のレポートなら前日比、直近7日なら前週比' },
  { key: 'cost', label: '広告費とCPA', note: '取り込んでいなければ「未取込」と出ます' },
]

export interface ReportItemsFieldResult {
  el: HTMLElement
  value: () => ReportItemsInput
}

/** `initial` は保存済みのタスクを開き直したときの値（無ければ全部入り） */
export function buildReportItemsField(initial?: ReportItemsInput): ReportItemsFieldResult {
  const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:8px' })
  const boxes = new Map<keyof ReportItemsInput, HTMLInputElement>()

  for (const item of ITEMS) {
    const row = el('label', {
      style: 'display:flex;gap:10px;align-items:flex-start;cursor:pointer;min-width:0',
    })
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.checked = initial?.[item.key] ?? true
    // 指で押せる大きさ（スマホ）。小さいと隣の項目を押してしまう
    box.style.cssText = 'width:18px;height:18px;margin-top:2px;flex-shrink:0;cursor:pointer'
    boxes.set(item.key, box)
    row.append(
      box,
      el('span', { style: 'min-width:0' }, [
        el('span', { text: item.label, style: `font-size:13px;color:${T.text}` }),
        el('span', {
          text: item.note,
          style: `display:block;font-size:11px;color:${T.sub};line-height:1.7`,
        }),
      ]),
    )
    wrap.append(row)
  }

  return {
    el: wrap,
    value: () => {
      const out = {} as ReportItemsInput
      for (const [key, box] of boxes) out[key] = box.checked
      return out
    },
  }
}

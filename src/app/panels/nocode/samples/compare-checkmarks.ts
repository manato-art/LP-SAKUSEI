/**
 * 新しい見本「◯×だけの簡易比較（6項目）」（2026-09-23）。
 *
 * 記号だけの、ひと目で分かる比較。記号は画面に出さない言葉（.nsx-sr）を添えてあるので、
 * 読み上げでは「あり」「なし」と伝わり、色が見えなくても意味が分かる。
 * 6項目 × 2列。列幅は決めず、狭い画面では文字と余白を小さくして収める。
 */
import { INK, INK_SUB, LINE, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-d0000013'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .m-wrap{max-width:560px;margin:0 auto;overflow-x:auto}` +
  `${s} .m-table{width:100%;border-collapse:collapse;font-size:13.5px;line-height:1.7}` +
  `${s} .m-table th,${s} .m-table td{padding:13px 8px;border-bottom:1px solid ${LINE_LIGHT};` +
  `text-align:center;vertical-align:middle}` +
  `${s} .m-table thead th{font-size:12.5px;font-weight:800;color:${INK_SUB};border-bottom:1px solid ${LINE}}` +
  `${s} .m-table thead th.is-mine{font-size:13px;color:${ACCENT}}` +
  `${s} .m-table tbody th{text-align:left;font-weight:700;color:${INK}}` +
  `${s} .m-mark{font-size:21px;font-weight:700;line-height:1}` +
  `${s} .m-mark--yes{color:${ACCENT}}` +
  `${s} .m-mark--no{color:#9AA3AE}` +
  `${s} .nsx-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;` +
  `clip:rect(0 0 0 0);white-space:nowrap;border:0}` +
  `${s} .m-sum{max-width:560px;margin:16px auto 0;font-size:13.5px;line-height:1.85;color:${INK_SUB}}` +
  `${s} .m-note{max-width:560px;margin:8px auto 0;font-size:12px;line-height:1.75;color:${INK_SUB}}` +
  `@media (max-width:480px){${s} .m-table{font-size:12.5px}` +
  `${s} .m-table th,${s} .m-table td{padding:11px 5px}` +
  `${s} .m-table thead th{font-size:11.5px}${s} .m-mark{font-size:19px}}`

/** 記号と、読み上げだけに伝える言葉 */
const mark = (yes: boolean): string =>
  `<td><span class="m-mark m-mark--${yes ? 'yes' : 'no'}" aria-hidden="true">${yes ? '◯' : '×'}</span>` +
  `<span class="nsx-sr">${yes ? 'あり' : 'なし'}</span></td>`

const row = (label: string, mine: boolean, other: boolean): string =>
  `<tr><th scope="row">${label}</th>${mark(mine)}${mark(other)}</tr>`

export const COMPARE_CHECKMARKS_SAMPLE: NewSample = {
  id: 'compare-checkmarks',
  category: '比較・違い',
  name: '◯×だけの簡易比較（6項目）',
  summary: '6項目を◯×だけで比べます。記号には読み上げ用の言葉を添えています',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('できること、できないこと', 'よくご質問をいただく6点を並べました。') +
      '<div class="m-wrap"><table class="m-table">' +
      '<thead><tr><th scope="col"></th><th scope="col" class="is-mine">このサービス</th>' +
      '<th scope="col">一般的なサービス</th></tr></thead><tbody>' +
      row('初期費用が0円', true, false) +
      row('月の途中で解約できる', true, false) +
      row('スマホだけで手続きできる', true, true) +
      row('土日も相談できる', true, false) +
      row('30日間の返金に対応', true, false) +
      row('ご家族の追加は無料', true, true) +
      '</tbody></table></div>' +
      '<p class="m-sum">6項目のうち、このサービスは6つに対応しています。</p>' +
      '<p class="m-note">※2026年3月時点・各社の公開情報をもとにした当社調べです。内容は変わることがあります。</p>',
  }),
}

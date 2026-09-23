/**
 * 新しい見本「かんたん比較表（自社と一般的なサービス）」（2026-09-23）。
 *
 * 5項目 × 2列。記号（◎○△×）は読み上げでも伝わるよう、画面に出さない言葉を添える（.nsx-sr）。
 * 狭い画面でも横に溢れないよう、列幅は固定せず文字を小さくして収める。
 */
import { INK, INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-cmpr0001'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .c-wrap{max-width:620px;margin:0 auto;overflow-x:auto}` +
  `${s} .c-table{width:100%;border-collapse:collapse;font-size:14px;line-height:1.7}` +
  `${s} .c-table th,${s} .c-table td{padding:13px 10px;border-bottom:1px solid ${LINE_LIGHT};text-align:center;vertical-align:middle}` +
  `${s} .c-table thead th{font-size:13px;font-weight:800;color:${INK_SUB};padding-bottom:10px}` +
  `${s} .c-table thead th.is-mine{color:${ACCENT}}` +
  `${s} .c-table tbody th{text-align:left;font-weight:700;color:${INK};min-width:8em}` +
  `${s} .c-mark{font-size:19px;font-weight:800;line-height:1}` +
  `${s} .c-mark--mine{color:${ACCENT}}` +
  `${s} .c-mark--other{color:#9AA3AE}` +
  `${s} .c-sub{display:block;margin-top:3px;font-size:11.5px;color:${INK_SUB}}` +
  `${s} .nsx-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;` +
  `clip:rect(0 0 0 0);white-space:nowrap;border:0}` +
  `${s} .c-note{max-width:620px;margin:14px auto 0;font-size:12px;line-height:1.7;color:${INK_SUB};text-align:center}` +
  `@media (max-width:480px){${s} .c-table{font-size:13px}${s} .c-table th,${s} .c-table td{padding:11px 6px}` +
  `${s} .c-table tbody th{min-width:6.5em}}`

/** 記号と、読み上げだけに伝える言葉 */
const mark = (symbol: string, said: string, kind: 'mine' | 'other', sub = ''): string =>
  `<td><span class="c-mark c-mark--${kind}" aria-hidden="true">${symbol}</span><span class="nsx-sr">${said}</span>` +
  (sub === '' ? '' : `<span class="c-sub">${sub}</span>`) +
  '</td>'

const row = (label: string, mine: readonly [string, string, string], other: readonly [string, string, string]): string =>
  `<tr><th scope="row">${label}</th>${mark(mine[0], mine[1], 'mine', mine[2])}${mark(other[0], other[1], 'other', other[2])}</tr>`

export const COMPARE_SIMPLE_SAMPLE: NewSample = {
  id: 'compare-simple',
  category: '比較・違い',
  name: 'かんたん比較表（2列・5項目）',
  summary: '自社と一般的なサービスを◎○△×で比べます。狭い画面でも読める形',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('ほかとどう違う？', '一般的なサービスと比べたところです。') +
      '<div class="c-wrap"><table class="c-table">' +
      '<thead><tr><th scope="col"></th><th scope="col" class="is-mine">このサービス</th>' +
      '<th scope="col">一般的なサービス</th></tr></thead><tbody>' +
      row('はじめる準備', ['◎', 'とても良い', '不要'], ['△', 'ふつう', '道具が必要']) +
      row('1日にかかる時間', ['◎', 'とても良い', '30秒'], ['△', 'ふつう', '15分ほど']) +
      row('月々の費用', ['○', '良い', '2,980円'], ['△', 'ふつう', '4,500円〜']) +
      row('返品・返金', ['◎', 'とても良い', '30日間'], ['×', '対応なし', 'なし']) +
      row('困ったときの相談', ['◎', 'とても良い', 'チャットで即日'], ['○', '良い', 'メールのみ']) +
      '</tbody></table></div>' +
      '<p class="c-note">※2026年3月時点の当社調べ。内容は変わることがあります。</p>',
  }),
}

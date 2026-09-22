/**
 * 型「比較表」（2026-09-22・ノーコードでWidgetを作る③）。
 *
 * 自社＋比べる相手（1〜3社）の表。各欄は ◎○△× か文字（「◎ 980円」のように記号＋文字も可）。
 * 記号は信号機の色（緑・黄・赤）にせず、形で意味を伝えて色は控えめにする（ui-forge anti-ai-look）。
 * 読み上げでは記号を言葉にする（◎→とても良い）。自社の列だけ淡い地で目立たせる（状態の出し方は1つ）。
 * 項目の行は Widget編集の「複製・上へ・下へ・消す」（②）で増やせる。
 */
import { baseCss, esc, inkOn, safeColor, shade, textHtml, titleHtml, wrapWidget } from './kit.ts'
import { ACCENT_PRESETS, items, str, type ItemData, type NocodeTemplate, type TemplateData } from './types.ts'

const MAX_OTHERS = 3
const CELL_KEYS = ['c0', 'c1', 'c2', 'c3'] as const

/** 記号 → 読み上げの言葉と色の段階（〇・✕ など似た文字もまとめる） */
const MARKS: Readonly<Record<string, { level: 1 | 2 | 3 | 4; say: string }>> = {
  '◎': { level: 1, say: 'とても良い' },
  '○': { level: 2, say: '良い' },
  '〇': { level: 2, say: '良い' },
  '△': { level: 3, say: 'ふつう' },
  '×': { level: 4, say: 'なし' },
  '✕': { level: 4, say: 'なし' },
  '✖': { level: 4, say: 'なし' },
}

function cell(value: string): string {
  const text = value.trim()
  const first = Array.from(text)[0] ?? ''
  const mark = MARKS[first]
  if (mark === undefined) return text === '' ? '<span class="nc-cmp__text">―</span>' : `<span class="nc-cmp__text">${textHtml(text)}</span>`
  const rest = text.slice(first.length).trim()
  return (
    `<span class="nc-cmp__mark nc-cmp__mark--m${mark.level}" aria-hidden="true">${esc(first)}</span>` +
    `<span class="nc-sr">${mark.say}</span>` +
    (rest === '' ? '' : `<span class="nc-cmp__text">${textHtml(rest)}</span>`)
  )
}

/** 比べる相手の名前（i番目。空なら「相手1」） */
function otherName(data: TemplateData, index: number): string {
  const name = str(items(data, 'others')[index] ?? {}, 'name').trim()
  return name === '' ? `相手${index + 1}` : name
}

function oursName(data: TemplateData): string {
  const name = str(data, 'ours').trim()
  return name === '' ? '自社' : name
}

export const COMPARE_TEMPLATE: NocodeTemplate = {
  id: 'compare',
  name: '比較表',
  summary: '自社と他社を ◎○△× と文字で比べる表。自社の列が目立ちます',
  icon:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 4v16M15 4v16"/></svg>',
  fields: [
    { kind: 'text', key: 'title', label: '見出し', placeholder: '他社との比較', note: '空にすると出しません' },
    { kind: 'text', key: 'ours', label: '自社の名前（いちばん左の列）', placeholder: '当社' },
    {
      kind: 'list',
      key: 'others',
      label: '比べる相手',
      itemLabel: '相手',
      min: 1,
      max: MAX_OTHERS,
      fields: [{ kind: 'text', key: 'name', label: '名前', placeholder: 'A社' }],
      newItem: () => ({ name: '' }),
    },
    {
      kind: 'list',
      key: 'rows',
      label: '比べる項目',
      itemLabel: '項目',
      min: 1,
      max: 12,
      fields: [
        { kind: 'text', key: 'label', label: '項目の名前', placeholder: '月々の料金' },
        { kind: 'symbols', key: 'c0', label: '自社', labelOf: oursName, symbols: ['◎', '○', '△', '×'] },
        ...[1, 2, 3].map((n) => ({
          kind: 'symbols' as const,
          key: `c${n}`,
          label: `相手${n}`,
          labelOf: (d: TemplateData) => otherName(d, n - 1),
          symbols: ['◎', '○', '△', '×'],
          showIf: (d: TemplateData) => items(d, 'others').length >= n,
        })),
      ],
      newItem: () => ({ label: '', c0: '', c1: '', c2: '', c3: '' }),
    },
    { kind: 'text', key: 'note', label: '注意書き', note: '空にすると出しません' },
    { kind: 'color', key: 'color', label: '自社の列の色', presets: ACCENT_PRESETS },
  ],
  defaults: (now) => {
    const jst = new Date(now.getTime() + 9 * 3600 * 1000)
    return {
      title: '他社との比較',
      ours: '当社',
      others: [{ name: 'A社' }, { name: 'B社' }],
      rows: [
        { label: '月々の料金', c0: '◎ 980円', c1: '△ 1,980円', c2: '○ 1,480円', c3: '' },
        { label: '送料', c0: '◎ 無料', c1: '× 660円', c2: '△ 条件つきで無料', c3: '' },
        { label: '解約のしやすさ', c0: '◎ いつでも', c1: '△ 電話のみ', c2: '× 6か月は不可', c3: '' },
        { label: 'サポート', c0: '○ チャット・電話', c1: '○ 電話', c2: '△ メールのみ', c3: '' },
      ],
      note: `※${jst.getUTCFullYear()}年${jst.getUTCMonth() + 1}月時点・当社調べ`,
      color: '#E5573F',
    }
  },
  validate: (data) => {
    if (items(data, 'others').length === 0) return '比べる相手を1つ以上入れてください'
    const rows = items(data, 'rows')
    if (rows.length === 0) return '比べる項目を1つ以上入れてください'
    if (rows.some((row) => str(row, 'label').trim() === '')) return '名前が空の項目があります。名前を書くか、その項目を消してください'
    return null
  },
  render: (data, uid) => {
    const s = `.${uid}`
    const color = safeColor(str(data, 'color'), '#E5573F')
    const columns = Math.min(MAX_OTHERS, items(data, 'others').length)
    const markDark = shade(color, -0.2)

    const css =
      baseCss(s) +
      `${s} .nc-cmp__scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}` +
      `${s} .nc-cmp__table{width:100%;${columns >= 3 ? 'min-width:520px;' : ''}border-collapse:separate;border-spacing:0;` +
      `table-layout:fixed;font-size:13.5px}` +
      `${s} .nc-cmp__table th,${s} .nc-cmp__table td{padding:12px 8px;text-align:center;vertical-align:middle;` +
      // 狭い画面で「月々の料／金」のように1文字だけ次の行へ落ちないよう、行の長さをそろえる（ui-forge text-wrap-balance-cjk-orphan）
      `border-bottom:1px solid #E3E6EA;line-height:1.5;overflow-wrap:anywhere;text-wrap:balance;word-break:auto-phrase}` +
      `${s} .nc-cmp__table thead th{font-size:14px;font-weight:800;color:#3A4452;border-bottom:2px solid #D5DAE0;padding:14px 8px}` +
      `${s} .nc-cmp__table tbody th{width:28%;text-align:left;font-weight:700;color:#3A4452;background:#F7F8FA}` +
      // 横にスクロールしても項目の名前は左に残す
      `${s} .nc-cmp__table tbody th,${s} .nc-cmp__corner{position:sticky;left:0;z-index:1}` +
      `${s} .nc-cmp__table .nc-cmp__corner{width:28%;background:#FFFFFF;border-bottom-color:transparent}` +
      `${s} .nc-cmp__table thead .nc-cmp__ours{background:${color};color:${inkOn(color)};border-radius:10px 10px 0 0;border-bottom-color:${color}}` +
      `${s} .nc-cmp__table tbody .nc-cmp__ours{background:${shade(color, 0.9)};font-weight:700}` +
      `${s} .nc-cmp__mark{display:block;font-size:22px;font-weight:700;line-height:1.2}` +
      `${s} .nc-cmp__mark--m1,${s} .nc-cmp__mark--m2{color:${markDark}}` +
      `${s} .nc-cmp__mark--m3{color:#9A7B2E}` +
      `${s} .nc-cmp__mark--m4{color:#9AA3AE}` +
      `${s} .nc-cmp__text{display:block}` +
      `${s} .nc-cmp__note{margin:10px 0 0;font-size:11.5px;line-height:1.7;color:#6B7480}` +
      // スマホの幅では余白を詰めて、1マスに入る文字を増やす
      `@media (max-width:480px){${s} .nc-cmp__table th,${s} .nc-cmp__table td{padding:10px 4px;font-size:12.5px}` +
      `${s} .nc-cmp__table tbody th{padding-left:8px}${s} .nc-cmp__mark{font-size:20px}}`

    const head =
      `<tr><th scope="col" class="nc-cmp__corner"><span class="nc-sr">項目</span></th>` +
      `<th scope="col" class="nc-cmp__ours">${esc(oursName(data))}</th>` +
      Array.from({ length: columns }, (_, i) => `<th scope="col">${esc(otherName(data, i))}</th>`).join('') +
      `</tr>`
    const row = (r: ItemData): string =>
      `<tr><th scope="row">${esc(str(r, 'label').trim())}</th>` +
      CELL_KEYS.slice(0, columns + 1)
        .map((key, i) => `<td${i === 0 ? ' class="nc-cmp__ours"' : ''}>${cell(str(r, key))}</td>`)
        .join('') +
      `</tr>`
    const note = str(data, 'note').trim()
    const body =
      titleHtml(str(data, 'title')) +
      `<div class="nc-cmp__scroll"><table class="nc-cmp__table"><thead>${head}</thead>` +
      `<tbody>${items(data, 'rows').map(row).join('')}</tbody></table></div>` +
      (note === '' ? '' : `<p class="nc-cmp__note">${esc(note)}</p>`)
    return wrapWidget({ uid, type: 'compare', css, body })
  },
}

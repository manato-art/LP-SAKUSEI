/**
 * 新しい見本「仕様表（項目と値・6行）」（2026-09-23）。
 *
 * 内容量・サイズ・お届けなど、細かい条件を6行でまとめる区画。項目名は左、値は右。
 * 狭い画面では左右に並べると値が潰れるので、項目名の下に値を置く形へ組み替える。
 */
import { INK, INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-b0000008'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .st-wrap{max-width:620px;margin:0 auto}` +
  `${s} .st-table{width:100%;border-collapse:collapse;border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .st-table th{width:34%;padding:14px 16px 14px 0;border-bottom:1px solid ${LINE_LIGHT};` +
  `text-align:left;vertical-align:top;font-size:14px;font-weight:800;line-height:1.75;color:${INK}}` +
  `${s} .st-table td{padding:14px 0;border-bottom:1px solid ${LINE_LIGHT};` +
  `text-align:right;vertical-align:top;font-size:14.5px;line-height:1.8;color:${INK_SUB}}` +
  `${s} .st-strong{color:${ACCENT};font-weight:800}` +
  `${s} .st-note{max-width:620px;margin:16px auto 0;font-size:12px;line-height:1.7;color:${INK_SUB};text-align:center}` +
  `@media (max-width:480px){${s} .st-table th,${s} .st-table td{display:block;width:auto;text-align:left}` +
  `${s} .st-table th{padding:13px 0 2px;border-bottom:0;font-size:12.5px;letter-spacing:.06em;color:${INK_SUB}}` +
  `${s} .st-table td{padding:0 0 13px;font-size:14.5px;color:${INK}}}`

const row = (label: string, value: string): string =>
  `<tr><th scope="row">${label}</th><td>${value}</td></tr>`

export const FEATURE_SPEC_TABLE_SAMPLE: NewSample = {
  id: 'feature-spec-table',
  category: '特徴・価値',
  name: '仕様表（項目と値・6行）',
  summary: '項目名と値を6行で。狭い画面では上下に積んで読めるようにします',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('仕様とお届けについて', 'お申し込みの前に、こちらもご確認ください。') +
      '<div class="st-wrap"><table class="st-table"><tbody>' +
      row('内容量', '30日分（1袋・150g）') +
      row('大きさ', '幅12cm × 奥行8cm × 高さ20cm') +
      row('生産', '国内の自社工場で製造しています') +
      row('お届け', 'ご注文の翌営業日に発送・3日以内にお届け') +
      row('返品', '<span class="st-strong">到着から30日以内</span>・返送料は当社が負担') +
      row('販売元', '株式会社サンプル（東京都〇〇区）') +
      '</tbody></table></div>' +
      '<p class="st-note">※価格はすべて税込みです。仕様は改良のため変わることがあります（2026年3月時点）。</p>',
  }),
}

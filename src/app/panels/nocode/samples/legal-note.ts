/**
 * 新しい見本「注意書き（小さな文字）」（2026-09-23）。
 *
 * 広告審査で見られる「打ち消し表示」。小さすぎて読めないと指摘されるので、
 * 本文より1段小さいだけ（12px）にとどめ、行間を広くとる。
 */
import { INK_SUB, LINE_LIGHT, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-i0000002'
const s = `.${UID}`

const CSS =
  `${s}{padding:22px 16px}` +
  `${s} .ln-box{max-width:620px;margin:0 auto;padding-top:16px;border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .ln-head{font-size:12.5px;font-weight:800;line-height:1.7;margin:0 0 6px}` +
  `${s} .ln-item{font-size:12px;line-height:1.9;color:${INK_SUB};padding-left:1.1em;text-indent:-1.1em}` +
  `${s} .ln-item+.ln-item{margin-top:3px}`

const note = (text: string): string => `<p class="ln-item">※ ${text}</p>`

export const LEGAL_NOTE_SAMPLE: NewSample = {
  id: 'legal-note',
  category: 'フッター・注意書き',
  name: '注意書き（打ち消し表示）',
  summary: '価格や条件の但し書きをまとめて。小さすぎない大きさ（12px）で読めるように',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      '<div class="ln-box"><p class="ln-head">ご購入の前にお読みください</p>' +
      note('表示価格はすべて税込みです。送料は無料です。') +
      note('初回半額は、はじめてご利用の方お一人につき1回までです。') +
      note('定期便は2回目以降、通常価格でのお届けとなります。') +
      note('返品は商品到着後30日以内、未開封のものに限ります。') +
      note('キャンペーンは予告なく終了する場合があります。') +
      '</div>',
  }),
}

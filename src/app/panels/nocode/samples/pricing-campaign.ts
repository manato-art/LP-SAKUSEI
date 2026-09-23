/**
 * 新しい見本「キャンペーン価格」（2026-09-23）。
 *
 * 期間と条件を先に出してから、通常価格・割引額・お支払い額を上から下へ「引き算の段」で見せる。
 * 大きな数字は最後の1つだけにして、いくら払うのかを迷わせない。
 */
import { INK, INK_SUB, LINE, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-e0000005'
const ACCENT = '#C0392B'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  // 期間の帯（濃い地に白文字。ここだけ色を使い、下の計算は文字の大きさで見せる）
  `${s} .p-term{max-width:520px;margin:0 auto 22px;padding:11px 16px;border-radius:10px;background:${ACCENT};` +
  `color:#FFFFFF;text-align:center}` +
  `${s} .p-term__label{font-size:11.5px;font-weight:800;letter-spacing:.08em;opacity:.9}` +
  `${s} .p-term__date{font-size:15px;font-weight:800;line-height:1.6;font-variant-numeric:tabular-nums;margin-top:1px}` +
  // 引き算の段
  `${s} .p-calc{max-width:520px;margin:0 auto}` +
  `${s} .p-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:11px 2px;` +
  `border-bottom:1px solid ${LINE_LIGHT}}` +
  `${s} .p-label{font-size:14px;line-height:1.7;color:${INK_SUB};min-width:0}` +
  `${s} .p-num{flex:0 0 auto;font-size:17px;font-weight:800;line-height:1.5;color:${INK};` +
  `font-variant-numeric:tabular-nums;letter-spacing:-.01em}` +
  `${s} .p-num--off{color:${ACCENT}}` +
  `${s} .p-row--total{align-items:flex-end;padding:14px 2px 0;border-bottom:0;border-top:2px solid ${LINE}}` +
  `${s} .p-label--total{font-size:14.5px;font-weight:800;color:${INK}}` +
  `${s} .p-total{flex:0 0 auto;display:flex;align-items:baseline;gap:2px;font-size:40px;font-weight:800;` +
  `line-height:1.1;color:${ACCENT};letter-spacing:-.03em;font-variant-numeric:tabular-nums}` +
  `${s} .p-yen{font-size:16px;font-weight:800;letter-spacing:normal;color:${INK}}` +
  // 条件（印は細い横棒だけ。箱にしない）
  `${s} .p-cond{max-width:520px;margin:22px auto 0}` +
  `${s} .p-cond__head{font-size:13px;font-weight:800;line-height:1.6;color:${INK};margin:0 0 6px}` +
  `${s} .p-cond li{position:relative;padding:3px 0 3px 16px;font-size:13.5px;line-height:1.8;color:${INK_SUB}}` +
  `${s} .p-cond li::before{content:"";position:absolute;left:0;top:15px;width:9px;height:1.5px;background:${ACCENT}}` +
  `${s} .p-note{max-width:520px;margin:16px auto 0;font-size:12px;line-height:1.8;color:${INK_SUB}}` +
  `@media (max-width:480px){${s} .p-total{font-size:34px}${s} .p-label{font-size:13.5px}${s} .p-num{font-size:16px}}`

const cond = (text: string): string => `<li>${text}</li>`

export const PRICING_CAMPAIGN_SAMPLE: NewSample = {
  id: 'pricing-campaign',
  category: '料金・プラン',
  name: 'キャンペーン価格（期間と条件つき）',
  summary: '通常価格・割引額・お支払い額を上から下へ。期間と条件も一緒に出します',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('春のキャンペーン価格', '期間中にお申し込みいただいた方が対象です。') +
      '<div class="p-term"><p class="p-term__label">お申し込み期間</p>' +
      '<p class="p-term__date">2026年3月1日（日）〜3月31日（火）23時59分</p></div>' +
      '<div class="p-calc">' +
      '<div class="p-row"><span class="p-label">通常価格（税込）</span><span class="p-num">12,800円</span></div>' +
      '<div class="p-row"><span class="p-label">キャンペーン割引</span>' +
      '<span class="p-num p-num--off">−4,800円</span></div>' +
      '<div class="p-row p-row--total"><span class="p-label p-label--total">期間中のお支払い額</span>' +
      '<span class="p-total">8,000<span class="p-yen">円（税込）</span></span></div>' +
      '</div>' +
      '<div class="p-cond"><p class="p-cond__head">ご利用の条件</p><ul>' +
      cond('はじめてお申し込みになる方が対象です。') +
      cond('1世帯につき1回までご利用いただけます。') +
      cond('ほかの割引・クーポンとの併用はできません。') +
      '</ul></div>' +
      '<p class="p-note">※金額はすべて税込みです。※期間を過ぎたお申し込みは、通常価格でのご案内となります。' +
      '※2026年3月時点のご案内です。</p>',
  }),
}

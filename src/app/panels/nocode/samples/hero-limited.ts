/**
 * 新しい見本「期間限定の帯つき見出し」（2026-09-23）。
 *
 * いちばん上に細い帯（◯月◯日まで）を左右いっぱいに敷き、その下に見出しとボタンを置く冒頭。
 * 帯は土台の余白を打ち消して端まで伸ばす（margin を横だけ外へ出す）。
 * 急かす言い方はせず、期限と条件を事実として書く。
 */
import { INK_SUB, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-a0000006'
const ACCENT = '#E5573F'
const ACCENT_EDGE = '#B83A26'
const s = `.${UID}`

const CSS =
  `${s}{padding:0 16px 32px;text-align:center}` +
  `${s} .f-band{margin:0 -16px 26px;padding:11px 14px;background:${ACCENT};color:#FFFFFF;` +
  `font-size:13.5px;font-weight:800;line-height:1.65;letter-spacing:.02em}` +
  `${s} .f-band b{font-size:15.5px;font-weight:800;font-variant-numeric:tabular-nums}` +
  `${s} .f-title{font-size:27px;font-weight:800;line-height:1.45;letter-spacing:-.01em;margin:0 0 12px;` +
  `text-wrap:balance}` +
  `${s} .f-lead{max-width:560px;margin:0 auto 22px;font-size:15px;line-height:1.9;color:${INK_SUB}}` +
  `${s} .f-btn{display:block;width:100%;max-width:440px;margin:0 auto;min-height:62px;padding:18px 22px;` +
  `border-radius:12px;background:${ACCENT};color:#FFFFFF;font:800 17px/1.5 inherit;text-decoration:none;` +
  `box-shadow:0 5px 0 ${ACCENT_EDGE};transition:transform .14s ease,box-shadow .14s ease}` +
  `${s} .f-btn:active{transform:translateY(4px);box-shadow:0 1px 0 ${ACCENT_EDGE}}` +
  `${s} .f-btn:focus-visible{outline:3px solid ${ACCENT_EDGE};outline-offset:4px}` +
  `${s} .f-note{max-width:440px;margin:12px auto 0;font-size:12px;line-height:1.75;color:${INK_SUB}}` +
  `@media (max-width:480px){${s} .f-band{font-size:12.5px;padding:10px 12px;margin-bottom:22px}` +
  `${s} .f-title{font-size:22px}${s} .f-lead{font-size:14px}${s} .f-btn{font-size:16px}}` +
  `@media (prefers-reduced-motion:reduce){${s} .f-btn{transition:none}}`

export const HERO_LIMITED_SAMPLE: NewSample = {
  id: 'hero-limited',
  category: '冒頭・つかみ',
  name: '期間限定の帯つき見出し',
  summary: '端まで伸びる細い帯に期限を書き、その下に見出しとボタンを置きます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      '<p class="f-band">3月31日（火）まで｜初期費用 <b>30,000円</b> が 0円</p>' +
      '<h1 class="f-title">新年度の準備は、3月のうちに終わらせませんか</h1>' +
      '<p class="f-lead">お申し込みから最短3営業日でお使いいただけます。' +
      '4月以降のお申し込みには、初期費用30,000円（税込）をいただきます。</p>' +
      '<a class="f-btn" href="ooooo">3月中に申し込む</a>' +
      '<p class="f-note">※先着50社。予定数に達したときは、期間の途中でも受付を終了します。</p>',
  }),
}

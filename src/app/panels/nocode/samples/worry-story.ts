/**
 * 新しい見本「短い体験談（共感の導入）」（2026-09-23）。
 *
 * 「私も同じでした」と切り出し、4段落で当時のことを話す区画。売り込みの前に置く。
 * 飾りは引用の縦線1本だけ。面の色も囲みも使わない（写真も名前も出さずに読ませる）。
 */
import { INK_SUB, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-a0000011'
const ACCENT = '#1F2A37'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .k-quote{max-width:600px;margin:0 auto;padding:2px 0 2px 20px;border-left:2px solid ${ACCENT}}` +
  `${s} .k-lead{font-size:17px;font-weight:800;line-height:1.85;margin:0 0 14px}` +
  `${s} .k-p{font-size:15px;line-height:2;margin:0 0 14px}` +
  `${s} .k-p:last-child{margin-bottom:0}` +
  `${s} .k-who{max-width:600px;margin:16px auto 0;padding-left:22px;font-size:12.5px;line-height:1.75;` +
  `color:${INK_SUB}}` +
  `@media (max-width:480px){${s} .k-quote{padding-left:16px}${s} .k-lead{font-size:15.5px}` +
  `${s} .k-p{font-size:14.5px;line-height:1.95}${s} .k-who{padding-left:18px}}`

export const WORRY_STORY_SAMPLE: NewSample = {
  id: 'worry-story',
  category: '悩み・共感',
  name: '短い体験談（共感の導入）',
  summary: '「私も同じでした」型の短い話を4段落。縦線1本だけで見せます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('「私も、同じでした」', 'いまお使いの方から、はじめる前のお話をうかがいました。') +
      '<blockquote class="k-quote">' +
      '<p class="k-lead">毎月末になると、同じことを考えていました。今月も、また終わらないと。</p>' +
      '<p class="k-p">以前は取引先ごとにファイルを分けて持っていました。1社ずつ開いて金額を直し、' +
      '印刷して封をする。30件で丸1日、多い月は休日に出てきて作業していました。</p>' +
      '<p class="k-p">やり方を変えたのは、送り先を1件まちがえた日です。お詫びにうかがって、' +
      '帰りの電車の中で、このままではいけないと思いました。</p>' +
      '<p class="k-p">いまは、前の月の内容を引き継いで30分で終わります。特別なことはしていません。' +
      '入力する場所を1つにまとめただけです。</p>' +
      '</blockquote>' +
      '<p class="k-who">経理ご担当・40代（従業員18名の会社／2025年からご利用）</p>',
  }),
}

/**
 * 新しい見本「お客様の声（引用符・2件）」（2026-09-23）。
 *
 * 大きな鍵括弧を左の余白に置き、1件ずつじっくり読ませる区画。
 * 箱で囲まず、2件目は細い線1本で区切るだけにして、同じカードの反復に見えないようにした。
 * 名前と属性は本文よりはっきり小さくして、声そのものを主役にしている。
 */
import { INK, INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-d0000001'
const ACCENT = '#8A6A2F'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .q-list{max-width:620px;margin:0 auto}` +
  `${s} .q-item{display:grid;grid-template-columns:30px minmax(0,1fr);gap:0 10px;align-items:start}` +
  `${s} .q-item+.q-item{margin-top:26px;padding-top:26px;border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .q-mark{font-size:30px;font-weight:700;line-height:1.2;color:${ACCENT}}` +
  `${s} blockquote,${s} figcaption,${s} .q-body{grid-column:2;margin:0}` +
  `${s} blockquote{font-size:16.5px;font-weight:800;line-height:1.85;color:${INK}}` +
  `${s} .q-body{margin-top:8px;font-size:14.5px;line-height:1.9;color:${INK_SUB}}` +
  `${s} figcaption{margin-top:12px;font-size:12.5px;line-height:1.7;color:${INK_SUB}}` +
  `${s} .q-note{max-width:620px;margin:20px auto 0;font-size:12px;line-height:1.7;color:${INK_SUB};text-align:center}` +
  `@media (max-width:480px){${s} .q-item{grid-template-columns:24px minmax(0,1fr);gap:0 8px}` +
  `${s} .q-mark{font-size:26px}${s} blockquote{font-size:15.5px}${s} .q-body{font-size:14px}}`

const voice = (quote: string, body: string, who: string): string =>
  '<figure class="q-item"><span class="q-mark" aria-hidden="true">「</span>' +
  `<blockquote>${quote}</blockquote><p class="q-body">${body}</p>` +
  `<figcaption>${who}</figcaption></figure>`

export const VOICES_QUOTE_SAMPLE: NewSample = {
  id: 'voices-quote',
  category: '信頼・実績',
  name: 'お客様の声（引用符・2件）',
  summary: '大きな鍵括弧でひとことを見せ、その下に本文とお名前を置きます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('使っている方の、ひとこと', 'お申し込みのきっかけと、いま感じていることをうかがいました。') +
      '<div class="q-list">' +
      voice(
        '予約の電話をしなくていいのが、いちばん助かっています。',
        '仕事帰りの遅い時間でも申し込めるので、4か月つづけられました。前に使っていたものは手順が多くて、2週間でやめてしまいました。',
        '30代・女性／ご利用4か月',
      ) +
      voice(
        '説明を読まなくても分かるので、70代の母もひとりで使えています。',
        '家族3人で使っても月々の費用は変わらないと聞いて決めました。いまは離れて暮らす母と、同じ画面を見ながら話しています。',
        '40代・男性／ご利用1年2か月',
      ) +
      '</div>' +
      '<p class="q-note">※個人の感想です。効果や成果を保証するものではありません。</p>',
  }),
}

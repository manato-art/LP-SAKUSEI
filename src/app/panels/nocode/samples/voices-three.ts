/**
 * 新しい見本「お客様の声（3件）」（2026-09-23）。
 *
 * 星・ひとこと・本文・名前。箱で囲まず、細い線で区切る。写真は使わない（仮の顔写真は嘘っぽくなる）。
 */
import { INK, INK_SUB, LINE_LIGHT, STAR, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-voic0001'
const ACCENT = '#F2A516'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .v-list{max-width:620px;margin:0 auto;border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .v-item{padding:20px 2px;border-bottom:1px solid ${LINE_LIGHT}}` +
  `${s} .v-stars{display:flex;gap:2px;margin:0 0 8px;color:${ACCENT}}` +
  `${s} .v-stars svg{width:16px;height:16px;display:block}` +
  `${s} .v-head{font-size:16px;font-weight:800;line-height:1.6;margin:0 0 6px;color:${INK}}` +
  `${s} .v-text{font-size:14.5px;line-height:1.95;color:${INK_SUB}}` +
  `${s} .v-who{margin:10px 0 0;font-size:12.5px;line-height:1.7;color:${INK_SUB}}` +
  `${s} .v-note{max-width:620px;margin:16px auto 0;font-size:12px;line-height:1.7;color:${INK_SUB};text-align:center}` +
  `@media (max-width:480px){${s} .v-head{font-size:15.5px}${s} .v-text{font-size:14px}}`

const stars = (n: number): string => `<p class="v-stars">${STAR.repeat(n)}</p>`

const voice = (rating: number, title: string, text: string, who: string): string =>
  `<div class="v-item">${stars(rating)}<h3 class="v-head">${title}</h3><p class="v-text">${text}</p>` +
  `<p class="v-who">${who}</p></div>`

export const VOICES_THREE_SAMPLE: NewSample = {
  id: 'voices-three',
  name: 'お客様の声（3件）',
  summary: '星・ひとこと・本文・お名前。箱で囲まず、細い線で区切って読ませます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('使っている方の声', '実際にお使いいただいた方から届いた声です。') +
      '<div class="v-list">' +
      voice(5, '面倒くさがりでも続いています', '準備がいらないので、気づいたら1か月続いていました。前に挫折した自分でも大丈夫でした。', '30代・女性／利用3か月') +
      voice(5, '家族にも勧めました', '説明を読まなくても分かるのが良いです。離れて暮らす母にも同じものを送りました。', '40代・男性／利用6か月') +
      voice(4, '思ったより静かでした', '夜に使っても家族が気になりません。置き場所に困らない大きさなのも助かります。', '50代・女性／利用1か月') +
      '</div>' +
      '<p class="v-note">※個人の感想です。効果を保証するものではありません。</p>',
  }),
}

/**
 * 新しい見本「写真つきの声（2件）」（2026-09-23）。
 *
 * 丸い仮画像・星・本文を横に並べる区画。写真を差し替えるだけで使えるようにしてある。
 * 箱では囲まず、上下の細い線だけで区切って、同じカードの反復に見えないようにした。
 */
import { INK, INK_SUB, IMAGE_PLACEHOLDER, LINE_LIGHT, STAR, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-d0000002'
const ACCENT = '#E09612'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .f-list{max-width:620px;margin:0 auto;border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .f-item{display:grid;grid-template-columns:64px minmax(0,1fr);gap:16px;align-items:start;` +
  `padding:22px 2px;border-bottom:1px solid ${LINE_LIGHT}}` +
  `${s} .f-face{width:64px;height:64px;border-radius:50%;object-fit:cover;background:#F1F3F5}` +
  `${s} .f-body{min-width:0}` +
  `${s} .f-stars{display:flex;gap:2px;margin:0 0 7px;color:${ACCENT}}` +
  `${s} .f-stars svg{width:15px;height:15px;display:block}` +
  `${s} .f-head{font-size:16.5px;font-weight:800;line-height:1.6;margin:0 0 6px;color:${INK}}` +
  `${s} .f-text{font-size:14.5px;line-height:1.9;color:${INK_SUB}}` +
  `${s} .f-who{margin:10px 0 0;font-size:12.5px;line-height:1.7;color:${INK_SUB}}` +
  `${s} .f-note{max-width:620px;margin:18px auto 0;font-size:12px;line-height:1.7;color:${INK_SUB};text-align:center}` +
  `@media (max-width:480px){${s} .f-item{grid-template-columns:52px minmax(0,1fr);gap:12px}` +
  `${s} .f-face{width:52px;height:52px}${s} .f-head{font-size:15.5px}${s} .f-text{font-size:14px}}`

const voice = (rating: number, alt: string, title: string, text: string, who: string): string =>
  `<li class="f-item"><img class="f-face" src="${IMAGE_PLACEHOLDER}" alt="${alt}">` +
  `<div class="f-body"><p class="f-stars">${STAR.repeat(rating)}</p>` +
  `<h3 class="f-head">${title}</h3><p class="f-text">${text}</p><p class="f-who">${who}</p></div></li>`

export const VOICES_PHOTO_SAMPLE: NewSample = {
  id: 'voices-photo',
  category: '信頼・実績',
  name: '写真つきの声（2件）',
  summary: '丸い写真・星・本文を横に並べます。箱では囲まず線で区切ります',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('お写真とあわせて、ご紹介します', '掲載の許可をいただいた方の声です。') +
      '<ul class="f-list">' +
      voice(
        5,
        'ご利用者さまのお写真',
        '朝の支度が10分みじかくなりました',
        '前は前の晩に準備していましたが、いまは起きてから3分で終わります。子どもを送り出す時間に余裕ができました。',
        'サンプル県・30代・女性／ご利用5か月',
      ) +
      voice(
        4,
        'ご利用者さまのお写真',
        '月々の出費が1,500円ほど減りました',
        '似たものを2つ契約していたのを、こちらにまとめました。手続きは画面の案内どおりに進めるだけで、15分で終わりました。',
        'サンプル県・50代・男性／ご利用8か月',
      ) +
      '</ul>' +
      '<p class="f-note">※個人の感想です。効果や成果を保証するものではありません。</p>',
  }),
}

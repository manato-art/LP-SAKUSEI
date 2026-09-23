/**
 * 新しい見本「人物紹介（丸い写真）」（2026-09-23）。
 *
 * 作った人・支える人の顔を見せる区画。写真は丸く切り抜いて2名並べる。
 * 狭い画面では写真を左・文章を右の横並びに変えて、縦に長くなりすぎないようにする。
 */
import { IMAGE_PLACEHOLDER, INK_SUB, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-c0000012'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .r-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px;max-width:640px;margin:0 auto}` +
  `${s} .r-item{text-align:center}` +
  `${s} .r-photo{width:104px;height:104px;border-radius:50%;object-fit:cover;margin:0 auto 12px}` +
  `${s} .r-role{display:block;margin:0 0 3px;font-size:12px;font-weight:800;letter-spacing:.04em;color:${ACCENT}}` +
  `${s} .r-name{font-size:16.5px;font-weight:800;line-height:1.5;margin:0 0 8px}` +
  `${s} .r-text{font-size:14px;line-height:1.9;color:${INK_SUB}}` +
  // 狭い画面は写真を左、文章を右へ
  `@media (max-width:480px){${s} .r-grid{grid-template-columns:minmax(0,1fr);gap:22px}` +
  `${s} .r-item{display:grid;grid-template-columns:72px minmax(0,1fr);gap:14px;align-items:start;text-align:left}` +
  `${s} .r-photo{width:72px;height:72px;margin:0}${s} .r-name{font-size:15.5px}${s} .r-text{font-size:13.5px}}`

const person = (role: string, name: string, text: string, alt: string): string =>
  `<div class="r-item"><img class="r-photo" src="${IMAGE_PLACEHOLDER}" alt="${alt}">` +
  `<div class="r-body"><span class="r-role">${role}</span><p class="r-name">${name}</p>` +
  `<p class="r-text">${text}</p></div></div>`

export const PROFILE_ROUND_SAMPLE: NewSample = {
  id: 'profile-round',
  category: '画像・動画',
  name: '人物紹介（丸い写真）',
  summary: '丸く切り抜いた写真と名前・肩書き・2行の紹介を2名ぶん並べます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('つくっている人たち', '顔の見える少人数で、企画から発送までを担当しています。') +
      '<div class="r-grid">' +
      person(
        '株式会社サンプル 代表',
        '山田 太郎',
        '前職では店舗の売り場づくりを10年担当していました。使う場面から逆算して形を決めています。',
        '代表の顔写真',
      ) +
      person(
        'サポート担当',
        '佐藤 花子',
        'お問い合わせの返信を担当しています。平日は当日中、土日にいただいた分は翌営業日にお返しします。',
        'サポート担当の顔写真',
      ) +
      '</div>',
  }),
}

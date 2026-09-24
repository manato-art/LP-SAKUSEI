/**
 * 新しい見本「写真の上に見出し（背景敷き）」（2026-09-23）。
 *
 * 仮の写真を敷き、上から暗い重ねをかけて白い文字を読ませる冒頭。
 * 写真は `<img>` のままなので、入れた人が「画像を変える」でそのまま差し替えられる。
 * ボタンは写真の下（白地）に置き、押すところをはっきりさせる。
 */
import { ARROW_RIGHT_LABEL, IMAGE_PLACEHOLDER, INK_SUB, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-a0000002'
const ACCENT = '#E5573F'
const ACCENT_EDGE = '#B83A26'
const s = `.${UID}`

const CSS =
  `${s}{padding:24px 16px 30px;text-align:center}` +
  `${s} .b-stage{position:relative;display:flex;align-items:flex-end;min-height:340px;margin:0;` +
  `border-radius:14px;overflow:hidden;background:#EDEDED}` +
  `${s} .b-photo{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover}` +
  `${s} .b-veil{position:absolute;top:0;left:0;width:100%;height:100%;` +
  `background:linear-gradient(180deg,rgba(15,20,26,.18) 0%,rgba(15,20,26,.76) 76%)}` +
  `${s} .b-body{position:relative;width:100%;padding:28px 22px 26px;text-align:left;color:#FFFFFF}` +
  `${s} .b-eyebrow{display:inline-block;margin:0 0 10px;padding:4px 10px;background:${ACCENT};` +
  `font-size:12px;font-weight:800;letter-spacing:.04em;line-height:1.6}` +
  `${s} .b-title{font-size:27px;font-weight:800;line-height:1.45;margin:0 0 10px;` +
  `text-shadow:0 1px 14px rgba(0,0,0,.45)}` +
  `${s} .b-lead{font-size:14.5px;line-height:1.85;margin:0;color:#EEF1F4}` +
  `${s} .b-btn{display:flex;width:100%;max-width:440px;margin:20px auto 0;align-items:center;` +
  `justify-content:center;gap:10px;min-height:62px;padding:16px 22px;border-radius:12px;background:${ACCENT};` +
  `color:#FFFFFF;font-weight:800;font-size:17px;line-height:1.4;font-family:inherit;text-decoration:none;box-shadow:0 5px 0 ${ACCENT_EDGE};` +
  `transition:transform .14s ease,box-shadow .14s ease}` +
  `${s} .b-btn:active{transform:translateY(4px);box-shadow:0 1px 0 ${ACCENT_EDGE}}` +
  `${s} .b-btn:focus-visible{outline:3px solid ${ACCENT_EDGE};outline-offset:4px}` +
  `${s} .b-btn svg{flex:0 0 18px;width:18px;height:18px}` +
  `${s} .b-note{margin:12px 0 0;font-size:12px;line-height:1.75;color:${INK_SUB}}` +
  `@media (max-width:480px){${s} .b-stage{min-height:288px}${s} .b-body{padding:22px 16px 20px}` +
  `${s} .b-title{font-size:22px}${s} .b-lead{font-size:13.5px}}` +
  `@media (prefers-reduced-motion:reduce){${s} .b-btn{transition:none}}`

export const HERO_IMAGE_BG_SAMPLE: NewSample = {
  id: 'hero-image-bg',
  category: '冒頭・つかみ',
  name: '写真の上に見出し（背景敷き）',
  summary: '写真を敷き、暗い重ねの上に白い文字。下にボタンを1つ置いた冒頭',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      '<figure class="b-stage">' +
      `<img class="b-photo" src="${IMAGE_PLACEHOLDER}" alt="現場でお使いいただいているところ">` +
      '<span class="b-veil" aria-hidden="true"></span>' +
      '<figcaption class="b-body">' +
      '<p class="b-eyebrow">建設・設備の現場向け</p>' +
      '<h1 class="b-title">現場で撮った写真が、そのまま報告書になります</h1>' +
      '<p class="b-lead">写真を選んで送るだけ。事務所に戻ってからの清書は、もういりません。</p>' +
      '</figcaption></figure>' +
      `<a class="b-btn" href="ooooo"><span>14日間ためしてみる</span>${ARROW_RIGHT_LABEL}</a>` +
      '<p class="b-note">※写真はイメージです。お試しの間、クレジットカードの登録はいりません。</p>',
  }),
}

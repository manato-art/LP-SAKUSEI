/**
 * 新しい見本「おすすめ度（0〜10）＋お礼」（2026-09-23）。
 *
 * 「人にすすめたいと思うか」を0〜10で聞く形。広い画面では11個を1行に並べ、
 * 狭い画面では6個ずつ折り返して、1つ52px以上の押しやすい大きさを保つ。
 * 押すとそのままお礼の画面へ切り替わる。リンク先は仮（入れた人がWidget編集で入れる）。
 */
import { SCREENS_SCRIPT } from '../templates/builder.ts'
import { CHEVRON_RIGHT, INK, INK_SUB, LINE, sampleHtml, screen, type NewSample } from './kit.ts'

const UID = 'nc-g0000007'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  // 設問
  `${s} .p-ask{font-size:21px;font-weight:800;line-height:1.55;max-width:560px;margin:0 auto 6px}` +
  `${s} .p-note{font-size:13px;line-height:1.7;color:${INK_SUB};max-width:560px;margin:0 auto 20px}` +
  // 0〜10（広い画面は11個を1行、狭い画面は6個ずつ折り返す）
  `${s} .p-scale{display:grid;grid-template-columns:repeat(11,1fr);gap:6px;max-width:560px;margin:0 auto}` +
  `${s} .p-num{display:flex;align-items:center;justify-content:center;min-height:52px;padding:6px 2px;` +
  `border:1.5px solid ${LINE};border-radius:8px;background:#FFFFFF;color:${INK};` +
  `font-weight:800;font-size:16px;line-height:1.2;font-family:inherit;font-variant-numeric:tabular-nums;cursor:pointer;` +
  `-webkit-tap-highlight-color:transparent;transition:border-color .12s ease,background .12s ease,color .12s ease}` +
  `${s} .p-num:hover{border-color:${ACCENT};background:#F5F9FF;color:${ACCENT}}` +
  `${s} .p-num:active{transform:translateY(1px)}` +
  `${s} .p-num:focus-visible{outline:3px solid ${ACCENT};outline-offset:2px}` +
  // 両端の言葉
  `${s} .p-ends{display:flex;justify-content:space-between;gap:12px;max-width:560px;margin:10px auto 0;` +
  `font-size:12px;line-height:1.6;color:${INK_SUB}}` +
  `${s} .p-ends span{flex:0 1 auto}` +
  // お礼の画面
  `${s} .p-done{font-size:21px;font-weight:800;line-height:1.5;text-align:center;margin:0 0 10px}` +
  `${s} .p-done-note{font-size:14.5px;line-height:1.85;color:${INK_SUB};text-align:center;` +
  `max-width:520px;margin:0 auto 22px}` +
  `${s} .p-cta{display:flex;width:100%;max-width:520px;margin:0 auto;align-items:center;justify-content:center;` +
  `gap:10px;min-height:60px;padding:16px 24px;border-radius:10px;background:${ACCENT};color:#FFFFFF;` +
  `font-weight:800;font-size:18px;line-height:1.4;font-family:inherit;text-decoration:none;box-shadow:0 4px 0 #185FB0;` +
  `transition:transform .12s ease,box-shadow .12s ease}` +
  `${s} .p-cta:active{transform:translateY(3px);box-shadow:0 1px 0 #185FB0}` +
  `${s} .p-cta:focus-visible{outline:3px solid #14508F;outline-offset:3px}` +
  `${s} .p-cta svg{flex:0 0 18px;width:18px;height:18px}` +
  `${s} .p-fine{margin:14px 0 0;font-size:12.5px;line-height:1.7;color:${INK_SUB};text-align:center}` +
  `@media (max-width:560px){${s} .p-scale{grid-template-columns:repeat(6,1fr)}}` +
  `@media (max-width:480px){${s} .p-ask{font-size:19px}${s} .p-num{font-size:15.5px}${s} .p-done{font-size:19px}}` +
  `@media (prefers-reduced-motion:reduce){${s} .p-num,${s} .p-cta{transition:none}}`

/** 0〜10のボタン（押すとお礼の画面へ） */
const scale = (go: string): string =>
  '<div class="p-scale">' +
  Array.from({ length: 11 }, (_, n) => `<button type="button" class="p-num" data-nc-go="${go}">${n}</button>`).join('') +
  '</div>'

export const SURVEY_NPS_SAMPLE: NewSample = {
  id: 'survey-nps',
  category: 'アンケート・診断',
  name: 'おすすめ度（0〜10）＋お礼',
  summary: '「人にすすめたいか」を0〜10で聞きます。狭い画面では折り返します',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    screens: { transition: 'fade', script: SCREENS_SCRIPT },
    body:
      screen(
        's1',
        '設問①',
        '<h2 class="p-ask">この内容を、ご友人や同僚にすすめたいと思いますか？</h2>' +
          '<p class="p-note">0から10までの数字で、近いものを1つ選んでください。10秒ほどで終わります。</p>' +
          scale('s2') +
          '<p class="p-ends"><span>0：すすめたいと思わない</span><span>10：とてもすすめたい</span></p>',
        { first: true },
      ) +
      screen(
        's2',
        'お礼',
        '<h2 class="p-done">ご回答ありがとうございました</h2>' +
          '<p class="p-done-note">いただいたお答えは、これからのご案内づくりに役立てます。よろしければ、続きもご覧ください。</p>' +
          `<a class="p-cta" href="ooooo"><span>続きを見る</span>${CHEVRON_RIGHT}</a>` +
          '<p class="p-fine">ご覧いただくだけなら費用はかかりません。</p>',
      ),
  }),
}

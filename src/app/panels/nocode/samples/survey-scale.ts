/**
 * 新しい見本「5段階で答える（2問＋お礼）」（2026-09-23）。
 *
 * 満足度や分かりやすさのように、度合いを聞きたいときの形。1〜5を横に並べ、
 * 両端に言葉（そう思わない／とてもそう思う）を添えて意味が分かるようにした。
 * 狭い画面でも1つ56px以上あるので指で押せる。最後はお礼と次に進むボタン。
 */
import { SCREENS_SCRIPT } from '../templates/builder.ts'
import { CHEVRON_LEFT, CHEVRON_RIGHT, INK, INK_SUB, LINE, sampleHtml, screen, type NewSample } from './kit.ts'

const UID = 'nc-g0000004'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  // 進み具合（Q1/2 と細い線）
  `${s} .c-step{display:flex;align-items:center;gap:12px;max-width:520px;margin:0 auto 20px}` +
  `${s} .c-step__now{flex:0 0 auto;font-size:12.5px;font-weight:800;color:${ACCENT};` +
  `font-variant-numeric:tabular-nums;letter-spacing:.06em}` +
  `${s} .c-step__bar{display:flex;flex:1;min-width:0;gap:4px}` +
  `${s} .c-step__seg{flex:1;height:3px;border-radius:2px;background:#E4E8EE}` +
  `${s} .c-step__seg.is-on{background:${ACCENT}}` +
  // 設問
  `${s} .c-ask{font-size:21px;font-weight:800;line-height:1.55;max-width:520px;margin:0 auto 6px}` +
  `${s} .c-note{font-size:13px;line-height:1.7;color:${INK_SUB};max-width:520px;margin:0 auto 18px}` +
  // 1〜5（横に5つ。狭い画面でも1つ56px以上）
  `${s} .c-scale{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;max-width:520px;margin:0 auto}` +
  `${s} .c-num{display:flex;align-items:center;justify-content:center;min-height:58px;padding:8px 4px;` +
  `border:1.5px solid ${LINE};border-radius:10px;background:#FFFFFF;color:${INK};` +
  `font-weight:800;font-size:19px;line-height:1.2;font-family:inherit;font-variant-numeric:tabular-nums;cursor:pointer;` +
  `-webkit-tap-highlight-color:transparent;transition:border-color .12s ease,background .12s ease,color .12s ease}` +
  `${s} .c-num:hover{border-color:${ACCENT};background:#F5F9FF;color:${ACCENT}}` +
  `${s} .c-num:active{transform:translateY(1px)}` +
  `${s} .c-num:focus-visible{outline:3px solid ${ACCENT};outline-offset:2px}` +
  // 両端の言葉
  `${s} .c-ends{display:flex;justify-content:space-between;gap:12px;max-width:520px;margin:10px auto 0;` +
  `font-size:12px;line-height:1.6;color:${INK_SUB}}` +
  `${s} .c-ends span{flex:0 1 auto}` +
  // もどる
  `${s} .c-backrow{display:flex;justify-content:center}` +
  `${s} .c-back{display:inline-flex;align-items:center;gap:6px;min-height:44px;margin:12px 0 0;padding:10px 6px;` +
  `border:0;background:none;color:${INK_SUB};font-weight:700;font-size:13px;line-height:1.4;font-family:inherit;cursor:pointer}` +
  `${s} .c-back:hover{color:${INK}}` +
  `${s} .c-back svg{width:14px;height:14px}` +
  // お礼の画面
  `${s} .c-done{font-size:21px;font-weight:800;line-height:1.5;text-align:center;margin:0 0 10px}` +
  `${s} .c-done-note{font-size:14.5px;line-height:1.85;color:${INK_SUB};text-align:center;` +
  `max-width:520px;margin:0 auto 22px}` +
  `${s} .c-cta{display:flex;width:100%;max-width:520px;margin:0 auto;align-items:center;justify-content:center;` +
  `gap:10px;min-height:60px;padding:16px 24px;border-radius:10px;background:${ACCENT};color:#FFFFFF;` +
  `font-weight:800;font-size:18px;line-height:1.4;font-family:inherit;text-decoration:none;box-shadow:0 4px 0 #185FB0;` +
  `transition:transform .12s ease,box-shadow .12s ease}` +
  `${s} .c-cta:active{transform:translateY(3px);box-shadow:0 1px 0 #185FB0}` +
  `${s} .c-cta:focus-visible{outline:3px solid #14508F;outline-offset:3px}` +
  `${s} .c-cta svg{flex:0 0 18px;width:18px;height:18px}` +
  `${s} .c-fine{margin:14px 0 0;font-size:12.5px;line-height:1.7;color:${INK_SUB};text-align:center}` +
  `@media (max-width:480px){${s} .c-ask{font-size:19px}${s} .c-scale{gap:8px}` +
  `${s} .c-num{font-size:18px;min-height:56px}${s} .c-done{font-size:19px}}` +
  `@media (prefers-reduced-motion:reduce){${s} .c-num,${s} .c-cta{transition:none}}`

/** 進み具合（今が何問目か） */
function step(now: number, total: number): string {
  const segments = Array.from({ length: total }, (_, i) => `<span class="c-step__seg${i < now ? ' is-on' : ''}"></span>`).join('')
  return `<div class="c-step"><span class="c-step__now">Q${now} / ${total}</span><span class="c-step__bar">${segments}</span></div>`
}

/** 1〜5のボタン（押すと次の画面へ） */
const scale = (go: string, low: string, high: string): string =>
  '<div class="c-scale">' +
  [1, 2, 3, 4, 5].map((n) => `<button type="button" class="c-num" data-nc-go="${go}">${n}</button>`).join('') +
  '</div>' +
  `<p class="c-ends"><span>1：${low}</span><span>5：${high}</span></p>`

const back = (go: string): string =>
  `<div class="c-backrow"><button type="button" class="c-back" data-nc-go="${go}">${CHEVRON_LEFT}前の質問にもどる</button></div>`

export const SURVEY_SCALE_SAMPLE: NewSample = {
  id: 'survey-scale',
  category: 'アンケート・診断',
  name: '5段階で答える（2問＋お礼）',
  summary: '1〜5の数字を横に並べた形。満足度や分かりやすさを聞くときに使います',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    screens: { transition: 'fade', script: SCREENS_SCRIPT },
    body:
      screen(
        's1',
        '設問①',
        step(1, 2) +
          '<h2 class="c-ask">いまのやり方に、どのくらい満足していますか？</h2>' +
          '<p class="c-note">近いと思う数字を1つ選んでください。あと1問で終わります。</p>' +
          scale('s2', '満足していない', 'とても満足している'),
        { first: true },
      ) +
      screen(
        's2',
        '設問②',
        step(2, 2) +
          '<h2 class="c-ask">ここまでのご説明は、どのくらい分かりやすかったですか？</h2>' +
          '<p class="c-note">正直なところをお聞かせください。ご意見は今後のご案内づくりに使わせていただきます。</p>' +
          scale('s3', '分かりにくい', 'とても分かりやすい') +
          back('s1'),
      ) +
      screen(
        's3',
        'お礼',
        '<h2 class="c-done">ご回答ありがとうございました</h2>' +
          '<p class="c-done-note">お答えいただいた内容をもとに、いまのあなたに合う進め方をご案内します。下のボタンからご覧いただけます。</p>' +
          `<a class="c-cta" href="ooooo"><span>案内を見る</span>${CHEVRON_RIGHT}</a>` +
          '<p class="c-fine">ご覧いただくだけなら費用はかかりません。</p>',
      ),
  }),
}

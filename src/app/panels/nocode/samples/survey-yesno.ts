/**
 * 新しい見本「はい／いいえで進む（3問＋お礼）」（2026-09-23）。
 *
 * 考えずに答えられる2択だけで3問進む形。読む人の手が止まりにくいので、LPの序盤に置きやすい。
 * 2つのボタンは横に並べ、狭い画面でも指で押せる高さ（60px以上）を保つ。
 * 最後はお礼と申し込みのボタン（リンク先は仮。入れた人がWidget編集で入れる）。
 */
import { SCREENS_SCRIPT } from '../templates/builder.ts'
import { CHEVRON_LEFT, CHEVRON_RIGHT, INK, INK_SUB, LINE, sampleHtml, screen, type NewSample } from './kit.ts'

const UID = 'nc-g0000001'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  // 進み具合（Q1/3 と3本の細い線）。今いる設問だけ色を付ける
  `${s} .y-step{display:flex;align-items:center;gap:12px;max-width:520px;margin:0 auto 20px}` +
  `${s} .y-step__now{flex:0 0 auto;font-size:12.5px;font-weight:800;color:${ACCENT};` +
  `font-variant-numeric:tabular-nums;letter-spacing:.06em}` +
  `${s} .y-step__bar{display:flex;flex:1;min-width:0;gap:4px}` +
  `${s} .y-step__seg{flex:1;height:3px;border-radius:2px;background:#E4E8EE}` +
  `${s} .y-step__seg.is-on{background:${ACCENT}}` +
  // 設問と補足
  `${s} .y-ask{font-size:21px;font-weight:800;line-height:1.55;max-width:520px;margin:0 auto 6px}` +
  `${s} .y-note{font-size:13px;line-height:1.7;color:${INK_SUB};max-width:520px;margin:0 auto 20px}` +
  // 2択（横に2つ。文字は短いので狭い画面でも2列のまま）
  `${s} .y-pair{display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:520px;margin:0 auto}` +
  `${s} .y-btn{display:flex;align-items:center;justify-content:center;gap:8px;min-height:64px;` +
  `padding:16px 10px;border:1.5px solid ${LINE};border-radius:10px;background:#FFFFFF;color:${INK};` +
  `font:800 17px/1.5 inherit;cursor:pointer;-webkit-tap-highlight-color:transparent;` +
  `transition:border-color .12s ease,background .12s ease}` +
  `${s} .y-btn:hover{border-color:${ACCENT};background:#F5F9FF}` +
  `${s} .y-btn:active{transform:translateY(1px)}` +
  `${s} .y-btn:focus-visible{outline:3px solid ${ACCENT};outline-offset:2px}` +
  // もどる
  `${s} .y-back{display:inline-flex;align-items:center;gap:6px;min-height:44px;max-width:520px;margin:10px auto 0;` +
  `padding:10px 6px;border:0;background:none;color:${INK_SUB};font:700 13px/1.4 inherit;cursor:pointer}` +
  `${s} .y-back:hover{color:${INK}}` +
  `${s} .y-back svg{width:14px;height:14px}` +
  `${s} .y-backrow{display:flex;justify-content:center}` +
  // お礼の画面
  `${s} .y-done{font-size:22px;font-weight:800;line-height:1.5;text-align:center;margin:0 0 10px}` +
  `${s} .y-done-note{font-size:14.5px;line-height:1.85;color:${INK_SUB};text-align:center;` +
  `max-width:520px;margin:0 auto 22px}` +
  `${s} .y-cta{display:flex;width:100%;max-width:520px;margin:0 auto;align-items:center;justify-content:center;` +
  `gap:10px;min-height:60px;padding:16px 24px;border-radius:10px;background:${ACCENT};color:#FFFFFF;` +
  `font:800 18px/1.4 inherit;text-decoration:none;box-shadow:0 4px 0 #185FB0;` +
  `transition:transform .12s ease,box-shadow .12s ease}` +
  `${s} .y-cta:active{transform:translateY(3px);box-shadow:0 1px 0 #185FB0}` +
  `${s} .y-cta:focus-visible{outline:3px solid #14508F;outline-offset:3px}` +
  `${s} .y-cta svg{flex:0 0 18px;width:18px;height:18px}` +
  `${s} .y-fine{margin:14px 0 0;font-size:12.5px;line-height:1.7;color:${INK_SUB};text-align:center}` +
  `@media (max-width:480px){${s} .y-ask{font-size:19px}${s} .y-btn{font-size:16px;min-height:60px}` +
  `${s} .y-done{font-size:20px}}` +
  `@media (prefers-reduced-motion:reduce){${s} .y-btn,${s} .y-cta{transition:none}}`

/** 進み具合（今が何問目か） */
function step(now: number, total: number): string {
  const segments = Array.from({ length: total }, (_, i) => `<span class="y-step__seg${i < now ? ' is-on' : ''}"></span>`).join('')
  return `<div class="y-step"><span class="y-step__now">Q${now} / ${total}</span><span class="y-step__bar">${segments}</span></div>`
}

const ask = (question: string, note: string): string => `<h2 class="y-ask">${question}</h2><p class="y-note">${note}</p>`

const pair = (go: string): string =>
  `<div class="y-pair">` +
  `<button type="button" class="y-btn" data-nc-go="${go}">はい</button>` +
  `<button type="button" class="y-btn" data-nc-go="${go}">いいえ</button>` +
  `</div>`

const back = (go: string): string =>
  `<div class="y-backrow"><button type="button" class="y-back" data-nc-go="${go}">${CHEVRON_LEFT}前の質問にもどる</button></div>`

export const SURVEY_YESNO_SAMPLE: NewSample = {
  id: 'survey-yesno',
  category: 'アンケート・診断',
  name: 'はい／いいえで進む（3問＋お礼）',
  summary: '2択だけで3問進みます。考えずに押せるので、途中でやめられにくい形です',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    screens: { transition: 'fade', script: SCREENS_SCRIPT },
    body:
      screen(
        's1',
        '設問①',
        step(1, 3) +
          ask('いまのやり方に、負担を感じることはありますか？', '当てはまる方を選んでください。あと2問、20秒ほどで終わります。') +
          pair('s2'),
        { first: true },
      ) +
      screen(
        's2',
        '設問②',
        step(2, 3) +
          ask('これまでに、何か対策を試したことはありますか？', '試した方法の中身は問いません。近い方を選んでください。') +
          pair('s3') +
          back('s1'),
      ) +
      screen(
        's3',
        '設問③',
        step(3, 3) +
          ask('無料の資料があれば、受け取ってみたいですか？', '受け取り方は、このあとのご案内でお選びいただけます。') +
          pair('s4') +
          back('s2'),
      ) +
      screen(
        's4',
        'お礼',
        '<h2 class="y-done">ご回答ありがとうございました</h2>' +
          '<p class="y-done-note">3つの答えに合わせて、いまのあなたに近い内容をご案内します。下のボタンから1分ほどで受け取れます。</p>' +
          `<a class="y-cta" href="ooooo"><span>無料で受け取る</span>${CHEVRON_RIGHT}</a>` +
          '<p class="y-fine">受け取りは無料です。いつでもやめられます。</p>',
      ),
  }),
}

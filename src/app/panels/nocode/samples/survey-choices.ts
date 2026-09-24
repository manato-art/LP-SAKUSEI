/**
 * 新しい見本「選んで進むアンケート（3問＋お礼）」（2026-09-23・本人の依頼で0から作り直した1本目）。
 *
 * ファネルの入口で一番よく使う形。選択肢を押すと、同じWidgetの中で次の設問へ瞬時に切り替わる
 * （SB由来の見本は「答えると別ページへ飛ぶ」前提で、LPに入れると行き止まりだった）。
 * 最後の画面はお礼＋申し込みのボタン（リンク先は仮。入れた人がWidget編集で入れる）。
 *
 * 「画面を作って使う」で取り込むと、設問1つ＝画面1つの部品に分かれる（sample-to-screens.ts）。
 */
import { SCREENS_SCRIPT } from '../templates/builder.ts'
import { CHEVRON_LEFT, CHEVRON_RIGHT, INK, INK_SUB, LINE, sampleHtml, screen, type NewSample } from './kit.ts'

const UID = 'nc-surv0001'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  // 進み具合（Q1/3 と3本の細い線）。今いる設問だけ色を付ける
  `${s} .q-step{display:flex;align-items:center;gap:12px;margin:0 0 20px}` +
  `${s} .q-step__now{flex:0 0 auto;font-size:12.5px;font-weight:800;color:${ACCENT};` +
  `font-variant-numeric:tabular-nums;letter-spacing:.06em}` +
  `${s} .q-step__bar{display:flex;flex:1;min-width:0;gap:4px}` +
  `${s} .q-step__seg{flex:1;height:3px;border-radius:2px;background:#E4E8EE}` +
  `${s} .q-step__seg.is-on{background:${ACCENT}}` +
  // 設問と補足
  `${s} .q-ask{font-size:21px;font-weight:800;line-height:1.55;margin:0 0 6px}` +
  `${s} .q-note{font-size:13px;line-height:1.7;color:${INK_SUB};margin:0 0 20px}` +
  // 選択肢（白地・細い枠。押すと少し沈む）
  `${s} .q-choice{display:flex;width:100%;align-items:center;gap:12px;min-height:60px;padding:14px 16px;` +
  `margin:0 0 10px;border:1.5px solid ${LINE};border-radius:10px;background:#FFFFFF;color:${INK};` +
  `font-weight:800;font-size:16px;line-height:1.55;font-family:inherit;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent;` +
  `transition:border-color .12s ease,background .12s ease}` +
  `${s} .q-choice:hover{border-color:${ACCENT};background:#F5F9FF}` +
  `${s} .q-choice:active{transform:translateY(1px)}` +
  `${s} .q-choice:focus-visible{outline:3px solid ${ACCENT};outline-offset:2px}` +
  `${s} .q-choice__text{flex:1;min-width:0}` +
  `${s} .q-choice__go{flex:0 0 18px;width:18px;height:18px;color:${ACCENT}}` +
  // もどる
  `${s} .q-back{display:inline-flex;align-items:center;gap:6px;margin:6px 0 0;padding:8px 0;border:0;` +
  `background:none;color:${INK_SUB};font-weight:700;font-size:13px;line-height:1.4;font-family:inherit;cursor:pointer}` +
  `${s} .q-back:hover{color:${INK}}` +
  `${s} .q-back svg{width:14px;height:14px}` +
  // お礼の画面
  `${s} .q-done{font-size:22px;font-weight:800;line-height:1.5;margin:0 0 10px}` +
  `${s} .q-done-note{font-size:14.5px;line-height:1.85;color:${INK_SUB};margin:0 0 22px}` +
  `${s} .q-cta{display:flex;width:100%;max-width:520px;margin:0 auto;align-items:center;justify-content:center;` +
  `gap:10px;min-height:60px;padding:16px 24px;border-radius:10px;background:${ACCENT};color:#FFFFFF;` +
  `font-weight:800;font-size:18px;line-height:1.4;font-family:inherit;text-decoration:none;box-shadow:0 4px 0 #185FB0;` +
  `transition:transform .12s ease,box-shadow .12s ease}` +
  `${s} .q-cta:active{transform:translateY(3px);box-shadow:0 1px 0 #185FB0}` +
  `${s} .q-cta:focus-visible{outline:3px solid #14508F;outline-offset:3px}` +
  `${s} .q-cta svg{flex:0 0 18px;width:18px;height:18px}` +
  `${s} .q-fine{margin:14px 0 0;font-size:12.5px;line-height:1.7;color:${INK_SUB};text-align:center}` +
  `@media (max-width:480px){${s} .q-ask{font-size:19px}${s} .q-choice{font-size:15.5px;min-height:56px}}` +
  `@media (prefers-reduced-motion:reduce){${s} .q-choice,${s} .q-cta{transition:none}}`

/** 進み具合（今が何問目か） */
function step(now: number, total: number): string {
  const segments = Array.from({ length: total }, (_, i) => `<span class="q-step__seg${i < now ? ' is-on' : ''}"></span>`).join('')
  return `<div class="q-step"><span class="q-step__now">Q${now} / ${total}</span><span class="q-step__bar">${segments}</span></div>`
}

const choice = (text: string, go: string): string =>
  `<button type="button" class="q-choice" data-nc-go="${go}">` +
  `<span class="q-choice__text">${text}</span><span class="q-choice__go">${CHEVRON_RIGHT}</span></button>`

const back = (go: string): string => `<button type="button" class="q-back" data-nc-go="${go}">${CHEVRON_LEFT}前の質問にもどる</button>`

const ask = (question: string, note: string): string =>
  `<h2 class="q-ask">${question}</h2><p class="q-note">${note}</p>`

export const SURVEY_CHOICES_SAMPLE: NewSample = {
  id: 'survey-choices',
  category: 'アンケート・診断',
  name: '選んで進むアンケート（3問＋お礼）',
  summary: '選択肢を押すと次の設問へ瞬時に切り替わります。最後はお礼と申し込みボタン',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    screens: { transition: 'fade', script: SCREENS_SCRIPT },
    body:
      screen(
        's1',
        '設問①',
        step(1, 3) +
          ask('いま、いちばん気になっていることは？', '当てはまるものを1つ選んでください。あと3問、30秒ほどで終わります。') +
          choice('毎日の時間が足りない', 's2') +
          choice('続けられるか不安', 's2') +
          choice('費用が気になる', 's2'),
        { first: true },
      ) +
      screen(
        's2',
        '設問②',
        step(2, 3) +
          ask('いつから始めたいですか？', '目安で構いません。') +
          choice('できるだけ早く', 's3') +
          choice('1か月以内', 's3') +
          choice('まだ決めていない', 's3') +
          back('s1'),
      ) +
      screen(
        's3',
        '設問③',
        step(3, 3) +
          ask('ご案内はどの方法が良いですか？', '選んだ方法でご連絡します。') +
          choice('メールで受け取る', 's4') +
          choice('LINEで受け取る', 's4') +
          choice('電話で相談したい', 's4') +
          back('s2'),
      ) +
      screen(
        's4',
        'お礼',
        '<h2 class="q-done">ご回答ありがとうございました</h2>' +
          '<p class="q-done-note">あなたに合うプランをご案内します。下のボタンから、1分で受け取れます。</p>' +
          `<a class="q-cta" href="ooooo"><span>無料で受け取る</span>${CHEVRON_RIGHT}</a>` +
          '<p class="q-fine">登録は無料です。いつでもやめられます。</p>',
      ),
  }),
}

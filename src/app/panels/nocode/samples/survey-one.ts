/**
 * 新しい見本「1問だけのアンケート（→お礼）」（2026-09-23）。
 *
 * 設問は1つだけ、選ぶとすぐお礼に切り替わる最小の形。LPの冒頭に置いて、読む人の関心を
 * ひとつ決めてもらうのに使う。選択肢は箱を反復させず、細い線で区切った行にした（ui-forge anti-ai-look）。
 */
import { SCREENS_SCRIPT } from '../templates/builder.ts'
import { CHEVRON_RIGHT, INK, INK_SUB, LINE_LIGHT, sampleHtml, screen, type NewSample } from './kit.ts'

const UID = 'nc-g0000002'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  // 設問（1問だけなので進み具合は出さない）
  `${s} .o-tag{display:block;max-width:520px;margin:0 auto 8px;font-size:12px;font-weight:800;` +
  `letter-spacing:.08em;color:${ACCENT}}` +
  `${s} .o-ask{font-size:21px;font-weight:800;line-height:1.55;max-width:520px;margin:0 auto 6px}` +
  `${s} .o-note{font-size:13px;line-height:1.7;color:${INK_SUB};max-width:520px;margin:0 auto 18px}` +
  // 選択肢（細い線で区切った行。押せる高さは60px）
  `${s} .o-list{max-width:520px;margin:0 auto;border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .o-row{display:flex;width:100%;align-items:center;gap:12px;min-height:60px;padding:14px 8px;` +
  `border:0;border-bottom:1px solid ${LINE_LIGHT};background:none;color:${INK};` +
  `font-weight:700;font-size:16px;line-height:1.6;font-family:inherit;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent;` +
  `transition:background .12s ease,color .12s ease}` +
  `${s} .o-row:hover{background:#F5F9FF;color:${ACCENT}}` +
  `${s} .o-row:active{transform:translateY(1px)}` +
  `${s} .o-row:focus-visible{outline:3px solid ${ACCENT};outline-offset:-3px}` +
  `${s} .o-row__text{flex:1;min-width:0}` +
  `${s} .o-row__go{flex:0 0 17px;width:17px;height:17px;color:${ACCENT}}` +
  // お礼の画面
  `${s} .o-done{font-size:21px;font-weight:800;line-height:1.5;text-align:center;margin:0 0 10px}` +
  `${s} .o-done-note{font-size:14.5px;line-height:1.85;color:${INK_SUB};text-align:center;` +
  `max-width:520px;margin:0 auto 22px}` +
  `${s} .o-cta{display:flex;width:100%;max-width:520px;margin:0 auto;align-items:center;justify-content:center;` +
  `gap:10px;min-height:60px;padding:16px 24px;border-radius:10px;background:${ACCENT};color:#FFFFFF;` +
  `font-weight:800;font-size:18px;line-height:1.4;font-family:inherit;text-decoration:none;box-shadow:0 4px 0 #185FB0;` +
  `transition:transform .12s ease,box-shadow .12s ease}` +
  `${s} .o-cta:active{transform:translateY(3px);box-shadow:0 1px 0 #185FB0}` +
  `${s} .o-cta:focus-visible{outline:3px solid #14508F;outline-offset:3px}` +
  `${s} .o-cta svg{flex:0 0 18px;width:18px;height:18px}` +
  `${s} .o-fine{margin:14px 0 0;font-size:12.5px;line-height:1.7;color:${INK_SUB};text-align:center}` +
  `@media (max-width:480px){${s} .o-ask{font-size:19px}${s} .o-row{font-size:15.5px}${s} .o-done{font-size:19px}}` +
  `@media (prefers-reduced-motion:reduce){${s} .o-row,${s} .o-cta{transition:none}}`

const row = (text: string, go: string): string =>
  `<button type="button" class="o-row" data-nc-go="${go}">` +
  `<span class="o-row__text">${text}</span><span class="o-row__go">${CHEVRON_RIGHT}</span></button>`

export const SURVEY_ONE_SAMPLE: NewSample = {
  id: 'survey-one',
  category: 'アンケート・診断',
  name: '1問だけのアンケート（→お礼）',
  summary: '設問は1つだけ。選ぶとすぐお礼に切り替わります。冒頭に置く最小の形です',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    screens: { transition: 'fade', script: SCREENS_SCRIPT },
    body:
      screen(
        's1',
        '設問①',
        '<span class="o-tag">かんたん1問</span>' +
          '<h2 class="o-ask">いちばん知りたいことはどれですか？</h2>' +
          '<p class="o-note">1つ選ぶと、その内容からご案内します。10秒ほどで終わります。</p>' +
          '<div class="o-list">' +
          row('料金の目安を知りたい', 's2') +
          row('始めるまでの流れを知りたい', 's2') +
          row('自分に合うかどうかを知りたい', 's2') +
          '</div>',
        { first: true },
      ) +
      screen(
        's2',
        'お礼',
        '<h2 class="o-done">お答えいただきありがとうございます</h2>' +
          '<p class="o-done-note">選んでいただいた内容に合わせて、続きをご用意しました。下のボタンからご覧いただけます。</p>' +
          `<a class="o-cta" href="ooooo"><span>続きを見る</span>${CHEVRON_RIGHT}</a>` +
          '<p class="o-fine">読むのにかかる時間は1分ほどです。</p>',
      ),
  }),
}

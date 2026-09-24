/**
 * 新しい見本「3択でタイプ診断（3つの結果）」（2026-09-23）。
 *
 * 設問は1つだけで、選んだ答えごとに別の結果画面へ切り替わる（画面は全部で4枚）。
 * 結果は「タイプの名前＋どんな人か＋おすすめの進め方＋ボタン」の順にして、
 * 読んだ人がそのまま次へ進めるようにした。リンク先は仮（入れた人がWidget編集で入れる）。
 */
import { SCREENS_SCRIPT } from '../templates/builder.ts'
import { CHECK, CHEVRON_RIGHT, INK, INK_SUB, LINE, LINE_LIGHT, sampleHtml, screen, type NewSample } from './kit.ts'

const UID = 'nc-g0000003'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  // 設問
  `${s} .t-tag{display:block;max-width:520px;margin:0 auto 8px;font-size:12px;font-weight:800;` +
  `letter-spacing:.08em;color:${ACCENT}}` +
  `${s} .t-ask{font-size:21px;font-weight:800;line-height:1.55;max-width:520px;margin:0 auto 6px}` +
  `${s} .t-note{font-size:13px;line-height:1.7;color:${INK_SUB};max-width:520px;margin:0 auto 20px}` +
  // 選択肢（A・B・Cの丸い印つき）
  `${s} .t-choice{display:flex;width:100%;max-width:520px;align-items:center;gap:14px;min-height:64px;` +
  `padding:14px 16px;margin:0 auto 10px;border:1.5px solid ${LINE};border-radius:10px;background:#FFFFFF;` +
  `color:${INK};font-weight:700;font-size:16px;line-height:1.6;font-family:inherit;text-align:left;cursor:pointer;` +
  `-webkit-tap-highlight-color:transparent;transition:border-color .12s ease,background .12s ease}` +
  `${s} .t-choice:hover{border-color:${ACCENT};background:#F5F9FF}` +
  `${s} .t-choice:active{transform:translateY(1px)}` +
  `${s} .t-choice:focus-visible{outline:3px solid ${ACCENT};outline-offset:2px}` +
  `${s} .t-choice__no{flex:0 0 30px;display:flex;align-items:center;justify-content:center;width:30px;height:30px;` +
  `border-radius:50%;background:#EAF2FD;color:${ACCENT};font-size:13.5px;font-weight:800;letter-spacing:.02em}` +
  `${s} .t-choice__text{flex:1;min-width:0}` +
  `${s} .t-choice__go{flex:0 0 17px;width:17px;height:17px;color:${ACCENT}}` +
  // 結果
  `${s} .t-kicker{font-size:12px;font-weight:800;letter-spacing:.08em;color:${ACCENT};text-align:center;margin:0 0 8px}` +
  `${s} .t-name{font-size:23px;font-weight:800;line-height:1.45;text-align:center;margin:0 0 16px}` +
  `${s} .t-text{font-size:15px;line-height:1.9;color:${INK};max-width:520px;margin:0 auto 22px}` +
  `${s} .t-sub{font-size:13px;font-weight:800;color:${INK_SUB};max-width:520px;margin:0 auto 8px}` +
  `${s} .t-rec{max-width:520px;margin:0 auto 24px;border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .t-rec li{display:flex;align-items:flex-start;gap:10px;padding:11px 2px;` +
  `border-bottom:1px solid ${LINE_LIGHT};font-size:14.5px;font-weight:700;line-height:1.75}` +
  `${s} .t-rec svg{flex:0 0 17px;width:17px;height:17px;margin-top:5px;color:${ACCENT}}` +
  `${s} .t-cta{display:flex;width:100%;max-width:520px;margin:0 auto;align-items:center;justify-content:center;` +
  `gap:10px;min-height:60px;padding:16px 24px;border-radius:10px;background:${ACCENT};color:#FFFFFF;` +
  `font-weight:800;font-size:18px;line-height:1.4;font-family:inherit;text-decoration:none;box-shadow:0 4px 0 #185FB0;` +
  `transition:transform .12s ease,box-shadow .12s ease}` +
  `${s} .t-cta:active{transform:translateY(3px);box-shadow:0 1px 0 #185FB0}` +
  `${s} .t-cta:focus-visible{outline:3px solid #14508F;outline-offset:3px}` +
  `${s} .t-cta svg{flex:0 0 18px;width:18px;height:18px}` +
  `${s} .t-fine{margin:14px 0 0;font-size:12.5px;line-height:1.7;color:${INK_SUB};text-align:center}` +
  `@media (max-width:480px){${s} .t-ask{font-size:19px}${s} .t-name{font-size:21px}${s} .t-choice{font-size:15.5px}}` +
  `@media (prefers-reduced-motion:reduce){${s} .t-choice,${s} .t-cta{transition:none}}`

const choice = (mark: string, text: string, go: string): string =>
  `<button type="button" class="t-choice" data-nc-go="${go}">` +
  `<span class="t-choice__no">${mark}</span>` +
  `<span class="t-choice__text">${text}</span>` +
  `<span class="t-choice__go">${CHEVRON_RIGHT}</span></button>`

/** 結果の画面（タイプの名前・どんな人か・おすすめの進め方2つ・ボタン） */
const result = (name: string, text: string, recommends: readonly string[]): string =>
  '<p class="t-kicker">診断結果</p>' +
  `<h2 class="t-name">${name}</h2>` +
  `<p class="t-text">${text}</p>` +
  '<p class="t-sub">おすすめの進め方</p>' +
  '<ul class="t-rec">' +
  recommends.map((one) => `<li>${CHECK}<span>${one}</span></li>`).join('') +
  '</ul>' +
  `<a class="t-cta" href="ooooo"><span>このタイプ向けの内容を見る</span>${CHEVRON_RIGHT}</a>` +
  '<p class="t-fine">ご覧いただくだけなら費用はかかりません。</p>'

export const DIAGNOSIS_TYPE_SAMPLE: NewSample = {
  id: 'diagnosis-type',
  category: 'アンケート・診断',
  name: '3択でタイプ診断（3つの結果）',
  summary: '1問選ぶと、答えごとに違う結果の画面が出ます。結果にはボタンつき',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    screens: { transition: 'fade', script: SCREENS_SCRIPT },
    body:
      screen(
        's1',
        '設問①',
        '<span class="t-tag">10秒でわかる</span>' +
          '<h2 class="t-ask">新しいことを始めるとき、あなたに近いのはどれですか？</h2>' +
          '<p class="t-note">いちばん近いものを1つ選んでください。選ぶとすぐに結果が出ます。</p>' +
          choice('A', '計画を立ててから動きたい', 's2') +
          choice('B', '思いついたらすぐ動きたい', 's3') +
          choice('C', '人に相談してから決めたい', 's4'),
        { first: true },
      ) +
      screen(
        's2',
        '結果A',
        result(
          'じっくり準備タイプ',
          '手順や見通しがはっきりしていると、落ち着いて進められる方です。あわてて決めるよりも、はじめに全体像をつかむ時間をとるやり方が合っています。',
          ['はじめに全体の流れを一度読んでおく', '1週間ぶんの予定をまとめて決めておく'],
        ),
      ) +
      screen(
        's3',
        '結果B',
        result(
          'まず試すタイプ',
          '気になったことから手を動かして確かめる方です。長い説明を読み込むよりも、小さく試してから続けるかどうかを決めるやり方が合っています。',
          ['短い期間だけ試して様子を見る', '続けやすかった方法だけを残す'],
        ),
      ) +
      screen(
        's4',
        '結果C',
        result(
          '相談して決めるタイプ',
          '人の話を聞いてから決めると、納得して進められる方です。迷ったときに気軽に聞ける相手がいると、途中で手が止まりにくくなります。',
          ['気になる点を先に書き出しておく', '無料の相談でまとめて質問する'],
        ),
      ),
  }),
}

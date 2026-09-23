/**
 * 新しい見本「条件に合う人だけ進む」（2026-09-23）。
 *
 * 1問目の答えで行き先を分ける形（画面は全部で3枚）。「はい」なら対象の方向けのご案内へ、
 * 「いいえ」ならそのままお帰りいただかずに、別のご案内へつなぐ。
 * 条件の合わない方にも行き止まりを作らないのが狙い。リンク先は仮（入れた人がWidget編集で入れる）。
 */
import { SCREENS_SCRIPT } from '../templates/builder.ts'
import { CHECK, CHEVRON_RIGHT, INK, INK_SUB, LINE, LINE_LIGHT, sampleHtml, screen, type NewSample } from './kit.ts'

const UID = 'nc-g0000006'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  // 設問
  `${s} .n-tag{display:block;max-width:520px;margin:0 auto 8px;font-size:12px;font-weight:800;` +
  `letter-spacing:.08em;color:${ACCENT}}` +
  `${s} .n-ask{font-size:21px;font-weight:800;line-height:1.55;max-width:520px;margin:0 auto 6px}` +
  `${s} .n-note{font-size:13px;line-height:1.7;color:${INK_SUB};max-width:520px;margin:0 auto 20px}` +
  // 2つの行き先（縦に大きく2つ）
  `${s} .n-pick{display:flex;width:100%;max-width:520px;align-items:center;gap:12px;min-height:68px;` +
  `padding:16px 18px;margin:0 auto 12px;border:1.5px solid ${LINE};border-radius:10px;background:#FFFFFF;` +
  `color:${INK};font:800 16.5px/1.6 inherit;text-align:left;cursor:pointer;` +
  `-webkit-tap-highlight-color:transparent;transition:border-color .12s ease,background .12s ease}` +
  `${s} .n-pick:hover{border-color:${ACCENT};background:#F5F9FF}` +
  `${s} .n-pick:active{transform:translateY(1px)}` +
  `${s} .n-pick:focus-visible{outline:3px solid ${ACCENT};outline-offset:2px}` +
  `${s} .n-pick__text{flex:1;min-width:0}` +
  `${s} .n-pick__go{flex:0 0 17px;width:17px;height:17px;color:${ACCENT}}` +
  `${s} .n-hint{max-width:520px;margin:14px auto 0;font-size:12.5px;line-height:1.75;color:${INK_SUB}}` +
  // 行き先の画面
  `${s} .n-kicker{font-size:12px;font-weight:800;letter-spacing:.08em;color:${ACCENT};text-align:center;margin:0 0 8px}` +
  `${s} .n-title{font-size:22px;font-weight:800;line-height:1.5;text-align:center;margin:0 0 14px}` +
  `${s} .n-text{font-size:15px;line-height:1.9;color:${INK};max-width:520px;margin:0 auto 22px}` +
  `${s} .n-list{max-width:520px;margin:0 auto 24px;border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .n-list li{display:flex;align-items:flex-start;gap:10px;padding:11px 2px;` +
  `border-bottom:1px solid ${LINE_LIGHT};font-size:14.5px;font-weight:700;line-height:1.75}` +
  `${s} .n-list svg{flex:0 0 17px;width:17px;height:17px;margin-top:5px;color:${ACCENT}}` +
  `${s} .n-cta{display:flex;width:100%;max-width:520px;margin:0 auto;align-items:center;justify-content:center;` +
  `gap:10px;min-height:60px;padding:16px 24px;border-radius:10px;background:${ACCENT};color:#FFFFFF;` +
  `font:800 17.5px/1.45 inherit;text-decoration:none;box-shadow:0 4px 0 #185FB0;` +
  `transition:transform .12s ease,box-shadow .12s ease}` +
  `${s} .n-cta:active{transform:translateY(3px);box-shadow:0 1px 0 #185FB0}` +
  `${s} .n-cta:focus-visible{outline:3px solid #14508F;outline-offset:3px}` +
  `${s} .n-cta svg{flex:0 0 18px;width:18px;height:18px}` +
  `${s} .n-fine{margin:14px 0 0;font-size:12.5px;line-height:1.7;color:${INK_SUB};text-align:center}` +
  `@media (max-width:480px){${s} .n-ask{font-size:19px}${s} .n-title{font-size:20px}` +
  `${s} .n-pick{font-size:15.5px;min-height:64px;padding:14px 16px}${s} .n-cta{font-size:16.5px}}` +
  `@media (prefers-reduced-motion:reduce){${s} .n-pick,${s} .n-cta{transition:none}}`

const pick = (text: string, go: string): string =>
  `<button type="button" class="n-pick" data-nc-go="${go}">` +
  `<span class="n-pick__text">${text}</span><span class="n-pick__go">${CHEVRON_RIGHT}</span></button>`

const point = (text: string): string => `<li>${CHECK}<span>${text}</span></li>`

export const SURVEY_GATE_SAMPLE: NewSample = {
  id: 'survey-gate',
  category: 'アンケート・診断',
  name: '条件に合う人だけ進む',
  summary: '1問目の答えで行き先が分かれます。条件に合わない方にも別のご案内へ',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    screens: { transition: 'fade', script: SCREENS_SCRIPT },
    body:
      screen(
        's1',
        '設問①',
        '<span class="n-tag">はじめに確認</span>' +
          '<h2 class="n-ask">今回のご案内をご利用になるのは初めてですか？</h2>' +
          '<p class="n-note">お答えによってご案内の内容が変わります。当てはまる方を選んでください。</p>' +
          pick('はい、初めてです', 's2') +
          pick('いいえ、利用したことがあります', 's3') +
          '<p class="n-hint">どちらを選んでも、このあとのご案内はご覧いただけます。</p>',
        { first: true },
      ) +
      screen(
        's2',
        '案内（初めての方）',
        '<p class="n-kicker">初めての方へ</p>' +
          '<h2 class="n-title">はじめ方のご案内をご用意しています</h2>' +
          '<p class="n-text">ありがとうございます。初めての方には、何から始めればよいかを順にまとめたご案内をお渡ししています。下のボタンからご覧いただけます。</p>' +
          '<ul class="n-list">' +
          point('始めるまでの流れを順にご説明します') +
          point('分からない点はチャットでご相談いただけます') +
          point('合わないと感じたときは、途中でおやめいただけます') +
          '</ul>' +
          `<a class="n-cta" href="ooooo"><span>初めての方の案内を見る</span>${CHEVRON_RIGHT}</a>` +
          '<p class="n-fine">ご覧いただくだけなら費用はかかりません。</p>',
      ) +
      screen(
        's3',
        '別のご案内',
        '<p class="n-kicker">ご利用中の方へ</p>' +
          '<h2 class="n-title">別のご案内をご用意しています</h2>' +
          '<p class="n-text">いつもご利用いただきありがとうございます。すでにお使いの方には、今のご利用に合わせた別のご案内をご用意しています。今回の初回向けのご案内は対象外となりますので、こちらからお進みください。</p>' +
          `<a class="n-cta" href="ooooo"><span>ご利用中の方の案内を見る</span>${CHEVRON_RIGHT}</a>` +
          '<p class="n-fine">ご不明な点は、お問い合わせ先からご連絡ください。</p>',
      ),
  }),
}

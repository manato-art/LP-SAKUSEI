/**
 * 新しい見本「見出しとリードだけの冒頭（画像なし）」（2026-09-23）。
 *
 * LPのいちばん上を3行で言い切る、いちばん小さい冒頭。太い見出し・2行のリード・小さな補足だけ。
 * 画像もボタンも置かないので、この下にどんな区画を続けても邪魔をしない。
 * 箱を使わず、見出しの下の短い線1本だけで区切る。
 */
import { INK_SUB, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-a0000001'
const ACCENT = '#E5573F'
const s = `.${UID}`

const CSS =
  `${s}{padding:40px 16px 34px;text-align:center}` +
  `${s} .a-title{font-size:30px;font-weight:800;line-height:1.4;letter-spacing:-.01em;margin:0;text-wrap:balance}` +
  `${s} .a-title em{font-style:normal;color:${ACCENT}}` +
  `${s} .a-title::after{content:"";display:block;width:56px;height:3px;margin:18px auto 0;background:${ACCENT}}` +
  `${s} .a-lead{max-width:600px;margin:18px auto 0;font-size:15.5px;line-height:1.95;color:${INK_SUB}}` +
  `${s} .a-note{max-width:600px;margin:14px auto 0;font-size:12px;line-height:1.75;color:${INK_SUB}}` +
  `@media (max-width:480px){${s}{padding:32px 16px 28px}${s} .a-title{font-size:24px}` +
  `${s} .a-lead{font-size:14.5px;margin-top:16px}}`

export const HERO_SIMPLE_SAMPLE: NewSample = {
  id: 'hero-simple',
  category: '冒頭・つかみ',
  name: '見出しとリードだけの冒頭（画像なし）',
  summary: 'LPのいちばん上を3行で言い切る最小の冒頭。画像もボタンも置きません',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      '<h1 class="a-title">毎月の請求書づくりを、<em>30分</em>で終わらせる</h1>' +
      '<p class="a-lead">取引先ごとの書式も、消費税の計算も、入力するのは最初の1回だけです。' +
      '翌月からは、前の月の内容を引き継いで、確認するだけで送れます。</p>' +
      '<p class="a-note">※株式会社サンプルが提供する、従業員30名までの会社向けのサービスです。</p>',
  }),
}

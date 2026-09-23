/**
 * 新しい見本「これまでの歩み（年表・4つ）」（2026-09-23）。
 *
 * 左に年、右に出来事を置き、細い縦線と小さな点でつなぐ年表。
 * 箱は1つも使わず、線と点と文字の大きさだけで順番を見せている。
 * 狭い画面でも年が折り返さないよう、左の幅は文字数（em）で決める。
 */
import { INK, INK_SUB, LINE, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-d0000008'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .h-list{max-width:560px;margin:0 auto}` +
  `${s} .h-item{position:relative;padding:0 0 26px 6.4em}` +
  `${s} .h-item:last-child{padding-bottom:0}` +
  // 縦線（点の真下から次の項目まで）と、その上に乗せる小さな点
  `${s} .h-item::before{content:"";position:absolute;left:5.2em;top:11px;bottom:0;width:1px;background:${LINE}}` +
  `${s} .h-item:last-child::before{display:none}` +
  `${s} .h-item::after{content:"";position:absolute;left:calc(5.2em - 3.5px);top:6px;` +
  `width:8px;height:8px;border-radius:50%;background:${ACCENT}}` +
  `${s} .h-year{position:absolute;left:0;top:0;width:4.2em;text-align:right;` +
  `font-size:14.5px;font-weight:800;line-height:1.75;color:${ACCENT};font-variant-numeric:tabular-nums}` +
  `${s} .h-head{font-size:16.5px;font-weight:800;line-height:1.6;color:${INK};margin:0 0 5px}` +
  `${s} .h-text{font-size:14px;line-height:1.9;color:${INK_SUB}}` +
  `${s} .h-note{max-width:560px;margin:18px auto 0;font-size:12px;line-height:1.7;color:${INK_SUB}}` +
  `@media (max-width:480px){${s} .h-item{padding-left:5.6em;padding-bottom:24px}` +
  `${s} .h-item::before{left:4.6em}${s} .h-item::after{left:calc(4.6em - 3.5px)}` +
  `${s} .h-year{width:3.7em;font-size:13.5px}${s} .h-head{font-size:15.5px}${s} .h-text{font-size:13.5px}}`

const step = (year: string, title: string, text: string): string =>
  `<li class="h-item"><span class="h-year">${year}</span>` +
  `<h3 class="h-head">${title}</h3><p class="h-text">${text}</p></li>`

export const HISTORY_TIMELINE_SAMPLE: NewSample = {
  id: 'history-timeline',
  category: '信頼・実績',
  name: 'これまでの歩み（年表・4つ）',
  summary: '左に年、右に出来事。細い縦線と点でつないだ年表です',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('これまでの歩み', 'はじまりから今日までを、4つの節目でご紹介します。') +
      '<ul class="h-list">' +
      step('2019年', '3人ではじめました', '小さな事務所で、最初にご相談をいただいた5社のお手伝いから始まりました。') +
      step('2021年', 'ご利用が100社を超えました', 'お問い合わせが増えたため、相談の窓口を平日9時から18時までに広げました。') +
      step('2023年', 'つくる体制を社内に移しました', 'いただいた声をそのまま反映できるよう、開発を自社で行う形に切り替えました。') +
      step('2026年', '1,200社にご利用いただいています', 'これからも毎月の改善を続け、使いやすさを少しずつ整えてまいります。') +
      '</ul>' +
      '<p class="h-note">※社数はいずれも各年の3月末時点のものです。</p>',
  }),
}

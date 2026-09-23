/**
 * 新しい見本「下線つき見出し」（2026-09-23）。
 *
 * 区画の頭に置く見出し。中央にそろえ、短い下線を1本だけ引く。
 * 上下の余白を広めに取って、前の区画の文章と続けて読まれないようにする。
 */
import { head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-h0000008'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s}{padding:44px 16px 34px}` +
  `${s} .nsx-title{position:relative;padding-bottom:16px;margin:0}` +
  `${s} .nsx-title::after{content:'';position:absolute;left:50%;bottom:0;width:38px;height:3px;` +
  `margin-left:-19px;background:${ACCENT}}` +
  `${s} .nsx-lead{margin:14px 0 0}` +
  `@media (max-width:480px){${s}{padding:34px 16px 26px}}`

export const HEADING_UNDERLINE_SAMPLE: NewSample = {
  id: 'heading-underline',
  category: '文章・区切り',
  name: '下線つき見出し',
  summary: '中央の見出しに短い下線を1本。区画の頭に置いて話を分けます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body: head('サービスの特長', '大事なところを3つにしぼってご説明します。'),
  }),
}

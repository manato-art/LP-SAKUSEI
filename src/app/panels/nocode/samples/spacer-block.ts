/**
 * 新しい見本「余白（高さ3種）」（2026-09-23）。
 *
 * 上下の区画のあいだに空きを作るだけの部品。中身が見えないので、LPの編集画面でつまめるよう
 * 外側に min-height を持たせてある。
 * 高さは小32px・中56px・大96pxの3種。コードの `sp-gap--m` を `--s` `--l` に書き換えて選ぶ。
 */
import { sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-h0000012'
const s = `.${UID}`

const CSS =
  `${s}{padding:0;min-height:32px}` +
  `${s} .sp-gap{width:100%}` +
  `${s} .sp-gap--s{height:32px}` +
  `${s} .sp-gap--m{height:56px}` +
  `${s} .sp-gap--l{height:96px}`

export const SPACER_BLOCK_SAMPLE: NewSample = {
  id: 'spacer-block',
  category: '文章・区切り',
  name: '余白（高さ3種）',
  summary: '空きを作るだけの部品。高さは小・中・大をコードで選びます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body: '<div class="sp-gap sp-gap--m"></div>',
  }),
}

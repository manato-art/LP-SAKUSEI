/**
 * 新しい見本「動画で見る使い方」（2026-09-23）。
 *
 * 使い方を動画で見せる区画。動画そのもの（src）は入れた人が「メディア」で差し替える前提なので、
 * ここでは仮の絵（poster）だけを置いた `<video controls>` を用意する。
 * 下に「どこで何が分かるか」の3行を付けて、再生する前に中身が分かるようにしている。
 */
import { INK_SUB, LINE_LIGHT, IMAGE_PLACEHOLDER, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-c0000003'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .v-frame{max-width:600px;margin:0 auto}` +
  `${s} .v-frame video{width:100%;aspect-ratio:16/9;display:block;border-radius:6px;` +
  `background:#EDEDED;object-fit:cover}` +
  `${s} .v-list{max-width:600px;margin:18px auto 0;border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .v-item{display:grid;grid-template-columns:52px minmax(0,1fr);gap:12px;padding:11px 2px;` +
  `border-bottom:1px solid ${LINE_LIGHT};font-size:14.5px;line-height:1.85}` +
  `${s} .v-at{font-weight:800;color:${ACCENT};font-variant-numeric:tabular-nums}` +
  `${s} .v-note{max-width:600px;margin:14px auto 0;font-size:12px;line-height:1.8;color:${INK_SUB}}` +
  `@media (max-width:480px){${s} .v-item{grid-template-columns:46px minmax(0,1fr);gap:10px;font-size:14px}}`

const chapter = (at: string, text: string): string =>
  `<li class="v-item"><span class="v-at">${at}</span><span class="v-what">${text}</span></li>`

export const HOWTO_VIDEO_SAMPLE: NewSample = {
  id: 'howto-video',
  category: '説明・使い方',
  name: '動画で見る使い方',
  summary: '使い方の動画と、どこで何が分かるかの3行。動画は入れた人が差し替えます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('動画で見る使い方', '2分ほどで、届いた日にすることがひととおり分かります。') +
      `<div class="v-frame"><video controls playsinline preload="metadata" poster="${IMAGE_PLACEHOLDER}"></video></div>` +
      '<ul class="v-list">' +
      chapter('0:00', '箱から出して、置くところまで') +
      chapter('0:40', '1日目の使い方（朝と夜で分けています）') +
      chapter('1:30', '続けるときのコツと、休んだ日の戻し方') +
      '</ul>' +
      '<p class="v-note">音が出ます。はじめは音量を下げてご覧ください。動画は入れた人が差し替えてください。</p>',
  }),
}

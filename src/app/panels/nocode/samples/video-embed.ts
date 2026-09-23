/**
 * 新しい見本「動画1本（説明つき）」（2026-09-23）。
 *
 * 動画を1本だけ置いて、その下に見出しと2行の説明、最後に注意の一行を添える区画。
 * 動画そのもの（src）は入れた人が「メディア」で差し替える前提なので、ここでは仮の絵（poster）だけを置く。
 */
import { IMAGE_PLACEHOLDER, INK_SUB, LINE_LIGHT, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-c0000010'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  `${s} .b-wrap{max-width:640px;margin:0 auto}` +
  `${s} .b-wrap video{width:100%;aspect-ratio:16/9;display:block;border-radius:6px;` +
  `background:#EDEDED;object-fit:cover}` +
  `${s} .b-min{display:inline-block;margin:16px 0 8px;padding:3px 9px;border-radius:999px;` +
  `background:#EEF4FC;color:${ACCENT};font-size:12px;font-weight:800;line-height:1.7}` +
  `${s} .b-head{font-size:18px;font-weight:800;line-height:1.55;margin:0 0 8px}` +
  `${s} .b-text{font-size:14.5px;line-height:1.9;color:${INK_SUB}}` +
  `${s} .b-note{margin:14px 0 0;padding-top:12px;border-top:1px solid ${LINE_LIGHT};` +
  `font-size:12px;line-height:1.8;color:${INK_SUB}}` +
  `@media (max-width:480px){${s} .b-head{font-size:16.5px}${s} .b-text{font-size:14px}}`

export const VIDEO_EMBED_SAMPLE: NewSample = {
  id: 'video-embed',
  category: '画像・動画',
  name: '動画1本（説明つき）',
  summary: '動画を1本と、見出し・2行の説明・注意の一行。動画は入れた人が差し替えます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      '<div class="b-wrap">' +
      `<video controls playsinline preload="metadata" poster="${IMAGE_PLACEHOLDER}"></video>` +
      '<span class="b-min">再生時間 2分10秒</span>' +
      '<h2 class="b-head">開けてから使いはじめるまでを、そのまま撮りました</h2>' +
      '<p class="b-text">箱を開けるところから、1回目を使い終わるまでを編集せずに収めています。' +
      '手順の紙を読まなくても、この動画のとおりに進めれば同じところまで届きます。</p>' +
      '<p class="b-note">音が出ます。はじめは音量を下げてご覧ください。通信量がかかるため、Wi-Fiでのご視聴をおすすめします。</p>' +
      '</div>',
  }),
}

/**
 * 新しい見本「複数選べるアンケート（→お礼）」（2026-09-23）。
 *
 * 当てはまるものをいくつでも選べる形。選択肢は `<label>` で `<input type="checkbox">` を包んでいるので、
 * id を使わずに文字のどこを押してもチェックが入る（同じLPに2つ入れても重ならない）。
 * 選び終えたら「次へ」でお礼の画面に切り替わる。リンク先は仮（入れた人がWidget編集で入れる）。
 */
import { SCREENS_SCRIPT } from '../templates/builder.ts'
import { CHECK, CHEVRON_RIGHT, INK, INK_SUB, LINE, LINE_LIGHT, sampleHtml, screen, type NewSample } from './kit.ts'

const UID = 'nc-g0000005'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  // 設問
  `${s} .k-ask{font-size:21px;font-weight:800;line-height:1.55;max-width:520px;margin:0 auto 6px}` +
  `${s} .k-note{font-size:13px;line-height:1.7;color:${INK_SUB};max-width:520px;margin:0 auto 18px}` +
  // 選択肢（ラベルでチェックボックスを包む。文字のどこを押しても入る）
  `${s} .k-list{max-width:520px;margin:0 auto;border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .k-opt{position:relative;display:flex;align-items:center;gap:14px;min-height:58px;padding:12px 6px;` +
  `border-bottom:1px solid ${LINE_LIGHT};cursor:pointer;-webkit-tap-highlight-color:transparent}` +
  `${s} .k-opt:hover{background:#F5F9FF}` +
  `${s} .k-opt__in{position:absolute;left:6px;top:50%;width:1px;height:1px;margin:0;padding:0;border:0;opacity:0}` +
  `${s} .k-opt__box{flex:0 0 24px;display:flex;align-items:center;justify-content:center;width:24px;height:24px;` +
  `border:1.5px solid ${LINE};border-radius:6px;background:#FFFFFF;` +
  `transition:background .12s ease,border-color .12s ease}` +
  `${s} .k-opt__box svg{width:14px;height:14px;color:#FFFFFF;opacity:0;transition:opacity .12s ease}` +
  `${s} .k-opt__in:checked + .k-opt__box{border-color:${ACCENT};background:${ACCENT}}` +
  `${s} .k-opt__in:checked + .k-opt__box svg{opacity:1}` +
  `${s} .k-opt__in:focus-visible + .k-opt__box{outline:3px solid ${ACCENT};outline-offset:2px}` +
  `${s} .k-opt__text{flex:1;min-width:0;font-size:15.5px;font-weight:700;line-height:1.7;color:${INK}}` +
  // 次へ
  `${s} .k-next{display:flex;width:100%;max-width:520px;margin:22px auto 0;align-items:center;justify-content:center;` +
  `gap:10px;min-height:60px;padding:16px 24px;border:0;border-radius:10px;background:${ACCENT};color:#FFFFFF;` +
  `font:800 18px/1.4 inherit;cursor:pointer;box-shadow:0 4px 0 #185FB0;` +
  `transition:transform .12s ease,box-shadow .12s ease}` +
  `${s} .k-next:active{transform:translateY(3px);box-shadow:0 1px 0 #185FB0}` +
  `${s} .k-next:focus-visible{outline:3px solid #14508F;outline-offset:3px}` +
  `${s} .k-next svg{flex:0 0 18px;width:18px;height:18px}` +
  `${s} .k-skip{margin:12px 0 0;font-size:12.5px;line-height:1.7;color:${INK_SUB};text-align:center}` +
  // お礼の画面
  `${s} .k-done{font-size:21px;font-weight:800;line-height:1.5;text-align:center;margin:0 0 10px}` +
  `${s} .k-done-note{font-size:14.5px;line-height:1.85;color:${INK_SUB};text-align:center;` +
  `max-width:520px;margin:0 auto 22px}` +
  `${s} .k-cta{display:flex;width:100%;max-width:520px;margin:0 auto;align-items:center;justify-content:center;` +
  `gap:10px;min-height:60px;padding:16px 24px;border-radius:10px;background:${ACCENT};color:#FFFFFF;` +
  `font:800 18px/1.4 inherit;text-decoration:none;box-shadow:0 4px 0 #185FB0;` +
  `transition:transform .12s ease,box-shadow .12s ease}` +
  `${s} .k-cta:active{transform:translateY(3px);box-shadow:0 1px 0 #185FB0}` +
  `${s} .k-cta:focus-visible{outline:3px solid #14508F;outline-offset:3px}` +
  `${s} .k-cta svg{flex:0 0 18px;width:18px;height:18px}` +
  `${s} .k-fine{margin:14px 0 0;font-size:12.5px;line-height:1.7;color:${INK_SUB};text-align:center}` +
  `@media (max-width:480px){${s} .k-ask{font-size:19px}${s} .k-opt__text{font-size:15px}${s} .k-done{font-size:19px}}` +
  `@media (prefers-reduced-motion:reduce){${s} .k-opt__box,${s} .k-opt__box svg,${s} .k-next,${s} .k-cta{transition:none}}`

/** 選択肢1つ（ラベルで包むので id は使わない） */
const option = (text: string): string =>
  '<label class="k-opt">' +
  '<input type="checkbox" class="k-opt__in">' +
  `<span class="k-opt__box">${CHECK}</span>` +
  `<span class="k-opt__text">${text}</span>` +
  '</label>'

export const SURVEY_MULTI_SAMPLE: NewSample = {
  id: 'survey-multi',
  category: 'アンケート・診断',
  name: '複数選べるアンケート（→お礼）',
  summary: '当てはまるものをいくつでも選べます。「次へ」でお礼の画面に移ります',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    screens: { transition: 'fade', script: SCREENS_SCRIPT },
    body:
      screen(
        's1',
        '設問①',
        '<h2 class="k-ask">当てはまるものを、すべて選んでください</h2>' +
          '<p class="k-note">いくつでも選べます。選び終えたら、下の「次へ」を押してください。</p>' +
          '<div class="k-list">' +
          option('平日の夜に使うことが多い') +
          option('休みの日にまとめて使いたい') +
          option('スマートフォンから使いたい') +
          option('家族や同僚と一緒に使いたい') +
          option('まだ決めていない') +
          '</div>' +
          `<button type="button" class="k-next" data-nc-go="s2"><span>次へ</span>${CHEVRON_RIGHT}</button>` +
          '<p class="k-skip">当てはまるものが無いときは、そのまま次へ進めます。</p>',
        { first: true },
      ) +
      screen(
        's2',
        'お礼',
        '<h2 class="k-done">ご回答ありがとうございました</h2>' +
          '<p class="k-done-note">選んでいただいた使い方に合わせて、続きをご用意しました。下のボタンからご覧いただけます。</p>' +
          `<a class="k-cta" href="ooooo"><span>続きを見る</span>${CHEVRON_RIGHT}</a>` +
          '<p class="k-fine">ご覧いただくだけなら費用はかかりません。</p>',
      ),
  }),
}

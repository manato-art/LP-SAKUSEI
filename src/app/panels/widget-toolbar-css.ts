/**
 * Widget編集の書式ツールバーの見た目（2026-09-24・本人が見せたデザインに合わせた）。
 *
 * 角の丸い白い帯（細い枠と薄い影）の中に、元に戻す・やり直す（丸い灰色）｜フォント・文字の大きさ（枠つき）｜
 * 書式のボタン（地なし・乗せると灰色）｜注意書き、を1行に並べる。
 * `<style>` で入れる（:hover と、幅が足りないとき注意書きを次の行へ回す @container のため）。
 * ダークでも白のまま（周りの見たまま画面・ヘッダーはインラインstyleでダークにならないので、帯だけ黒いと浮く。
 * 以前の帯もインラインstyleで白のままだった）→ dark-runtime-css.ts の上書きの対象から外す。
 * スマホは mobile-css.ts が1行の横スクロールにし、左右の余白を外す。
 */
import { FONT } from './widget-editor-theme.ts'

const STYLE_ID = 'widget-toolbar-css'

/**
 * 注意書きまで1行に収まる、帯の中身の幅（padding の内側。実測で約1,075px＋フォントの差の分）。
 * これより狭いと、注意書きは区切り線を外して右寄せで次の行へ（区切り線だけが行の頭に残らないように）
 */
const ONE_LINE_MIN_WIDTH = 1110

const LINE = '#E3E5E9'
const INK = '#3F4450'

const CSS = `
.wtb{container:wtb/inline-size;display:flex;flex-wrap:wrap;align-items:center;gap:4px;flex-shrink:0;
  margin:10px 12px 6px;padding:7px 12px;min-height:46px;box-sizing:border-box;background:#fff;
  border:1px solid ${LINE};border-radius:14px;box-shadow:0 3px 14px rgba(16,24,40,.05);color:${INK};font-family:${FONT}}
.wtb__btn{display:inline-flex;align-items:center;justify-content:center;gap:1px;flex-shrink:0;width:30px;height:30px;padding:0;
  border:none;border-radius:8px;background:transparent;color:${INK};cursor:pointer;
  transition:background-color .15s ease,transform .1s ease}
.wtb__btn:hover{background:#F2F3F5}
.wtb__btn:active{transform:scale(.94)}
.wtb__btn:focus-visible,.wtb__font:focus-visible,.wtb__size button:focus-visible{outline:2px solid var(--sb-accent,#0091FF);outline-offset:1px}
.wtb__btn svg{width:16px;height:16px;flex-shrink:0}
.wtb__btn--round{border-radius:50%;background:#F3F4F6}
.wtb__btn--round:hover{background:#E8EAEE}
.wtb__btn--menu{width:40px}
.wtb__btn--menu svg{width:auto}
.wtb__sep{width:1px;height:22px;margin:0 10px;background:${LINE};flex-shrink:0}
.wtb__font{display:inline-flex;align-items:center;justify-content:space-between;gap:12px;height:30px;min-width:92px;
  padding:0 9px 0 12px;box-sizing:border-box;border:1px solid ${LINE};border-radius:8px;background:#fff;color:${INK};
  font:13px/1 ${FONT};white-space:nowrap;cursor:pointer}
.wtb__font:hover{background:#FAFAFB}
.wtb__size{display:inline-flex;align-items:stretch;height:30px;margin-left:10px;box-sizing:border-box;flex-shrink:0;
  border:1px solid ${LINE};border-radius:8px;overflow:hidden;background:#fff}
.wtb__size button{display:inline-flex;align-items:center;justify-content:center;width:29px;height:auto;padding:0;border:none;
  border-radius:0;background:transparent;color:#5B616E;cursor:pointer}
.wtb__size button:hover{background:#F5F6F8}
.wtb__size svg{width:13px;height:13px}
.wtb__size-num{display:flex;align-items:center;justify-content:center;min-width:38px;padding:0 4px;box-sizing:border-box;
  border-left:1px solid #EEF0F2;border-right:1px solid #EEF0F2;font:13px/1 ${FONT};color:${INK};font-variant-numeric:tabular-nums}
.wtb__note{margin-left:auto;padding-left:14px;border-left:1px solid ${LINE};color:#9AA0A8;font:11px/22px ${FONT};white-space:nowrap}
@container wtb (max-width:${ONE_LINE_MIN_WIDTH}px){.wtb__note{flex-basis:100%;padding-left:0;border-left:none;text-align:right}}
`

export function ensureWidgetToolbarCss(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.dataset['darkRuntime'] = 'skip'
  style.textContent = CSS
  document.head.append(style)
}

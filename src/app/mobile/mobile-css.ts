/**
 * スマホ用の土台CSS（2026-09-13）。
 *
 * すべて `@media (max-width: 768px)` の中だけに書く＝**PCの見た目は一切変えない**。
 * 方針（過去の指示）:
 *   - PCの縮小版にしない。縦スクロールの回数を減らす
 *   - 左右の余白を作らない（画面幅をいっぱいに使う）
 *   - タップは44px、入力の文字は16px（iOSが勝手に拡大するのを防ぐ）
 *   - ホームバーのぶんの余白（safe-area）を空ける
 */
import { MOBILE_MAX_WIDTH } from './viewport.ts'

const STYLE_ID = 'sb-mobile-css'

/** 下部タブバーの高さ（本文の下余白と合わせる） */
export const BOTTOM_NAV_HEIGHT = 56

export function mobileCss(): string {
  return [
    `@media (max-width:${MOBILE_MAX_WIDTH}px){`,
    // PC用の細いレールは出さない（切れたラベルが並ぶだけで使えない）。代わりに下部タブバー。
    `.sb-rail{display:none !important}`,
    // 本文は画面幅いっぱい。下部タブバーのぶんだけ下に余白を空ける
    `.sb-shell-content{padding-bottom:calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom,0px)) !important}`,
    // 採取CSSがPC幅を前提に置いている左右余白・最大幅を外す
    `.sb-mobile-page{padding-left:0 !important;padding-right:0 !important;max-width:100% !important}`,
    // タップしやすい大きさ（Appleの目安44px）
    `.sb-mobile-tap{min-height:44px}`,
    // iOSは16px未満の入力にズームするので、拡大されないようにする
    `input,select,textarea{font-size:16px !important}`,
    `}`,
  ].join('')
}

/** スマホ用CSSを1回だけ差し込む */
export function ensureMobileCss(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = mobileCss()
  document.head.append(style)
}

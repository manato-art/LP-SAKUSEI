/**
 * アプリのエラー画面（採取ルート `global/app-error`）。
 *
 * **これはバグの再現であって、クローンの不具合ではない。**
 * docs/findings-live-observation.md に記録のとおり、実物は
 * 「テキストを選択していない状態でリンクツールを押す」とアプリ全体がクラッシュし、
 * `#root` の中身がまるごとこのエラーパネルに置き換わる（サイドバーも消える）。
 * 企画書 §3-5「勝手にUIを改善しない」に従い、同じ条件で同じ画面を出す。
 *
 * 見た目は採取済みの実CSS（`/assets/css/index-cb391eb6.css` の `_errorPanel_1xgol_1`）が担保する。
 * 実物と同じくリロードでしか復帰しない（ハッシュを変えても戻らない）。
 */
import errorHtml from './fragments/global__app-error.html?raw'

export function showAppError(): void {
  const root = document.querySelector<HTMLElement>('#root')
  if (root === null) {
    console.warn('[crash] #root が無いのでエラー画面を出せない')
    return
  }
  // 実物の app-error は `#root` 直下がエラーパネル1枚だけ。余白も足さない（採取どおり）。
  root.innerHTML = errorHtml
}

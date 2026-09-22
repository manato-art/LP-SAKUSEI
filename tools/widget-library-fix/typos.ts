/**
 * 見本（SB由来）のスクリプトそのものの打ち間違い・書き間違いを直す（2026-09-22・全件点検で見つかった5件）。
 *
 * - 「右寄せのシンプルなページ上部へ戻るテキスト」: addEventListEner（大文字のE）で押しても何も起きなかった
 * - 「リンクでアンケート（複数選択風）」: 選ぶまで次へを押せない判定が is-desabled（付く名前は is-disabled）で、
 *   選ばなくても次へ進めていた
 * 決まった書き間違いだけを、そのままの形で直す（ほかの所は触らない）。
 */
const TYPOS: readonly (readonly [string, string])[] = [
  // 出来事の名前（'click'）も抜けていた方を先に直す
  ['.addEventListEner((e) =>', ".addEventListener('click', (e) =>"],
  ['.addEventListEner(', '.addEventListener('],
  ["classList.contains('is-desabled')", "classList.contains('is-disabled')"],
  // 「評価ランキング表（1列目固定・横スク対応・スクロールヒント表示）」: 無い変数 slider を見ていた（表は el）
  ['_.lazyImgLoaded(slider.querySelectorAll("img, video"), _.scrollHint(el));', '_.lazyImgLoaded(el.querySelectorAll("img, video"), _.scrollHint(el));'],
  // 「上下左右スクロールできる絞り込み検索付きの表」: forEach の戻り（undefined）を Array.from に渡していた
  ['Array.from(document.querySelectorAll(target).forEach(el => _.filterTable(el)));', 'document.querySelectorAll(target).forEach(el => _.filterTable(el));'],
]

export function fixKnownTypos(html: string): string {
  let out = html
  for (const [wrong, right] of TYPOS) out = out.split(wrong).join(right)
  return out
}

/**
 * 画面（ルート）ごとの寿命（2026-10-25 本人「クロームのメモリ見たら1.2Gだった。重すぎない？」）。
 *
 * 画面全体（document・window）への見張りやタイマーは、画面を移ったら外す。外さないと、見張りの中の処理が覚えている
 * 前の画面（LPの編集画面なら Quill と LPの中身ごと）をつかみ続け、行き来するたびにメモリに溜まる。
 * 足すときは `document.addEventListener(type, fn, { signal: pageLife() })` のように、いまの画面の寿命を渡す
 * （tests/no-page-listener-leak.test.ts が見張る）。
 */
let current = new AbortController()

/** 新しい画面を描く前に呼ぶ（前の画面の寿命を止め、新しい寿命を始める）。main.ts の route だけが呼ぶ */
export function startPageLife(): AbortSignal {
  current.abort()
  current = new AbortController()
  return current.signal
}

/** いま描いている画面の寿命 */
export function pageLife(): AbortSignal {
  return current.signal
}

/**
 * 「見本から作る」の流れ（2026-09-22・本人の依頼。ノーコードでWidgetを作る①）。
 *
 * ノーコードの入口で「見本を選ぶ」を押した人だけ、見本を「追加」したあとに
 * そのまま編集画面（見たまま編集＋要素ごとのカード）を開く。
 * 今までの「追加」を押した人の動きは変えない（1回だけの合図にしてある）。
 */

let armed = false

/** 次の「追加」のあとに編集画面を開く */
export function armEditAfterInsert(): void {
  armed = true
}

/** 開くべきかを1回だけ答える（答えたら合図を下ろす） */
export function consumeEditAfterInsert(): boolean {
  const was = armed
  armed = false
  return was
}

/** 合図を取り消す（入口を閉じた・別の操作に移ったとき） */
export function disarmEditAfterInsert(): void {
  armed = false
}

/** 足す前に無かったものを返す（いま足したWidgetを見つける）。増えていなければ null */
export function newestNode<T>(before: readonly T[], after: readonly T[]): T | null {
  const seen = new Set(before)
  return after.find((node) => !seen.has(node)) ?? null
}

/** 名前の初期値の長さ（一覧のカードに収まる程度） */
const NAME_MAX = 20

/**
 * 「Widgetとして登録」の名前の初期値。
 * 見本から作ったなら見本の名前、分からなければ中の文字の頭、それも無ければ「Widget」。
 * 今までは最初のクラス名（例: MuiBox-root）が出ていて、コードを知らない人には意味が分からなかった。
 */
export function defaultRegisterName(knownTitle: string | undefined, visibleText: string): string {
  const title = (knownTitle ?? '').trim()
  if (title !== '') return title
  const text = visibleText.replace(/\s+/g, ' ').trim()
  return text === '' ? 'Widget' : Array.from(text).slice(0, NAME_MAX).join('').trim()
}

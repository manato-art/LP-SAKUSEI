/**
 * 「部品を積んで作る」で見本を選ぶ流れ（2026-09-22・本人の依頼）。
 *
 * 「見本」の部品を足すと、いつもの見本の一覧（Widgetの最初の画面）に戻る。そこで「追加」を押すと、
 * LPには入れずに、その見本を部品として受け取る（1回だけの合図。普段の「追加」の動きは変えない）。
 * 以前あった「見本から作る」タブ（見本を追加→そのまま編集画面）は、本人の依頼で消した
 * （「Widgetの最初の画面と同じだからいらない」）。
 */

/** 見本を受け取る先 */
export type SamplePick = (sample: { title: string; html: string }) => void

let pending: SamplePick | null = null

/** 次の「追加」を部品に回す */
export function armSamplePick(receive: SamplePick): void {
  pending = receive
}

/** 部品に回すなら受け取る先を返す（返したら合図を下ろす）。普段は null */
export function takeSamplePick(): SamplePick | null {
  const receive = pending
  pending = null
  return receive
}

/** いま「部品にする見本」を選んでもらっている途中か（一覧のほかのボタンを出し分けるのに使う） */
export function isSamplePickArmed(): boolean {
  return pending !== null
}

/** 選ぶのをやめた・一覧を閉じた */
export function cancelSamplePick(): void {
  pending = null
}

/** 名前の初期値の長さ（一覧のカードに収まる程度） */
const NAME_MAX = 20

/**
 * 「Widgetとして登録」の名前の初期値。
 * 型の名前などが分かればそれ、分からなければ中の文字の頭、それも無ければ「Widget」。
 * 以前は最初のクラス名（例: MuiBox-root）が出ていて、コードを知らない人には意味が分からなかった。
 */
export function defaultRegisterName(knownTitle: string | undefined, visibleText: string): string {
  const title = (knownTitle ?? '').trim()
  if (title !== '') return title
  const text = visibleText.replace(/\s+/g, ' ').trim()
  return text === '' ? 'Widget' : Array.from(text).slice(0, NAME_MAX).join('').trim()
}

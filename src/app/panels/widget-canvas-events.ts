/**
 * 見たまま画面（contentDiv）の中身を道具（ツールバー・画像の操作パネル・リンクの吹き出し・
 * 並んだ部品の操作ボタン・要素ごとのカード）が書き換えたことを知らせる（2026-09-24・第3弾）。
 *
 * 以前は素の `input` イベントを投げていた。いまは「どの要素を変えたか」を添える
 * （部品で作ったWidgetは、その要素の部品だけを設定データへ読み戻すため。widget-studio-builder.ts）。
 * 聞く側は今までどおり `input` で受け取れる（CustomEvent も Event）。
 */
export interface CanvasEditDetail {
  /** 変えた要素（分からなければ undefined＝いま文字を打っている所とみなす） */
  readonly target?: Node
}

export function notifyCanvasEdit(contentDiv: HTMLElement, target?: Node): void {
  contentDiv.dispatchEvent(new CustomEvent<CanvasEditDetail>('input', { bubbles: true, detail: { target } }))
}

/** `input` イベントに添えられた「変えた要素」（素の input なら undefined） */
export function canvasEditTarget(event: Event): Node | undefined {
  const detail = (event as CustomEvent<CanvasEditDetail | null>).detail
  return detail === null || detail === undefined ? undefined : detail.target
}

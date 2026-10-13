/**
 * 採取したドロップダウン（レポート／ヒートマップの「ソート」「広告データ取得日時」など）の面を、見える範囲に収める。
 *
 * 採取CSSは、面をトリガーの左端から右へ開く。トリガーが画面の右端にあると、面は画面の外や
 * 「はみ出しを隠す枠」の外へ出て、右側が切れて読めなかった（2026-10-13 スクリーンショットで確認:
 * ソートの一覧は丸い印しか見えず、広告データ取得日時の面は右178pxが切れていた）。
 * 開いたときに測り、右へはみ出すなら右端をそろえて左へ開く。
 */

export interface DropdownMeasure {
  /** 開いた面の右端 */
  bodyRight: number
  /** 見える範囲の右端（画面の幅と、はみ出しを隠す祖先の右端の小さいほう） */
  visibleRight: number
}

/** はみ出しを隠す（visible 以外の）overflow-x */
const CLIPS = /hidden|clip|auto|scroll/

export function measureDropdown(body: HTMLElement): DropdownMeasure {
  let visibleRight = window.innerWidth
  for (let node = body.parentElement; node !== null && node !== document.body; node = node.parentElement) {
    if (CLIPS.test(getComputedStyle(node).overflowX)) {
      visibleRight = Math.min(visibleRight, node.getBoundingClientRect().right)
    }
  }
  return { bodyRight: body.getBoundingClientRect().right, visibleRight }
}

/** 面を開いた直後に呼ぶ（表示されていないと測れない） */
export function keepDropdownVisible(
  body: HTMLElement,
  measure: (body: HTMLElement) => DropdownMeasure = measureDropdown,
): void {
  // いったん採取CSSの置き方（右へ開く）に戻してから測る。前に左へ開いたままだと、広い画面に変えても戻らない
  body.style.left = ''
  body.style.right = ''
  const { bodyRight, visibleRight } = measure(body)
  if (bodyRight <= visibleRight) return
  body.style.left = 'auto'
  body.style.right = '0'
}

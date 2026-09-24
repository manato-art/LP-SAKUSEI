/**
 * ページ画面の「いま選んでいる表示のしかた」（画面の描き直し・フォルダの切り替えをまたいで保つ）。
 *
 * 以前はフォルダ検索の文字が、フォルダを押して描き直したあとも見えないまま効き続け、
 * 次に虫眼鏡を押すと「開く」ではなく「消す」になっていた。配信ステータスも同じく、
 * 選んだ値は残るのに行には効いていなかった。描き直すたびにここから入力欄・ラベル・行を作り直す。
 *
 * `let` を直接 export すると取り込み先から代入できないので、読み書きは関数を通す。
 */
import type { SortKey, StatusFilter } from './folders-list-view.ts'

interface ListState {
  status: StatusFilter
  sort: SortKey
  /** ページ名の検索（フォルダ内検索）。null＝検索欄を閉じている */
  pageQuery: string | null
  /** フォルダツリーの検索。null＝検索欄を閉じている */
  treeQuery: string | null
}

let state: ListState = { status: 'all', sort: 'updated', pageQuery: null, treeQuery: null }

export function listState(): Readonly<ListState> {
  return state
}

export function updateListState(patch: Partial<ListState>): void {
  state = { ...state, ...patch }
}

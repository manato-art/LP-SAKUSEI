/**
 * 「フォルダなし」（2026-09-24・本人の決定「フォルダを消してもページは残す」）。
 *
 * フォルダを消すと、中のページは消えずに folder_id が null になる。
 * それを一覧で探して移したり管理したりできるよう、フォルダツリーに「フォルダなし」を1つ出す。
 * 画面のURL（`#/folders?uid=unfiled`）と、フォルダ配下の集計API（`/folders/unfiled/...`）で同じ名前を使う。
 * 実在するフォルダの uid（`FOLDER_0001` やUUID形式）とは重ならない。
 */
export const UNFILED_FOLDER_UID = 'unfiled'

export const UNFILED_FOLDER_NAME = 'フォルダなし'

/**
 * 「フォルダなし」を一覧に出すか（2026-10-28 本人「中にページがあるときだけ出す」）。
 * ふだんは出さない。中にページがあるときと、いま「フォルダなし」を開いているとき
 * （フォルダの無いページのパンくずから来たとき）だけ出す。PCの左の一覧とスマホのフォルダのカードで同じ決まり。
 */
export function isUnfiledShown(hasPages: boolean, selectedUid: string | null): boolean {
  return hasPages || selectedUid === UNFILED_FOLDER_UID
}

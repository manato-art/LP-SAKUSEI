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

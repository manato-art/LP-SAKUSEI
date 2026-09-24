/**
 * このタブの印（2026-09-24）。サーバーへの要求に `X-Editor-Session` として添える。
 *
 * 同じVersionを2人（2つのタブ）で直しているとき、別のタブが先に保存したかを見分けるのに使う
 * （自分のタブのリンク置換・履歴の復元で中身の版が進んだぶんは、ぶつかったことにしない）。
 */
const SESSION = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`

export const EDITOR_SESSION_HEADER = 'X-Editor-Session'

export function editorSessionHeaders(): Record<string, string> {
  return { [EDITOR_SESSION_HEADER]: SESSION }
}

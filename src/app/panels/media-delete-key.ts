/**
 * 選んだ画像・動画を消すキー（2026-10-24 本人「画像にカーソルが合わさっていても、バックキーやデリートキーで消えない」）。
 * 修飾キーつき（⌘+Backspace＝行を消す など）と、日本語の変換中は消さない。
 */
export function isMediaDeleteKey(event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'isComposing'>): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return false
  return event.key === 'Backspace' || event.key === 'Delete'
}

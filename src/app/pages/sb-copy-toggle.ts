/**
 * 見出しの「保存済み」の左に置く「SBコピー」のチェック（2026-10-31 本人「保存済みの左のところに SBコピーってボタン設けて
 * チェック入ってるなら、維持するとか特別な処理にするのはどうかな」）。
 *
 * チェックを入れて貼ると、SB の飾り（色・下線・マーカー・太字・大きさを変えた所）を残す（paste-sb-format.ts）。
 * 外すと今までどおり文字だけ。本人の選択＝開くたびに外れる（覚えておかない）。
 */
export interface SbCopyToggle {
  readonly el: HTMLElement
  readonly checked: () => boolean
}

export function createSbCopyToggle(): SbCopyToggle {
  const label = document.createElement('label')
  label.className = 'sb-copy-toggle'
  label.title = 'チェックを入れて貼ると、SBの色・下線・マーカー・太字をそのまま残します（文字の土台はLP設定のまま・リンクは付けません）。画面を開き直すと外れます'
  label.style.cssText =
    'display:inline-flex;align-items:center;gap:5px;margin-right:12px;font-size:12px;color:#4B5563;cursor:pointer;' +
    'user-select:none;white-space:nowrap'
  const box = document.createElement('input')
  box.type = 'checkbox'
  box.setAttribute('data-clone-sb-copy', 'true')
  box.style.cssText = 'margin:0;width:14px;height:14px;cursor:pointer'
  label.append(box, document.createTextNode('SBコピー'))
  return { el: label, checked: () => box.checked }
}

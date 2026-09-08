/**
 * コードエディタの選択範囲スタイル（指示177）。
 *
 * このアプリのコードエディタは「textarea を `color:transparent` にして、真下の <pre> に
 * 色付きのコードを描く」方式で作られている。この作りだと、選択したときにブラウザが
 * 不透明な選択背景を塗るため、**下の色付きコードが完全に隠れて何も見えなくなる**
 * （症状: 選択はできるが文字が背景と同化して読めない）。
 *
 * 対処は2つセットで必要:
 *   1. 選択背景を半透明にして、下のコードを透かす
 *   2. 選択時の文字色も透明に固定する（ブラウザが選択文字へ既定色＝黒を当ててくるため）
 */
const CSS_ID = 'sb-code-selection-css'
const CLASS = 'sb-code-textarea'

function injectStyles(): void {
  if (document.getElementById(CSS_ID) !== null) return
  const s = document.createElement('style')
  s.id = CSS_ID
  s.textContent = `
    .${CLASS}::selection { background: rgba(88,150,255,.34); color: transparent; }
    .${CLASS}::-moz-selection { background: rgba(88,150,255,.34); color: transparent; }
  `
  document.head.append(s)
}

/** 透明テキスト方式のコードエディタ textarea に、読める選択範囲スタイルを付ける。 */
export function applyCodeSelectionStyle(textarea: HTMLTextAreaElement): void {
  injectStyles()
  textarea.classList.add(CLASS)
}

/**
 * コード欄を丸ごと写す「コピー」ボタン（2026-09-14・本人指示）。
 *
 * HTML/CSS/JavaScript の欄は長いので、指やマウスで選び直すのが大変だった。
 * どの画面でも同じ見た目・同じ手応えにしたいので、部品はここ1つに置く。
 *
 * - 押すと欄の中身をまるごとクリップボードへ入れ、ボタンの文字が一瞬「コピーしました」に変わる
 * - 空のときは「コピーした」と嘘をつかず、そのまま知らせる
 * - アイコンは絵文字でなくSVG（プロジェクト共通の決まり）
 */
import { T, toast } from '../ui.ts'

/** 2枚重ねの紙＝コピーの図。線だけで描くので、明るい面でも暗い面でも見える */
const COPY_ICON =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="9" y="9" width="12" height="12" rx="2"/>' +
  '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'

export interface CodeCopyOptions {
  /** 暗い背景のコード欄に置くとき（Widget編集・Widget作成） */
  readonly dark?: boolean
  /** ボタンの文字。既定は「コピー」 */
  readonly label?: string
}

/** コピー元。textarea を渡すと、最後の手段としてその中身を選択状態にできる */
export type CodeSource = HTMLTextAreaElement | (() => string)

/**
 * クリップボードへ入れる。
 *
 * `navigator.clipboard` は **安全でない接続・権限が無い埋め込み・古い端末では拒否される**
 * （2026-09-14 に埋め込みブラウザで実際に拒否された）。押したのに何も起きないのが一番困るので、
 * 昔ながらの `execCommand('copy')` まで落ちてから諦める。
 */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // 続けて代替手段を試す
  }
  const helper = document.createElement('textarea')
  helper.value = text
  helper.setAttribute('readonly', '')
  helper.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;border:none'
  document.body.append(helper)
  try {
    helper.focus()
    helper.setSelectionRange(0, text.length)
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    helper.remove()
  }
}

/**
 * コード欄の中身を丸ごとコピーするボタンを作る。
 * textarea は後から書き換わるので、値ではなく「取り出し方」を受け取る。
 */
export function codeCopyButton(source: CodeSource, options: CodeCopyOptions = {}): HTMLButtonElement {
  const getText = typeof source === 'function' ? source : (): string => source.value
  const sourceEl = typeof source === 'function' ? null : source
  const label = options.label ?? 'コピー'
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.dataset['codeCopy'] = 'true'
  btn.title = 'コード全体をコピー'
  btn.setAttribute('aria-label', 'コード全体をコピー')
  btn.style.cssText = [
    'display:inline-flex;align-items:center;gap:5px;flex-shrink:0',
    'padding:5px 10px;border-radius:6px;cursor:pointer',
    `font:12px/1 ${T.font}`,
    options.dark === true
      ? 'border:1px solid #555;background:#2B2B2B;color:#eee'
      : `border:1px solid ${T.line};background:${T.surface};color:${T.text}`,
  ].join(';')
  btn.innerHTML = `${COPY_ICON}<span data-code-copy-label>${label}</span>`

  // 押しても編集中の選択が外れないようにする（PCのmousedownだけ止める。
  // touchstart を止めるとスマホで click が発火しない＝2026-09-14に実機で踏んだ罠）
  btn.addEventListener('mousedown', (event) => event.preventDefault())

  const flash = (text: string): void => {
    const labelEl = btn.querySelector<HTMLElement>('[data-code-copy-label]')
    if (labelEl === null) return
    labelEl.textContent = text
    window.setTimeout(() => { labelEl.textContent = label }, 1400)
  }

  btn.addEventListener('click', () => {
    const text = getText()
    if (text.trim() === '') {
      toast('コピーするコードがありません', 'error')
      return
    }
    void writeClipboard(text).then((ok) => {
      if (ok) {
        toast('コピーしました')
        flash('コピーしました')
        return
      }
      // どうしても入らない端末では、せめて全部を選んだ状態にして手で写せるようにする
      if (sourceEl !== null) {
        sourceEl.focus()
        sourceEl.setSelectionRange(0, sourceEl.value.length)
        toast('全部を選びました。長押し（右クリック）でコピーしてください', 'error')
        return
      }
      toast('コピーに失敗しました', 'error')
    })
  })

  return btn
}

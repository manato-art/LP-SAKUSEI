/**
 * Widget の <script> をプレビュー内で実行する（指示146: 動作確認のため。widget-editor.ts から分離）。
 *
 * innerHTML で挿入された <script> は実行されないので、実行可能な <script> を作り直して差し込む。
 * 多くのSBウィジェットは `DOMContentLoaded` で init するが、編集画面では既に発火済みのため、
 * 実行中だけ addEventListener('DOMContentLoaded'|'load') を「即時実行」に差し替えて init を走らせる。
 * 実行はユーザー自身のウィジェット内容（配信でも同じスクリプトが動く）なので信頼して実行する。
 * 部品で作ったWidgetは描き直すたびに新しい要素になるので、そのたびに呼ぶ（widget-studio-builder.ts）。
 */
export function runWidgetScripts(contentDiv: HTMLElement): void {
  const scripts = [...contentDiv.querySelectorAll('script')]
  if (scripts.length === 0) return

  const docAdd = document.addEventListener.bind(document)
  const winAdd = window.addEventListener.bind(window)
  const fireNow = (fn: EventListenerOrEventListenerObject, type: string): void => {
    try {
      const ev = new Event(type)
      if (typeof fn === 'function') fn(ev)
      else fn.handleEvent(ev)
    } catch {
      /* 個別ウィジェットの初期化失敗は握って他へ波及させない */
    }
  }
  const patch = (orig: typeof document.addEventListener) =>
    ((type: string, fn: EventListenerOrEventListenerObject, opts?: unknown) => {
      if ((type === 'DOMContentLoaded' || type === 'load') && fn !== null) {
        fireNow(fn, type)
        return
      }
      ;(orig as (t: string, f: EventListenerOrEventListenerObject, o?: unknown) => void)(type, fn, opts)
    }) as typeof document.addEventListener
  document.addEventListener = patch(docAdd)
  window.addEventListener = patch(winAdd)
  try {
    for (const old of scripts) {
      // 設定データなど、動かさないスクリプトはそのまま
      const type = old.getAttribute('type') ?? ''
      if (type !== '' && !/javascript|ecmascript|^module$/i.test(type)) continue
      const s = document.createElement('script')
      for (const attr of old.attributes) s.setAttribute(attr.name, attr.value)
      s.textContent = old.textContent
      old.replaceWith(s) // 差し替えで同期実行される
    }
  } finally {
    document.addEventListener = docAdd
    window.addEventListener = winAdd
  }
}

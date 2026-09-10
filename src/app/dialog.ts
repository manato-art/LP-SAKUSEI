/**
 * アプリ内のダイアログ（確認カード・入力カード）。
 *
 * ブラウザの `confirm()` / `prompt()` は
 *   - 「lp-sakusei-production.up.railway.app の内容」という素の見出しが出る
 *   - 見た目がアプリから浮く／テーマカラーも効かない
 *   - 文言を整えられない（改行・強調・補足が置けない）
 * ので使わない。ここに置いた2つで置き換える。
 *
 *   confirmCard … はい/いいえ。消す操作は赤で出す（danger）
 *   promptCard  … 1行の入力を受け取る
 *
 * どちらも Esc と背景クリックで取り消し、Enter で決定。
 * キーボードの移動はカードの中だけを回る（後ろの画面へ抜けない）。
 */
import { T } from './ui.ts'

export interface ConfirmOptions {
  /** カードの見出し。省略すると本文だけの素朴な見た目になる */
  title?: string
  message: string
  /** 補足（小さく薄い字。取り返しが付かないことなどを書く） */
  detail?: string
  submitLabel?: string
  cancelLabel?: string
  /** 消す・元に戻せない操作。ボタンを赤にして注意アイコンを出す */
  danger?: boolean
}

export interface PromptOptions {
  title: string
  /** 入力欄の上に出す見出し */
  label?: string
  value?: string
  placeholder?: string
  submitLabel?: string
  /** 入力が不正なら理由を返す。null なら通す */
  validate?: (value: string) => string | null
}

/** はい/いいえの確認。取り消しなら false。 */
export function confirmCard(
  messageOrOptions: string | ConfirmOptions,
  submitLabel = 'OK',
): Promise<boolean> {
  const options: ConfirmOptions =
    typeof messageOrOptions === 'string'
      ? { message: messageOrOptions, submitLabel }
      : messageOrOptions
  return new Promise((resolve) => {
    const { overlay, card, footer, close } = buildShell(() => resolve(false))

    if (options.title !== undefined) {
      card.append(header(options.title, options.danger === true))
    }
    const body = div('sbd-body')
    body.textContent = options.message
    card.append(body)
    if (options.detail !== undefined) {
      const detail = div('sbd-detail')
      detail.textContent = options.detail
      card.append(detail)
    }
    card.append(footer)

    const cancel = ghostButton(options.cancelLabel ?? 'キャンセル')
    const submit = actionButton(options.submitLabel ?? submitLabel, options.danger === true)
    footer.append(cancel, submit)
    cancel.addEventListener('click', () => close(() => resolve(false)))
    submit.addEventListener('click', () => close(() => resolve(true)))

    wireKeys(overlay, [cancel, submit], {
      onEscape: () => close(() => resolve(false)),
      onEnter: () => close(() => resolve(true)),
    })
    show(overlay, submit)
  })
}

/** 1行の入力を受け取る。取り消しなら null。 */
export function promptCard(options: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    const { overlay, card, footer, close } = buildShell(() => resolve(null))
    card.append(header(options.title, false))

    const body = div('sbd-body sbd-body-form')
    if (options.label !== undefined) {
      const label = div('sbd-label')
      label.textContent = options.label
      body.append(label)
    }
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'sbd-input'
    input.value = options.value ?? ''
    input.placeholder = options.placeholder ?? ''
    const error = div('sbd-error')
    error.hidden = true
    body.append(input, error)
    card.append(body, footer)

    const cancel = ghostButton('キャンセル')
    const submit = actionButton(options.submitLabel ?? '決定', false)
    footer.append(cancel, submit)

    const done = (): void => {
      const value = input.value.trim()
      const message = options.validate?.(value) ?? null
      if (message !== null) {
        error.textContent = message
        error.hidden = false
        input.focus()
        return
      }
      close(() => resolve(value))
    }
    cancel.addEventListener('click', () => close(() => resolve(null)))
    submit.addEventListener('click', done)
    input.addEventListener('input', () => {
      error.hidden = true
    })

    wireKeys(overlay, [input, cancel, submit], {
      onEscape: () => close(() => resolve(null)),
      onEnter: done,
    })
    show(overlay, input)
    input.select()
  })
}

/* ── 組み立ての共通部分 ── */

interface Shell {
  overlay: HTMLElement
  card: HTMLElement
  footer: HTMLElement
  /** 閉じてから続きを実行する（アニメーションの終わりを待つ） */
  close: (then: () => void) => void
}

function buildShell(onBackdrop: () => void): Shell {
  injectStyles()
  const overlay = div('sbd-overlay')
  const card = div('sbd-card')
  const footer = div('sbd-footer')
  overlay.append(card)

  let closing = false
  const close = (then: () => void): void => {
    if (closing) return
    closing = true
    overlay.classList.add('closing')
    // アニメーションが無効な環境でも必ず片付くよう、時間で閉じる
    setTimeout(() => {
      overlay.remove()
      then()
    }, 120)
  }
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) close(onBackdrop)
  })
  return { overlay, card, footer, close }
}

function header(title: string, danger: boolean): HTMLElement {
  const head = div('sbd-head')
  if (danger) {
    const icon = div('sbd-icon')
    icon.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>' +
      '<path d="M12 9v4"/><path d="M12 17h.01"/></svg>'
    head.append(icon)
  }
  const text = div('sbd-title')
  text.textContent = title
  head.append(text)
  return head
}

function div(className: string): HTMLElement {
  const node = document.createElement('div')
  node.className = className
  return node
}

function ghostButton(label: string): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'sbd-btn sbd-btn-ghost'
  b.textContent = label
  return b
}

function actionButton(label: string, danger: boolean): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = `sbd-btn ${danger ? 'sbd-btn-danger' : 'sbd-btn-primary'}`
  b.textContent = label
  return b
}

/** Esc / Enter と、カードの中だけを回るキーボード移動 */
function wireKeys(
  overlay: HTMLElement,
  focusables: readonly HTMLElement[],
  handlers: { onEscape: () => void; onEnter: () => void },
): void {
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      handlers.onEscape()
      return
    }
    if (e.key === 'Enter') {
      // 改行を入れたい textarea は今のところ無いので、Enter は決定に使う
      e.preventDefault()
      handlers.onEnter()
      return
    }
    if (e.key !== 'Tab' || focusables.length === 0) return
    // 後ろの画面へフォーカスが抜けないよう、先頭と末尾をつなぐ
    const first = focusables[0] as HTMLElement
    const last = focusables[focusables.length - 1] as HTMLElement
    const active = document.activeElement
    if (e.shiftKey && active === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  })
}

function show(overlay: HTMLElement, focus: HTMLElement): void {
  document.body.append(overlay)
  focus.focus()
}

function injectStyles(): void {
  if (document.getElementById('sbd-css') !== null) return
  const s = document.createElement('style')
  s.id = 'sbd-css'
  s.textContent = `
    .sbd-overlay{position:fixed;inset:0;z-index:9700;display:flex;flex-direction:row;
      align-items:center;justify-content:center;padding:20px;box-sizing:border-box;
      background:rgba(17,20,26,.42);font-family:${T.font};
      animation:sbd-fade .12s ease-out}
    .sbd-overlay.closing{animation:sbd-fade .1s ease-in reverse}
    .sbd-card{background:#fff;border-radius:12px;width:400px;max-width:100%;
      box-shadow:0 12px 40px rgba(0,0,0,.22),0 0 0 1px rgba(0,0,0,.04);
      overflow:hidden;animation:sbd-pop .14s cubic-bezier(.2,.9,.3,1)}
    .sbd-overlay.closing .sbd-card{animation:sbd-pop .1s ease-in reverse}
    @keyframes sbd-fade{from{opacity:0}to{opacity:1}}
    @keyframes sbd-pop{from{opacity:0;transform:translateY(6px) scale(.97)}
      to{opacity:1;transform:none}}
    @media (prefers-reduced-motion:reduce){
      .sbd-overlay,.sbd-card,.sbd-overlay.closing,.sbd-overlay.closing .sbd-card{animation:none}
    }
    .sbd-head{display:flex;flex-direction:row;align-items:center;gap:9px;
      padding:20px 22px 0}
    .sbd-icon{width:28px;height:28px;border-radius:50%;background:#FBEBE7;color:#C0392B;
      display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .sbd-title{font-size:15px;font-weight:700;color:#1a1d22;line-height:1.5}
    /* 改行をそのまま出す（ネイティブ confirm では効かなかった） */
    .sbd-body{padding:12px 22px 0;font-size:13.5px;color:#3c424f;line-height:1.85;
      white-space:pre-line}
    .sbd-body-form{padding-top:16px}
    .sbd-detail{padding:8px 22px 0;font-size:12px;color:#8b93a1;line-height:1.7;
      white-space:pre-line}
    .sbd-label{font-size:11.5px;color:#6b7280;margin-bottom:5px}
    .sbd-input{width:100%;box-sizing:border-box;border:1px solid #dcdfe5;border-radius:6px;
      padding:9px 11px;font:inherit;font-size:13.5px;color:#1a1d22;background:#fff}
    .sbd-input:focus{outline:none;border-color:var(--sb-accent,${T.primary});
      box-shadow:0 0 0 3px rgba(0,145,255,.15)}
    .sbd-error{margin-top:6px;font-size:11.5px;color:#C0392B;line-height:1.6}
    .sbd-footer{display:flex;flex-direction:row;gap:8px;justify-content:flex-end;
      padding:20px 22px 20px}
    .sbd-btn{font-family:inherit;font-size:13px;padding:8px 18px;border-radius:6px;
      cursor:pointer;min-width:96px;line-height:1.5;transition:filter .12s}
    .sbd-btn:focus-visible{outline:2px solid var(--sb-accent,${T.primary});outline-offset:2px}
    .sbd-btn:hover{filter:brightness(.96)}
    .sbd-btn-ghost{border:1px solid #dcdfe5;background:#fff;color:#4b5563}
    .sbd-btn-primary{border:none;background:var(--sb-accent,${T.primary});
      color:var(--sb-accent-ink,#fff);font-weight:600}
    .sbd-btn-danger{border:none;background:#C0392B;color:#fff;font-weight:600}
  `
  document.head.append(s)
}

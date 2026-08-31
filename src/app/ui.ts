/**
 * 画面部品。採取した実CSSのトークン（企画書 §4-3）に合わせた最小限のスタイルを当てる。
 * 実マークアップの完全再現は土台側（capture/clean）が担当し、ここは「動く部分」に集中する。
 */
export const T = {
  primary: '#0091FF',
  primaryDark: '#0074CC',
  bg: '#ECECEC',
  neutral: '#F4F4F4',
  surface: '#FFFFFF',
  text: '#151515',
  sub: '#808080',
  font: '"Hiragino Sans", sans-serif',
} as const

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<{ class: string; style: string; text: string; html: string }> = {},
  children: readonly (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (props.class !== undefined) node.className = props.class
  if (props.style !== undefined) node.style.cssText = props.style
  if (props.text !== undefined) node.textContent = props.text
  if (props.html !== undefined) node.innerHTML = props.html
  node.append(...children)
  return node
}

export function button(label: string, kind: 'primary' | 'ghost' = 'primary'): HTMLButtonElement {
  const base =
    'font-family:' + T.font + ';font-size:13px;padding:8px 16px;border-radius:4px;cursor:pointer;border:none;'
  const b = el('button', {
    text: label,
    style:
      kind === 'primary'
        ? `${base}background:${T.primary};color:#fff`
        : `${base}background:${T.neutral};color:${T.text};border:1px solid #DDD`,
  })
  b.addEventListener('mouseenter', () => {
    if (kind === 'primary') b.style.background = T.primaryDark
  })
  b.addEventListener('mouseleave', () => {
    if (kind === 'primary') b.style.background = T.primary
  })
  return b
}

/** トースト（企画書 §7-1 のオーバーレイ軸） */
export function toast(message: string, kind: 'success' | 'error' = 'success'): void {
  const t = el('div', {
    text: message,
    style: `position:fixed;left:50%;top:24px;transform:translateX(-50%);z-index:9999;
      background:${kind === 'success' ? '#2FA84F' : '#D0021B'};color:#fff;font-family:${T.font};
      font-size:13px;padding:10px 20px;border-radius:4px;box-shadow:0 2px 12px rgba(0,0,0,.2)`,
  })
  document.body.append(t)
  setTimeout(() => t.remove(), 2600)
}

/** モーダル（作成フローで使う） */
export function modal(title: string, body: HTMLElement, onSubmit: () => void | Promise<void>, submitLabel = '作成する'): void {
  const overlay = el('div', {
    style: `position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:9000;display:flex;
      align-items:center;justify-content:center;font-family:${T.font}`,
  })
  const panel = el('div', {
    style: `background:${T.surface};border-radius:8px;width:560px;max-width:92vw;max-height:88vh;
      display:flex;flex-direction:column;overflow:hidden`,
  })
  const head = el('div', {
    style: 'display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #EEE',
  })
  const cancel = button('キャンセル', 'ghost')
  const submit = button(submitLabel)
  head.append(cancel, el('strong', { text: title, style: 'font-size:15px' }), submit)
  const scroll = el('div', { style: 'padding:18px;overflow:auto' }, [body])
  panel.append(head, scroll)
  overlay.append(panel)
  document.body.append(overlay)

  cancel.addEventListener('click', () => overlay.remove())
  submit.addEventListener('click', async () => {
    submit.disabled = true
    submit.textContent = '処理中…'
    try {
      await onSubmit()
      overlay.remove()
    } catch (error) {
      toast((error as Error).message, 'error')
      submit.disabled = false
      submit.textContent = submitLabel
    }
  })
}

export function field(label: string, input: HTMLElement, hint?: string): HTMLElement {
  return el('div', { style: 'margin-bottom:18px' }, [
    el('div', { text: label, style: `font-size:12px;color:${T.sub};margin-bottom:6px` }),
    input,
    ...(hint === undefined
      ? []
      : [el('div', { text: hint, style: `font-size:11px;color:${T.sub};margin-top:5px` })]),
  ])
}

export function textInput(placeholder = ''): HTMLInputElement {
  const i = el('input', {
    style: `width:100%;padding:10px 12px;border:1px solid #DDD;border-radius:4px;
      font-family:${T.font};font-size:14px;box-sizing:border-box`,
  })
  i.placeholder = placeholder
  return i
}

export function emptyState(message: string, action?: HTMLElement): HTMLElement {
  return el(
    'div',
    {
      style: `display:flex;flex-direction:column;align-items:center;justify-content:center;
        gap:16px;padding:80px 20px;color:${T.sub};font-family:${T.font};font-size:14px`,
    },
    [el('div', { text: message }), ...(action === undefined ? [] : [action])],
  )
}

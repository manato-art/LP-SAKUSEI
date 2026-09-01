/**
 * 採取した実物のオーバーレイ（ポータル／モーダル）を body 直下に立てる共通の足場。
 *
 * **手書きでUIを似せない**（企画書 §11 capture-and-rehydrate）。
 * 採取した `*.portals.html` には同一ポータルが複数コピー入っていることがあるので、
 * `rootSelector` に一致する **最初の1個だけ** を取り出して土台にする。
 * 見た目は index.html が読み込む採取済み実CSSが担保する（ここでCSSは書かない）。
 */
export interface Portal {
  /** body 直下に足したラッパ（閉じるときはこれごと消える） */
  readonly portal: HTMLElement
  /** 採取物から取り出した本体（最初の rootSelector 一致要素） */
  readonly root: HTMLElement
  /** 閉じる（多重呼び出し安全・ESC 監視も外す） */
  readonly close: () => void
}

/**
 * 採取HTMLからオーバーレイを1枚だけ立てる。
 * @param raw          `import(... '?raw')` で読んだ採取HTML
 * @param rootSelector 本体の目印（例 `.ReactModal__Overlay` / `[role="presentation"]`）
 * @param onClose      閉じたあとに呼ぶ後始末（任意）
 * @returns 立てられなければ null（採取物が壊れている＝黙って作らない）
 */
export function openPortal(
  raw: string,
  rootSelector: string,
  onClose?: () => void,
): Portal | null {
  const scratch = document.createElement('div')
  scratch.innerHTML = raw
  const source = scratch.querySelector<HTMLElement>(rootSelector)
  if (source === null) return null

  const portal = document.createElement('div')
  // append は要素を移動させるので、複数コピーのうち最初の1個だけが土台に残る
  portal.append(source)
  document.body.append(portal)

  let closed = false
  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') close()
  }
  const close = (): void => {
    if (closed) return
    closed = true
    document.removeEventListener('keydown', onKeydown)
    portal.remove()
    onClose?.()
  }
  document.addEventListener('keydown', onKeydown)

  return { portal, root: source, close }
}

/**
 * オーバーレイ本文の直下要素をクリックしても閉じない（＝背景クリックだけ閉じる）ための判定。
 * 採取物の overlay/backdrop 要素に対して「自分自身がクリックされたか」を確かめる。
 */
export function bindBackdropClose(backdrop: HTMLElement, close: () => void): void {
  backdrop.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) close()
  })
}

/** 採取物のメニュー項目を「表示文言」で引く（ラベルはすべて実物のテキスト）。 */
export function findByExactText(
  root: ParentNode,
  selector: string,
  text: string,
): HTMLElement | null {
  for (const node of root.querySelectorAll<HTMLElement>(selector)) {
    if ((node.textContent ?? '').trim() === text) return node
  }
  return null
}

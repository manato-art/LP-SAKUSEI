/**
 * エディタ下部の「ステップ一覧」（2026-09-15）。
 *
 * 採取物の下部バーには `_funneSteplListWrapper_`（器）と `_funneStepList_`（1つぶんの雛形）が
 * 入っている。採取CSSには
 *   `._funneStepList_ ._name_` … 名前（130px・はみ出しは…）
 *   `._funneStepList_._parent_` … 先頭のステップ（名前ではなく家アイコン）
 *   `._active_` … いま開いているステップ
 * が定義されている。
 *
 * クローンはステップを**作れる**のに一覧を描いていなかったので、
 * 作ったあとは行き来できず、事実上見えないままだった。
 * 雛形は採取物から取り、手書きでは作らない（企画書 §11 capture-and-rehydrate）。
 */

/** ステップ1つぶん。`memo` が実物の「ステップ名」。 */
export interface StepLike {
  uid: string
  memo?: string
}

/**
 * 一覧に出す名前。
 * 名前を付けずに作れるので、空のときは何番目かで出す（空欄のまま並べると区別できない）。
 */
export function stepLabel(step: StepLike, index: number): string {
  const name = (step.memo ?? '').trim()
  return name === '' ? `ステップ${index + 1}` : name
}

/** クラス名はビルドごとにハッシュが変わるので、要素が実際に持っている物から探す */
function classToken(node: Element, fragment: string): string | null {
  return [...node.classList].find((name) => name.includes(fragment)) ?? null
}

export interface StepListDeps {
  steps: readonly StepLike[]
  /** いま開いているステップの index */
  activeIndex: number
  onSelect: (index: number) => void
}

/**
 * ステップ一覧を描き直す。
 * 器も雛形も採取物のものを使う。見つからなければ何もしない（手書きで似せない）。
 */
export function renderStepList(root: HTMLElement, deps: StepListDeps): void {
  const host = root.querySelector<HTMLElement>('[class*="_funneSteplListWrapper_"]')
  if (host === null) return
  // 雛形は最初の1つ。すでに描き直したあとは、取っておいた雛形を使う。
  const kept = host.dataset['cloneStepTemplate']
  const found = host.querySelector<HTMLElement>('[class*="_funneStepList_"]')
  if (kept === undefined && found !== null) host.dataset['cloneStepTemplate'] = found.outerHTML
  const templateHtml = host.dataset['cloneStepTemplate'] ?? found?.outerHTML
  if (templateHtml === undefined) return

  const scratch = document.createElement('div')
  scratch.innerHTML = templateHtml
  const template = scratch.firstElementChild as HTMLElement | null
  if (template === null) return

  const parentToken = classToken(template, '_parent_')
  const activeToken = classToken(template, '_active_')

  const items = deps.steps.map((step, index) => {
    const item = template.cloneNode(true) as HTMLElement
    item.dataset['stepUid'] = step.uid
    item.style.cursor = 'pointer'
    item.title = stepLabel(step, index)

    // 先頭だけ家アイコン（採取CSSの `._parent_`）。2つ目からは名前を出す。
    const icon = item.querySelector<HTMLElement>('[class*="_iconParent_"]')
    if (index === 0) {
      if (parentToken !== null) item.classList.add(parentToken)
      if (icon !== null) icon.hidden = false
    } else {
      if (parentToken !== null) item.classList.remove(parentToken)
      if (icon !== null) icon.hidden = true
      const name = document.createElement('div')
      name.className = '_name_rugej_46'
      name.textContent = stepLabel(step, index)
      // 名前は家アイコンの場所に置く（雛形に名前の器が入っていないため）
      item.insertBefore(name, item.querySelector('[class*="_listOption_"]'))
    }

    // 雛形が持っている「…」（ステップごとの操作メニュー）は、まだ何も繋がっていない。
    // 押せるのに何も起きない物を出すほうが分かりにくいので、繋ぐまでは出さない。
    const option = item.querySelector<HTMLElement>('[class*="_listOption_"]')
    if (option !== null) option.hidden = true

    if (activeToken !== null) item.classList.toggle(activeToken, index === deps.activeIndex)
    item.addEventListener('click', () => deps.onSelect(index))
    return item
  })
  host.replaceChildren(...items)
}

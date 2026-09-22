/**
 * 見本の設問①②③を「部品を積んで作る」の画面①②③に分ける（2026-09-23・本人の依頼）。
 *
 * 本人の依頼「見本からでも型からでも、部品を積んで作るときと同じ『画面と部品』が欲しい」
 * → 決定（AskUserQuestion）「画面①②③としてタブに並べる」。
 * 画面①②…に作り変えてある見本（`data-nc-screens` の入れ物がある＝tools/widget-library-fix で作り変えた8件）は、
 * 設問1つを部品1つにして、画面①②③に1つずつ置く。切り替えは「部品を積んで作る」の画面が受け持つので、
 * 見本の中の入れ物・画面の枠・切り替えのスクリプトは外す。
 *
 * 分けたときは移る先（data-nc-go）を「何番目の画面か」（`@0`・`@1`…）で持ち、
 * 本当の画面のid（s1・s7…）は、どの画面に置くかが決まってから applyScreenIds で入れる。
 * 動きで設問を出し分ける見本（ワイパー・チャット風など）は入れ物が無いので、そのまま1つの部品にする。
 *
 * テストは tests/nocode-sample-split.test.ts（linkedom で箱を作って確かめる）。
 */

/** 見本を入れた箱を作る（中身はその箱の innerHTML） */
function domParse(html: string): Element {
  const doc = new DOMParser().parseFromString(`<!doctype html><html><body><div id="nc-split-root">${html}</div></body></html>`, 'text/html')
  const root = doc.getElementById('nc-split-root')
  if (root === null) throw new Error('見本を読み込めませんでした')
  return root
}

/** 画面の入れ物のすぐ後ろにある切り替えのスクリプト（分けたら要らない） */
function removeScreensScript(holder: Element): void {
  const next = holder.nextElementSibling
  if (next !== null && next.tagName.toUpperCase() === 'SCRIPT' && (next.textContent ?? '').includes('data-nc-screens')) next.remove()
}

function screensIn(holder: Element): Element[] {
  return Array.from(holder.children).filter((child) => child.getAttribute('data-nc-screen') !== null)
}

/**
 * 見本を画面ごとの部品に分ける。分けられなければ、そのまま1つ（元のHTML）。
 * 移る先は `@0`・`@1`…（何番目の部品か）で返す。
 */
export function splitSampleScreens(html: string, parse: (html: string) => Element = domParse): readonly string[] {
  const first = parse(html)
  const holder = first.querySelector('[data-nc-screens]')
  if (holder === null) return [html]
  const ids = screensIn(holder).map((screen) => screen.getAttribute('data-nc-screen') ?? '')
  if (ids.length < 2) return [html]

  return ids.map((_, index) => {
    // 画面ごとに元のHTMLから作り直す（前の回で外した所が残らない）
    const copy = index === 0 ? first : parse(html)
    const box = copy.querySelector('[data-nc-screens]')
    const parent = box?.parentNode ?? null
    const keep = box === null ? undefined : screensIn(box)[index]
    if (box === null || parent === null || keep === undefined) return html
    removeScreensScript(box)
    // 画面の中身を入れ物のあった所に出し、入れ物と画面の枠は外す
    keep.removeAttribute('hidden')
    while (keep.firstChild !== null) parent.insertBefore(keep.firstChild, box)
    box.remove()
    for (const el of Array.from(copy.querySelectorAll('[data-nc-go]'))) {
      const to = ids.indexOf(el.getAttribute('data-nc-go') ?? '')
      if (to < 0) el.removeAttribute('data-nc-go')
      else el.setAttribute('data-nc-go', `@${to}`)
    }
    return copy.innerHTML
  })
}

/** 分けた部品の移る先（`@0`…）に、本当の画面のidを入れる。足りない番号は移る先を外す */
export function applyScreenIds(html: string, ids: readonly string[]): string {
  return html.replace(/data-nc-go="@(\d{1,4})"/g, (_whole, n: string) => {
    const id = ids[Number(n)]
    return id === undefined ? '' : `data-nc-go="${id}"`
  })
}

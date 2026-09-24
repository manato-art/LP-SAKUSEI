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
    const keep = box === null ? undefined : screensIn(box)[index]
    if (box === null || keep === undefined) return html
    removeScreensScript(box)
    // 入れ物は外さずに残し、中身をこの画面の中身だけにする（画面の枠 .nc-screen は外す）。
    // 自作の見本は入れ物そのものが見本の外枠（名前 nc-xxxxxxxx の付いた箱）で、見本のCSSはこの箱の中だけに効く。
    // 以前は入れ物ごと外していて、分けた画面のCSSが何も効かなかった（2026-09-24 本人「バグってるよ」）
    box.removeAttribute('data-nc-screens')
    box.removeAttribute('data-nc-transition')
    box.replaceChildren(...Array.from(keep.childNodes))
    for (const el of Array.from(copy.querySelectorAll('[data-nc-go]'))) {
      const to = ids.indexOf(el.getAttribute('data-nc-go') ?? '')
      if (to < 0) el.removeAttribute('data-nc-go')
      else el.setAttribute('data-nc-go', `@${to}`)
    }
    return copy.innerHTML
  })
}

/** 見本の画面ごとの呼び名（data-nc-name・設問①・お礼…）。無ければ空 */
function screenLabels(html: string, parse: (html: string) => Element): readonly string[] {
  const holder = parse(html).querySelector('[data-nc-screens]')
  return holder === null ? [] : screensIn(holder).map((screen) => (screen.getAttribute('data-nc-name') ?? '').trim())
}

/** 分けた部品の移る先（`@0`…）に、本当の画面のidを入れる。足りない番号は移る先を外す */
export function applyScreenIds(html: string, ids: readonly string[]): string {
  return html.replace(/data-nc-go="@(\d{1,4})"/g, (_whole, n: string) => {
    const id = ids[Number(n)]
    return id === undefined ? '' : `data-nc-go="${id}"`
  })
}

/**
 * 見本のカードの「画面を作って使う」: その見本を部品にした画面①②…の並び
 * （本人の依頼「見本からでも型からでも、部品を積んで作るときと同じ『画面と部品』が欲しい」）。
 * 設問①②③で進む見本は、設問ごとの部品にして画面①②③に分ける。分けられない見本は画面①に1つ。
 * 画面の名前は「画面①」…（screens-state.ts と同じ丸数字）。
 */
export function sampleScreens(
  sample: { title: string; html: string },
  parse: (html: string) => Element = domParse,
): readonly { id: string; name: string; blocks: readonly { type: 'sample'; title: string; html: string }[] }[] {
  const parts = splitSampleScreens(sample.html, parse)
  const ids = parts.map((_, index) => `s${index + 1}`)
  const circled = Array.from('①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳')
  // 分けたときは、部品の名前の頭にその画面が何か（設問①・お礼…）を付ける（どの画面も同じ名前だと見分けられない）
  const labels = parts.length < 2 ? [] : screenLabels(sample.html, parse)
  return parts.map((part, index) => {
    const label = labels[index] ?? ''
    return {
      id: ids[index] ?? `s${index + 1}`,
      name: `画面${circled[index] ?? String(index + 1)}`,
      blocks: [{ type: 'sample', title: label === '' ? sample.title : `${label}：${sample.title}`, html: applyScreenIds(part, ids) }],
    }
  })
}

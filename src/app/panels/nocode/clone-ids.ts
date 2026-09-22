/**
 * 並んでいる部品を「複製」したときの id・name の付け替え（2026-09-22・ノーコードでWidgetを作る②）。
 *
 * よくある質問の開け閉めは <input id="faq1"><label for="faq1"> のように id でつながっていることが多い。
 * 同じ id のまま複製すると、複製した方を押しても元の方が開く（id はページに1つだけの決まり）。
 * 複製した部品の中だけで id を新しい名前に付け替え、中の参照（for・aria-*・#id・url(#id)）も合わせる。
 *
 * ここは文字の置き換えだけ（DOMを触らない）。テストは tests/nocode-clone-ids.test.ts。
 */

/** 値が id の並び（空白区切り）になっている属性 */
const ID_LIST_ATTRS: ReadonlySet<string> = new Set([
  'for',
  'form',
  'list',
  'headers',
  'popovertarget',
  'aria-activedescendant',
  'aria-controls',
  'aria-describedby',
  'aria-details',
  'aria-errormessage',
  'aria-flowto',
  'aria-labelledby',
  'aria-owns',
])

/** 値が「#id」になりうる属性 */
const HASH_ATTRS: ReadonlySet<string> = new Set(['href', 'xlink:href', 'data-target', 'data-bs-target', 'data-href'])

/**
 * 元の名前 → 新しい名前の表。ページ内で使われていない名前にする。
 * 末尾の「-数字」は付け直す（step-2 の複製は step-2-2 ではなく、空いている step-3 など）。
 */
export function renameIds(ids: readonly string[], taken: ReadonlySet<string>): Map<string, string> {
  const used = new Set(taken)
  const map = new Map<string, string>()
  for (const id of ids) {
    if (map.has(id)) continue
    const base = id.replace(/-\d+$/, '')
    let n = 2
    while (used.has(`${base}-${n}`)) n += 1
    const next = `${base}-${n}`
    used.add(next)
    map.set(id, next)
  }
  return map
}

/** 属性の値の中の id の参照を、表に沿って付け替える（関係ない属性はそのまま返す） */
export function rewriteIdRefs(name: string, value: string, map: ReadonlyMap<string, string>): string {
  const attr = name.toLowerCase()
  if (attr === 'id') return map.get(value) ?? value
  if (ID_LIST_ATTRS.has(attr)) return value.split(/(\s+)/).map((token) => map.get(token) ?? token).join('')
  if (HASH_ATTRS.has(attr) && value.startsWith('#')) {
    const next = map.get(value.slice(1))
    return next === undefined ? value : `#${next}`
  }
  // fill="url(#grad)" や style の url(#id)
  return value.replace(/url\(\s*(['"]?)#([^'")\s]+)\1\s*\)/g, (whole: string, quote: string, id: string) => {
    const next = map.get(id)
    return next === undefined ? whole : `url(${quote}#${next}${quote})`
  })
}

/**
 * 付け替えるラジオボタンのグループ名。
 * そのグループの選択肢が全部この部品の中にある（＝1問まるごとの複製）ときだけ別のグループにする。
 * 選択肢を1つ複製したときは、同じ問いの選択肢のままにする。
 */
export function radioNamesToRename(
  countInItem: ReadonlyMap<string, number>,
  countInWidget: ReadonlyMap<string, number>,
): string[] {
  return [...countInItem.entries()].filter(([name, count]) => countInWidget.get(name) === count).map(([name]) => name)
}

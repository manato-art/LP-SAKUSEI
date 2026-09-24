/**
 * 保存データに残っている「同じ uid が2件以上」を直す（2026-09-11・本人承認）。
 *
 * uid を「今ある件数＋1」で作っていた頃は、削除のあとに作ると既存と同じ uid が付いた
 * （本番では別々のLPの Version が2件とも VERSION_0005 だった）。uid での検索は先頭一致なので、
 * 片方を編集するともう片方が書き換わる恐れがある。
 *
 * 直し方: 同じ uid の中で id が一番小さい（一番古い）1件は uid をそのまま残し、ほかの物に新しい uid を付け直す。
 * 新しい uid は増えるだけの通し番号（state.nextId）から作る（actions-shared.ts の freshUid と同じ決め方）。
 * 日次の数値やヒートマップは uid で記録しているので、付け直す前の分は残した1件のものとして扱われる（どちらの分か分けられない）。
 *
 * 2026-09-24: ポップアップ（離脱防止・表示直後＝exitPopups、追従型＝followPopups）も同じ不具合があったので対象に足した。
 * ポップアップの uid を保存しているのは審査の記録（inspectionEntries の kind='popup'）だけ
 * （配信の目印 `exit-popup-{uid}` は配信のたびに作る・リンク置換は一覧を読むだけ）。
 * 直す前は2件とも同じ記録を見ていたので、付け直した方にも同じ記録を足す（残す方の記録は消さない＝足すだけ）。
 */
import { freshUid } from './actions-shared.ts'
import { makeAbTestUid, makeUid } from './ids.ts'
import type { State } from './types.ts'

/** 直す対象＝アプリが uid を作る物 */
type UidCollection =
  | 'folders'
  | 'abTests'
  | 'articles'
  | 'versions'
  | 'redirectPages'
  | 'tasks'
  | 'conversions'
  | 'productSearchForms'
  | 'products'
  | 'exitPopups'
  | 'followPopups'

/** 付け直した1件 */
export interface UidRepair {
  collection: UidCollection
  id: number
  from: string
  to: string
}

/** コレクションごとの uid の形（作るときと同じ） */
const UID_FORMATS: Readonly<Record<UidCollection, (n: number) => string>> = {
  folders: (n) => makeUid('folder', n),
  abTests: makeAbTestUid,
  articles: (n) => makeUid('article', n),
  versions: (n) => makeUid('version', n),
  redirectPages: (n) => makeUid('redirectPage', n),
  tasks: (n) => makeUid('task', n),
  conversions: (n) => makeUid('conversion', n),
  productSearchForms: (n) => makeUid('productSearchForm', n),
  products: (n) => makeUid('product', n),
  exitPopups: (n) => makeUid('exitPopup', n),
  followPopups: (n) => makeUid('followPopup', n),
}

interface Identified {
  id: number
  uid: string
}

/** 1つのコレクションを直す（並びは変えない） */
function repairCollection(
  items: readonly Identified[],
  nextId: number,
  toUid: (n: number) => string,
): { items: readonly Identified[]; nextId: number; renamed: readonly Omit<UidRepair, 'collection'>[] } {
  const keeperIdByUid = new Map<string, number>()
  for (const item of items) {
    const kept = keeperIdByUid.get(item.uid)
    if (kept === undefined || item.id < kept) keeperIdByUid.set(item.uid, item.id)
  }
  if (items.every((item) => keeperIdByUid.get(item.uid) === item.id)) return { items, nextId, renamed: [] }

  const initial = { items: [] as readonly Identified[], nextId, renamed: [] as readonly Omit<UidRepair, 'collection'>[] }
  return items.reduce((acc, item) => {
    if (keeperIdByUid.get(item.uid) === item.id) return { ...acc, items: [...acc.items, item] }
    // 既にある uid と、ここまでに付け直した uid の両方と重ならない番号にする
    const assigned = acc.renamed.map((r) => ({ uid: r.to }))
    const to = freshUid([...items, ...assigned], acc.nextId, toUid)
    return {
      items: [...acc.items, { ...item, uid: to }],
      nextId: acc.nextId + 1,
      renamed: [...acc.renamed, { id: item.id, from: item.uid, to }],
    }
  }, initial)
}

/**
 * 付け直した離脱防止ポップアップにも、元の uid の審査の記録を写す（同じ記録が既にあれば足さない）。
 * 審査画面に並ぶのは離脱防止ポップアップ（exitPopups）だけなので、追従型は対象にしない。
 */
function copyPopupInspections(state: State, renamed: readonly UidRepair[]): State {
  const added = renamed
    .filter((r) => r.collection === 'exitPopups')
    .flatMap((r) =>
      state.inspectionEntries
        .filter((e) => e.kind === 'popup' && e.target_uid === r.from)
        .filter(() => !state.inspectionEntries.some((x) => x.kind === 'popup' && x.target_uid === r.to))
        .map((e) => ({ ...e, target_uid: r.to })),
    )
  return added.length === 0 ? state : { ...state, inspectionEntries: [...state.inspectionEntries, ...added] }
}

/** 同じ uid が2件以上ある物を直す。直す物が無ければ、渡された state をそのまま返す */
export function repairDuplicateUids(state: State): { state: State; changes: readonly UidRepair[] } {
  const repaired = renameDuplicates(state)
  if (repaired.changes.length === 0) return repaired
  return { state: copyPopupInspections(repaired.state, repaired.changes), changes: repaired.changes }
}

function renameDuplicates(state: State): { state: State; changes: readonly UidRepair[] } {
  return (Object.keys(UID_FORMATS) as UidCollection[]).reduce(
    (acc, collection) => {
      const out = repairCollection(acc.state[collection], acc.state.nextId, UID_FORMATS[collection])
      if (out.renamed.length === 0) return acc
      return {
        state: { ...acc.state, [collection]: out.items, nextId: out.nextId } as State,
        changes: [...acc.changes, ...out.renamed.map((r) => ({ collection, ...r }))],
      }
    },
    { state, changes: [] as readonly UidRepair[] },
  )
}

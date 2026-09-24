/**
 * 一覧APIを最後のページまで取る（2026-09-24）。
 *
 * フォルダ一覧・beyondページ一覧は per_page=200 の1回だけで取っていたので、
 * 201件目からが黙って消えていた。サーバーが返す pagination.total_pages を見て順に取る。
 * 途中のページで失敗したら、途中までを「全部」として返さずにそのまま失敗させる。
 */

export interface PageInfo {
  total_pages: number
  current_page: number
  total_count: number
}

/** 1回に取る件数（サーバーの上限ではなく、往復の回数を減らすための大きさ） */
export const LIST_PAGE_SIZE = 200

export async function fetchAllPages<Res extends { pagination: PageInfo }, Item>(
  fetchPage: (page: number) => Promise<Res>,
  pick: (res: Res) => readonly Item[],
): Promise<Item[]> {
  const first = await fetchPage(1)
  const items: Item[] = [...pick(first)]
  for (let page = 2; page <= first.pagination.total_pages; page += 1) {
    items.push(...pick(await fetchPage(page)))
  }
  return items
}

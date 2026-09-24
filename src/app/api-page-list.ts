/**
 * ページ一覧だけが使うAPI（2026-09-24）。api.ts が長くなりすぎたので分けた。
 *
 *   - フォルダなし（フォルダを消したページ）の一覧
 *   - 合計行（表に出ている行だけを足す）
 *   - beyondページの複製・フォルダ移動
 */
import { request, type AbTest, type ReportKpi } from './api.ts'
import { LIST_PAGE_SIZE, fetchAllPages, type PageInfo } from './api-paging.ts'

export const pageListApi = {
  /** フォルダなし（folder_id が null）のページ。全ページ取る */
  unfiledAbTests: () =>
    fetchAllPages(
      (page) =>
        request<{ ab_tests: AbTest[]; pagination: PageInfo }>(
          'GET',
          `/ab_tests?folder_id=null&per_page=${LIST_PAGE_SIZE}&page=${page}`,
        ),
      (res) => res.ab_tests,
    ),
  /** 合計行。`folderUid` は実在するフォルダか `unfiled`。`abTestUids` は表に出ている行 */
  reportsTotal: (folderUid: string, abTestUids: readonly string[], rangeQuery: string) =>
    request<{ reports_total: ReportKpi }>(
      'GET',
      `/folders/${encodeURIComponent(folderUid)}/ab_tests/reports_total?${rangeQuery}` +
        `&ab_test_uids=${encodeURIComponent(abTestUids.join(','))}`,
    ),
  /** 複製。folderId を省くと同じフォルダ、null はフォルダなし */
  duplicate: (abTestUid: string, folderId?: number | null) =>
    request<{ ab_test: AbTest }>(
      'POST',
      `/ab_tests/${abTestUid}/duplicate`,
      folderId === undefined ? {} : { folder_id: folderId },
    ),
  /** フォルダ移動（null はフォルダなし） */
  move: (abTestUid: string, folderId: number | null) =>
    request<{ ab_test: AbTest }>('PUT', `/ab_tests/${abTestUid}`, { folder_id: folderId }),
  /** 配信ステータス（記録と絞り込み用。配信は変わらない） */
  setStatus: (abTestUid: string, adStatus: 'prepared' | 'delivered' | 'stopping' | 'finished') =>
    request<{ ab_test: AbTest }>('PUT', `/ab_tests/${abTestUid}`, { ad_status: adStatus }),
  remove: (abTestUid: string) => request<void>('DELETE', `/ab_tests/${abTestUid}`),
}

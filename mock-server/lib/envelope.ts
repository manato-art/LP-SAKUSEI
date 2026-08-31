/**
 * レスポンス封筒（企画書 §10-8）。
 * エラー封筒は `{"error":{"code","message"}}`。実サイト規約は採取でき次第 docs/api に追記する。
 */

export interface ErrorEnvelope {
  error: { code: string; message: string }
}

export function errorEnvelope(code: string, message: string): ErrorEnvelope {
  return { error: { code, message } }
}

export interface Pagination {
  total_pages: number
  total_count: number
  current_page: number
}

export function pagination(totalCount: number, perPage: number, currentPage: number): Pagination {
  return {
    total_pages: perPage > 0 ? Math.max(1, Math.ceil(totalCount / perPage)) : 1,
    total_count: totalCount,
    current_page: currentPage,
  }
}

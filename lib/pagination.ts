/**
 * Shared server-side pagination helpers.
 *
 * Paginated list endpoints accept `?page=1&limit=10` query params and return a
 * `{ data, meta }` wrapper so clients can render pagination controls without a
 * second round-trip for the total count.
 */

export interface PageMeta {
  total: number
  page: number
  limit: number
  pageCount: number
  hasMore: boolean
}

export interface Paginated<T> {
  data: T[]
  meta: PageMeta
}

export const DEFAULT_LIMIT = 10
/** Default page size for the reports module (denser, scanned in bulk). */
export const REPORT_DEFAULT_LIMIT = 25
export const MAX_LIMIT = 100

export interface PaginationParams {
  page: number
  limit: number
  skip: number
  take: number
}

/**
 * Parse and clamp `page`/`limit` from a request's query params.
 * Defaults to page 1 and `defaultLimit` (10 unless overridden); limit is clamped to 1..100.
 */
export function parsePagination(
  searchParams: URLSearchParams,
  defaultLimit: number = DEFAULT_LIMIT
): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(searchParams.get("limit") ?? `${defaultLimit}`, 10) || defaultLimit)
  )
  return { page, limit, skip: (page - 1) * limit, take: limit }
}

/**
 * Wrap a page of rows with pagination metadata.
 */
export function paginate<T>(data: T[], total: number, page: number, limit: number): Paginated<T> {
  const pageCount = Math.max(1, Math.ceil(total / limit))
  return {
    data,
    meta: { total, page, limit, pageCount, hasMore: page < pageCount },
  }
}

/**
 * Slice a fully-fetched array into a page and wrap it with metadata.
 * Used by report endpoints whose stored procedures return the whole result set
 * (no SQL LIMIT/OFFSET), so pagination is applied in-memory.
 */
export function paginateInMemory<T>(all: T[], page: number, limit: number): Paginated<T> {
  const skip = (page - 1) * limit
  return paginate(all.slice(skip, skip + limit), all.length, page, limit)
}

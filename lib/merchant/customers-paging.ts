/**
 * Pure paging domain for the members list (MER-P2-10). The loader caps each
 * page at {@link CUSTOMERS_PAGE_SIZE} masked rows; these helpers resolve the
 * requested page from the URL and describe the pagination UI. Pure TS on
 * purpose — unit-tested via tests/unit/customers-paging.test.mjs.
 */

export const CUSTOMERS_PAGE_SIZE = 15

export type CustomersPageRequest = {
  /** 1-based page, clamped to >= 1 (bad input resolves to 1). */
  readonly page: number
  /** Row offset for the loader (0-based). */
  readonly offset: number
}

export type CustomersPagination = {
  readonly page: number
  readonly totalPages: number
  readonly hasPrev: boolean
  readonly hasNext: boolean
  /** 1-based inclusive row range shown on this page (0/0 when empty). */
  readonly rangeStart: number
  readonly rangeEnd: number
}

/**
 * Resolve `?page=` into a loader request. Non-numeric, fractional, zero, or
 * negative input all resolve to page 1 so a mangled URL never breaks the
 * list. Deliberately does NOT clamp against the total (the count query runs
 * in parallel with the rows query — see app/app/customers/page.tsx); a
 * beyond-the-end page simply renders empty with working Prev controls.
 */
export function resolveCustomersPageRequest(
  pageParam: string | readonly string[] | undefined,
  pageSize: number = CUSTOMERS_PAGE_SIZE
): CustomersPageRequest {
  const raw = Array.isArray(pageParam) ? pageParam[0] : pageParam
  const parsed =
    typeof raw === "string" && /^\d+$/.test(raw)
      ? Number.parseInt(raw, 10)
      : Number.NaN
  const page = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1

  return { page, offset: (page - 1) * pageSize }
}

/** Describe the pagination UI for a resolved page against the true total. */
export function buildCustomersPagination(
  page: number,
  totalMembers: number,
  pageSize: number = CUSTOMERS_PAGE_SIZE
): CustomersPagination {
  const safeTotal = Math.max(0, Math.floor(totalMembers))
  const totalPages = Math.max(1, Math.ceil(safeTotal / pageSize))
  const clampedPage = Math.max(1, Math.floor(page))
  const rangeStart =
    safeTotal === 0 || clampedPage > totalPages
      ? 0
      : (clampedPage - 1) * pageSize + 1
  const rangeEnd =
    rangeStart === 0 ? 0 : Math.min(safeTotal, clampedPage * pageSize)

  return {
    page: clampedPage,
    totalPages,
    hasPrev: clampedPage > 1,
    hasNext: clampedPage < totalPages,
    rangeStart,
    rangeEnd,
  }
}

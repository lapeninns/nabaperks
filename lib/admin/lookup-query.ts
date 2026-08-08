/**
 * Pure query-shape helpers for the admin member lookup
 * (admin member lookup). No IO and no server-only imports so the unit
 * runner can execute them directly; `lib/admin/data.ts` owns the Supabase
 * calls that consume these shapes.
 *
 * Escaping layers, outermost first:
 * 1. `escapeLikePattern` neutralises LIKE wildcards (`%`, `_`, `\`) typed by
 *    the operator so a fragment matches literally.
 * 2. `quotePostgrestValue` wraps the pattern in PostgREST double quotes so
 *    reserved logic-tree characters (`,`, `(`, `)`, `.`) inside an `or=()`
 *    filter stay part of the value instead of splitting the expression.
 */

export const ADMIN_LOOKUP_PAGE_SIZE = 25
export const ADMIN_LOOKUP_TERM_MAX_LENGTH = 64
const ADMIN_LOOKUP_MAX_PAGE = 999

export type AdminLookupState = {
  readonly venue?: string
  readonly contact?: string
  readonly page: number
}

export type AdminPageMeta = {
  readonly total: number
  readonly page: number
  readonly pageCount: number
  readonly pageSize: number
}

export type AdminSearchParamValue = string | string[] | undefined
export type AdminSearchParams = Record<string, AdminSearchParamValue>

function firstParam(value: AdminSearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/**
 * Normalise a free-text search term: first entry of repeated params, control
 * characters stripped, whitespace collapsed, trimmed, and length-capped.
 * Returns `undefined` when nothing searchable remains.
 */
export function normaliseLookupTerm(
  value: AdminSearchParamValue
): string | undefined {
  const raw = firstParam(value)
  if (typeof raw !== "string") return undefined

  const cleaned = raw
    .replaceAll(/[\u0000-\u001f\u007f]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim()
    .slice(0, ADMIN_LOOKUP_TERM_MAX_LENGTH)

  return cleaned.length > 0 ? cleaned : undefined
}

/** Parse a 1-based page param; junk becomes page 1, huge values are clamped. */
export function parsePageParam(value: AdminSearchParamValue): number {
  const raw = firstParam(value)?.trim()
  if (!raw || !/^\d+$/.test(raw)) return 1

  const page = Number.parseInt(raw, 10)
  if (!Number.isSafeInteger(page) || page < 1) return 1
  return Math.min(page, ADMIN_LOOKUP_MAX_PAGE)
}

/** Read the canonical lookup state (venue, contact, page) from searchParams. */
export function parseAdminLookupParams(
  params: AdminSearchParams | undefined
): AdminLookupState {
  return {
    venue: normaliseLookupTerm(params?.venue),
    contact: normaliseLookupTerm(params?.contact),
    page: parsePageParam(params?.page),
  }
}

/** Escape `%`, `_`, and `\` so operator input matches literally in ILIKE. */
export function escapeLikePattern(term: string): string {
  return term
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_")
}

/** Contains-style ILIKE pattern for a literal term. */
export function containsPattern(term: string): string {
  return `%${escapeLikePattern(term)}%`
}

/**
 * Double-quote a value for PostgREST filter syntax so `,`/`(`/`)` inside the
 * value cannot split an `or=()` expression. Backslashes and quotes are
 * escaped for the PostgREST string literal parser.
 */
function quotePostgrestValue(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`
}

/**
 * Or-filter string for `.or(…, { referencedTable: "customers" })`: matches
 * the contact fragment against the customer email or phone_last4. The plaintext
 * `customers.phone` column was retired (20260707095000), so filtering it would
 * error; `phone_last4` is the surviving searchable contact digits.
 */
export function contactOrIlikeFilter(term: string): string {
  const quoted = quotePostgrestValue(containsPattern(term))
  return `email.ilike.${quoted},phone_last4.ilike.${quoted}`
}

/**
 * How a venue *name fragment* resolves against the venues it matched, for the
 * one admin list whose reader cannot take a fragment: `admin_referral_ops`
 * filters by a single `p_merchant_id`.
 *
 * The `none` case is the one that matters. Falling back to "no venue id" when
 * a fragment matches nothing would run the query unfiltered and answer a
 * different question — every referral on the platform, presented as this
 * venue's.
 */
export type AdminVenueFilterDecision =
  | { readonly kind: "unfiltered" }
  | { readonly kind: "single"; readonly venueId: string }
  | { readonly kind: "none" }
  | { readonly kind: "ambiguous" }

export function decideVenueFilter(
  venue: string | undefined,
  matches: ReadonlyArray<{ readonly id: string }>
): AdminVenueFilterDecision {
  if (!venue) return { kind: "unfiltered" }
  if (matches.length === 0) return { kind: "none" }
  if (matches.length > 1) return { kind: "ambiguous" }

  const venueId = matches[0]?.id
  return venueId ? { kind: "single", venueId } : { kind: "none" }
}

/** Zero-based inclusive `.range()` window for a 1-based page. */
export function lookupRange(
  page: number,
  pageSize: number = ADMIN_LOOKUP_PAGE_SIZE
): { from: number; to: number } {
  const from = (page - 1) * pageSize
  return { from, to: from + pageSize - 1 }
}

/** Pagination meta for the UI; pageCount is never zero. */
export function pageMeta(
  total: number,
  page: number,
  pageSize: number = ADMIN_LOOKUP_PAGE_SIZE
): AdminPageMeta {
  return {
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    pageSize,
  }
}

/**
 * Previous reachable page, or null on the first page. A requested page beyond
 * the end (stale link) routes back inside the real window.
 */
export function previousPage(meta: AdminPageMeta): number | null {
  if (meta.page <= 1) return null
  return Math.min(meta.page - 1, meta.pageCount)
}

/** Next page, or null when the current page is at (or past) the end. */
export function nextPage(meta: AdminPageMeta): number | null {
  if (meta.page >= meta.pageCount) return null
  return meta.page + 1
}

/**
 * Linkable lookup URL: skips empty params, keeps page-like params implicit at
 * 1, and preserves the caller's key order so hrefs are stable.
 */
export function buildLookupHref(
  basePath: string,
  params: Record<string, string | number | undefined>
): string {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue
    if (typeof value === "number" && /page$/i.test(key) && value <= 1) continue
    search.set(key, String(value))
  }

  const query = search.toString()
  return query ? `${basePath}?${query}` : basePath
}

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

/**
 * The rows-per-page choices (04#56). A closed allowlist, not a clamped range:
 * `size` reaches PostgREST as a `.range()` window, so an arbitrary integer is
 * an operator-controlled row budget on a service-role read.
 */
export const ADMIN_LOOKUP_PAGE_SIZES = [25, 50, 100] as const

export type AdminSortDirection = "asc" | "desc"

/**
 * A parsed, ALLOWLISTED sort. `key` is null when the list is in its default
 * order, which is the only state a caller may treat as "no ORDER BY of mine".
 */
export type AdminSortState = {
  readonly key: string | null
  readonly direction: AdminSortDirection
}

export type AdminLookupState = {
  readonly venue?: string
  readonly contact?: string
  readonly page: number
  /** Rows per page; always one of ADMIN_LOOKUP_PAGE_SIZES. */
  readonly size: number
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

/**
 * Parse the rows-per-page param. Anything not on the allowlist — junk, a
 * clamped-looking 1000, a negative — falls back to the default page size
 * rather than being coerced to the nearest legal value, so a hand-edited URL
 * cannot widen the window a service-role query reads.
 */
export function parseSizeParam(value: AdminSearchParamValue): number {
  const raw = firstParam(value)?.trim()
  if (!raw || !/^\d+$/.test(raw)) return ADMIN_LOOKUP_PAGE_SIZE

  const size = Number.parseInt(raw, 10)
  return (ADMIN_LOOKUP_PAGE_SIZES as readonly number[]).includes(size)
    ? size
    : ADMIN_LOOKUP_PAGE_SIZE
}

/**
 * Parse `?sort=`/`?dir=` against a CLOSED allowlist of sort tokens, exactly as
 * `parseSizeParam` treats rows-per-page and for the same reason: the token
 * reaches PostgREST as a `.order()` column on a service-role read, so an
 * arbitrary string is an operator-controlled ORDER BY. Anything off the
 * allowlist falls back to the list's default order rather than being coerced
 * to the nearest legal value, so a hand-edited URL cannot name a column.
 *
 * Descending is the default direction because every sortable admin column is
 * one an operator triages by worst-or-newest first.
 */
export function parseAdminSortParams(
  params: AdminSearchParams | undefined,
  allowed: readonly string[]
): AdminSortState {
  const raw = firstParam(params?.sort)?.trim()
  const key = raw && allowed.includes(raw) ? raw : null
  const direction = firstParam(params?.dir)?.trim() === "asc" ? "asc" : "desc"

  // A direction with no column is not a sort; reporting it would let a caller
  // build `?dir=asc` links that silently do nothing.
  return key ? { key, direction } : { key: null, direction: "desc" }
}

/**
 * How one allowlisted sort token maps onto a database column.
 */
export type AdminSortColumn = {
  readonly column: string
  /**
   * `true` when the column's ASCENDING order is the descending DISPLAY order.
   * `fraud_flags.severity_rank` is the case that needs it: 1 is `high`, so
   * "most severe first" is `ascending: true`, and without this an operator
   * asking for the worst flags first would get the mildest.
   */
  readonly inverted?: boolean
}

/**
 * Resolve a parsed sort against a surface's token → column map. Returns null
 * for the default order, which is the only value a reader may treat as "apply
 * my own ORDER BY". Pure, so the direction inversion is unit-testable without
 * a database.
 */
export function resolveAdminSort(
  sort: AdminSortState | undefined,
  columns: Readonly<Record<string, AdminSortColumn>>
): { readonly column: string; readonly ascending: boolean } | null {
  if (!sort?.key) return null
  const entry = columns[sort.key]
  if (!entry) return null

  const ascending = entry.inverted
    ? sort.direction === "desc"
    : sort.direction === "asc"

  return { column: entry.column, ascending }
}

/**
 * Read the canonical lookup state (venue, contact, page, rows per page) from
 * searchParams.
 */
export function parseAdminLookupParams(
  params: AdminSearchParams | undefined
): AdminLookupState {
  return {
    venue: normaliseLookupTerm(params?.venue),
    contact: normaliseLookupTerm(params?.contact),
    page: parsePageParam(params?.page),
    size: parseSizeParam(params?.size),
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
    // The default rows-per-page stays implicit for the same reason page 1
    // does: otherwise every admin link in the console grows a `size=25` that
    // means nothing.
    if (key === "size" && Number(value) === ADMIN_LOOKUP_PAGE_SIZE) continue
    search.set(key, String(value))
  }

  const query = search.toString()
  return query ? `${basePath}?${query}` : basePath
}

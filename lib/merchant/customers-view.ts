import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { MerchantCustomerReadbackRow } from "@/lib/merchant/customer-readback"
import {
  enrichMerchantMemberships,
  getMerchantCustomerCount,
  getMerchantCustomers,
  MERCHANT_MEMBERSHIP_COLUMNS,
  type MerchantMembershipRow,
} from "@/lib/merchant/dashboard"
import {
  CUSTOMER_MATCH_ID_CAP,
  maskedContactOrIlikeFilter,
  quotePostgrestValue,
  resolveCustomerFilterBoundaries,
  type CustomerFilter,
  type CustomerFilterBoundaries,
} from "@/lib/merchant/customers-filter"
import { CUSTOMERS_PAGE_SIZE } from "@/lib/merchant/customers-paging"
import { createSupabaseServerClient } from "@/lib/supabase/server"

/**
 * Server-side search and status filtering for the merchant Members list.
 *
 * Why this exists (03#18): search and the status pills used to run in the
 * browser over one CUSTOMERS_PAGE_SIZE window of 15 rows, so past page one a
 * merchant typed a member in and got "No members match your filter" with no way
 * to know which page they were on. The list apologised for it in prose.
 *
 * Two constraints shaped the design.
 *
 * 1. **Search must not widen the PII surface.** It does not. The merchant
 *    session reads `public.customers_masked`, whose `email` column is already
 *    the `a***@domain` string the console renders and whose `phone_last4` is
 *    the surviving contact digits (`supabase/migrations/20260707095000` retired
 *    plaintext `customers.phone`). An ILIKE over those two columns searches
 *    exactly what the merchant can see.
 *
 * 2. **Badge derivation must not be reimplemented in SQL.** It is not. Rows are
 *    still enriched and badged by `enrichMerchantMemberships` and
 *    `deriveMerchantCustomerRewardBadge`. What moved to the database is the
 *    narrower *membership* predicate behind each pill, and the two share their
 *    London day boundaries through `resolveCustomerFilterBoundaries`.
 *
 * The one deliberate semantic change is `quiet` / `active`. The pills used to
 * key off the *displayed* badge tone, which is first-match-wins, so a member
 * 40 days absent who also had a reward waiting was missing from Quiet (the
 * badge said "Reward waiting"). They now ask the plain question — has this
 * member visited inside the quiet window — which is both expressible as an
 * index predicate and the question the merchant meant.
 */

export type MerchantCustomersQuery = {
  readonly merchantId: string
  /** 1-based page. */
  readonly page: number
  readonly filter: CustomerFilter
  /** Normalised `?q=` fragment, or undefined for no search. */
  readonly search?: string
  readonly pageSize?: number
  readonly now?: Date
}

export type MerchantCustomersView = {
  readonly rows: MerchantCustomerReadbackRow[]
  /** Every member of the venue, ignoring filter and search. */
  readonly totalMembers: number
  /** Members the active filter + search select, across every page. */
  readonly matchedMembers: number
  /** Per-pill totals across every page. */
  readonly counts: Record<CustomerFilter, number>
  /**
   * True when a match set was clipped at {@link CUSTOMER_MATCH_ID_CAP}, so the
   * readback can say the list is the newest N rather than the whole answer.
   */
  readonly capped: boolean
}

/**
 * The PostgREST builder surface these helpers narrow. Declared structurally
 * rather than as the concrete `PostgrestFilterBuilder`: its generics differ
 * between a `head: true` count and a row read, and a self-referential
 * constraint over them blows the instantiation depth limit (TS2589). The
 * helpers below take the caller's own builder type and hand it straight back,
 * so the two casts they contain never leak.
 */
type MembershipFilter = {
  lt(column: string, value: string): MembershipFilter
  gte(column: string, value: string): MembershipFilter
  in(column: string, values: readonly string[]): MembershipFilter
  or(filters: string): MembershipFilter
}

type MatchSet = { readonly ids: string[]; readonly capped: boolean }

/**
 * One page of members for the active filter and search, plus the pill totals.
 *
 * Query budget, all merchant-scoped and all in parallel: three `head: true`
 * COUNTs (total / active / quiet), one bounded id read for Ready, one bounded
 * id read when a search is active, then one paged row read plus the shared
 * enrichment reads.
 */
export async function loadMerchantCustomersView(
  query: MerchantCustomersQuery
): Promise<MerchantCustomersView> {
  const pageSize = Math.max(
    1,
    Math.floor(query.pageSize ?? CUSTOMERS_PAGE_SIZE)
  )
  const now = query.now ?? new Date()
  const bounds = resolveCustomerFilterBoundaries(now)
  const supabase = await createSupabaseServerClient()
  const page = Math.max(1, Math.floor(query.page))
  const offset = (page - 1) * pageSize

  // Ready is always read: the pill needs its count even when another filter is
  // active, and the id list it produces is what the Ready filter narrows by.
  const [totalMembers, ready, search, counts] = await Promise.all([
    getMerchantCustomerCount(query.merchantId),
    loadReadyMembershipIds(supabase, query.merchantId, bounds),
    query.search
      ? loadSearchCustomerIds(supabase, query.search)
      : Promise.resolve(null),
    loadMembershipCounts(supabase, query.merchantId, bounds),
  ])

  const resolvedCounts: Record<CustomerFilter, number> = {
    all: totalMembers,
    ready: ready.ids.length,
    active: counts.active,
    quiet: counts.quiet,
  }
  const capped = ready.capped || (search?.capped ?? false)

  // Nothing narrowed: the plain paged read, unchanged from before 03#18.
  if (query.filter === "all" && !search) {
    const rows = await getMerchantCustomers(query.merchantId, now, {
      limit: pageSize,
      offset,
    })

    return {
      rows,
      totalMembers,
      matchedMembers: totalMembers,
      counts: resolvedCounts,
      capped,
    }
  }

  // A search that matched nobody, or Ready with no redeemable reward, is an
  // empty page. Passing an empty `.in()` list would be an unfiltered read.
  const noMatches =
    (search !== null && search.ids.length === 0) ||
    (query.filter === "ready" && ready.ids.length === 0)

  if (noMatches) {
    return {
      rows: [],
      totalMembers,
      matchedMembers: 0,
      counts: resolvedCounts,
      capped,
    }
  }

  const base = supabase
    .from("customer_memberships")
    .select(MERCHANT_MEMBERSHIP_COLUMNS, { count: "exact" })
    .eq("merchant_id", query.merchantId)
  const filtered = applyCustomerFilter(base, query.filter, bounds, ready.ids)
  const scoped = search ? filtered.in("customer_id", search.ids) : filtered

  const { data, error, count } = await scoped
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (error) {
    throw new Error(`Unable to load customers: ${error.message}`)
  }

  const rows = await enrichMerchantMemberships(
    supabase,
    query.merchantId,
    (data ?? []) as MerchantMembershipRow[],
    now
  )

  return {
    rows,
    totalMembers,
    matchedMembers: count ?? rows.length,
    counts: resolvedCounts,
    capped,
  }
}

/**
 * The dashboard's "Do next" counts (03#13). `readyCount` counts MEMBERS with a
 * redeemable reward, not reward rows, so it equals the Ready pill on the
 * members list; `quietCount` is the same predicate the Quiet pill uses.
 */
export async function getMerchantNextActionCounts(
  merchantId: string,
  now: Date = new Date()
): Promise<{ readonly readyCount: number; readonly quietCount: number }> {
  const supabase = await createSupabaseServerClient()
  const bounds = resolveCustomerFilterBoundaries(now)

  const [ready, quiet] = await Promise.all([
    loadReadyMembershipIds(supabase, merchantId, bounds),
    quietFilter(
      supabase
        .from("customer_memberships")
        .select("id", { count: "exact", head: true })
        .eq("merchant_id", merchantId),
      bounds
    ),
  ])

  if (quiet.error) {
    throw new Error(`Unable to count quiet members: ${quiet.error.message}`)
  }

  return { readyCount: ready.ids.length, quietCount: quiet.count ?? 0 }
}

// ─── Query fragments ──────────────────────────────────────────────────────────

function applyCustomerFilter<Q>(
  query: Q,
  filter: CustomerFilter,
  bounds: CustomerFilterBoundaries,
  readyIds: readonly string[]
): Q {
  const builder = query as MembershipFilter

  switch (filter) {
    case "ready":
      return builder.in("id", readyIds) as Q
    case "active":
      return builder.gte("last_visit_at", bounds.quietBeforeIso) as Q
    case "quiet":
      return quietFilter(query, bounds)
    default:
      return query
  }
}

/**
 * "Gone quiet": no visit inside the window, and not a member who joined today —
 * a same-day join has a null `last_visit_at` until its first stamp lands, and
 * the badge calls that "New today", not quiet.
 *
 * The timestamp is double-quoted inside the `or=()` expression so its `.`
 * separators cannot split the PostgREST logic tree.
 */
function quietFilter<Q>(query: Q, bounds: CustomerFilterBoundaries): Q {
  const quiet = quotePostgrestValue(bounds.quietBeforeIso)
  return (query as MembershipFilter)
    .lt("created_at", bounds.joinedTodayFromIso)
    .or(`last_visit_at.is.null,last_visit_at.lt.${quiet}`) as Q
}

// ─── Reads ────────────────────────────────────────────────────────────────────

/**
 * The two pill totals that are plain membership predicates. `all` comes from
 * the existing `getMerchantCustomerCount`, and `ready` from the deduplicated
 * membership id list, so neither is counted twice.
 */
async function loadMembershipCounts(
  supabase: SupabaseClient,
  merchantId: string,
  bounds: CustomerFilterBoundaries
): Promise<{ readonly active: number; readonly quiet: number }> {
  const base = () =>
    supabase
      .from("customer_memberships")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", merchantId)

  const [active, quiet] = await Promise.all([
    base().gte("last_visit_at", bounds.quietBeforeIso),
    quietFilter(base(), bounds),
  ])

  const error = active.error ?? quiet.error
  if (error) {
    throw new Error(`Unable to count members: ${error.message}`)
  }

  return { active: active.count ?? 0, quiet: quiet.count ?? 0 }
}

/**
 * Memberships whose reward is redeemable today. `redeemable_from` is a DATE
 * column, so the comparison is the London day key the badge already uses
 * (`redeemableKey <= todayKey`) rather than an instant.
 */
async function loadReadyMembershipIds(
  supabase: SupabaseClient,
  merchantId: string,
  bounds: CustomerFilterBoundaries
): Promise<MatchSet> {
  const released = quotePostgrestValue(bounds.redeemableOnOrBeforeKey)
  const { data, error } = await supabase
    .from("reward_events")
    .select("membership_id")
    .eq("merchant_id", merchantId)
    .eq("status", "unlocked")
    .or(`redeemable_from.is.null,redeemable_from.lte.${released}`)
    .order("created_at", { ascending: false })
    .limit(CUSTOMER_MATCH_ID_CAP + 1)

  if (error) {
    throw new Error(`Unable to load ready rewards: ${error.message}`)
  }

  const rows = (data ?? []) as { membership_id: string }[]
  return capMatches(rows.map((row) => row.membership_id))
}

async function loadSearchCustomerIds(
  supabase: SupabaseClient,
  search: string
): Promise<MatchSet> {
  const { data, error } = await supabase
    .from("customers_masked")
    .select("id")
    .or(maskedContactOrIlikeFilter(search))
    .limit(CUSTOMER_MATCH_ID_CAP + 1)

  if (error) {
    throw new Error(`Unable to search members: ${error.message}`)
  }

  const rows = (data ?? []) as { id: string }[]
  return capMatches(rows.map((row) => row.id))
}

/**
 * Deduplicate and clip an id list to {@link CUSTOMER_MATCH_ID_CAP}. `capped` is
 * true only when the read returned MORE than the cap — the extra row the
 * queries fetch exists purely to tell "exactly full" from "overflowing".
 */
function capMatches(ids: readonly string[]): MatchSet {
  const unique: string[] = []
  const seen = new Set<string>()
  let overflowed = false

  for (const id of ids) {
    if (!id || seen.has(id)) continue
    if (unique.length === CUSTOMER_MATCH_ID_CAP) {
      overflowed = true
      break
    }
    seen.add(id)
    unique.push(id)
  }

  return { ids: unique, capped: overflowed }
}

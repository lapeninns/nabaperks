import "server-only"

import { createAdminServiceRoleClient } from "@/lib/admin/service-role"
import {
  contactOrIlikeFilter,
  containsPattern,
  decideVenueFilter,
  lookupRange,
  pageMeta,
  type AdminLookupState,
  type AdminPageMeta,
} from "./lookup-query"

export { getAdminBillingRecords, type AdminBillingRecord } from "./billing-data"
export { getAdminPilotMerchants, getAdminPilotReport } from "./pilot-report"

/**
 * Server-side member lookup query (admin member lookup): venue and
 * masked-contact fragments plus a 1-based page. Terms arrive already
 * normalised by `parseAdminLookupParams`; they are LIKE-escaped and
 * PostgREST-quoted here before interpolation.
 */
export type AdminLookupQuery = Partial<AdminLookupState>

export type AdminPagedRows<T> = {
  rows: T[]
  meta: AdminPageMeta
}

export async function getAdminOverview() {
  const [merchants, customers, billingIssues, recentAudits] = await Promise.all(
    [
      countRows("merchants"),
      countRows("customers"),
      countBillingIssues(),
      getAdminAuditLogs(6),
    ]
  )

  return { merchants, customers, billingIssues, recentAudits }
}

/**
 * Merchant accounts, searchable and paged like every other admin list. The
 * previous hard `.limit(100)` returned the newest 100 rows with no filter, no
 * total and no signpost, so past 100 merchants "is this venue on the
 * platform?" was silently answered wrong.
 */
export async function getAdminMerchants(lookup: AdminLookupQuery = {}) {
  const supabase = await createAdminServiceRoleClient()
  const page = lookup.page ?? 1
  const window = lookupRange(page, lookup.size)

  let query = supabase
    .from("merchants")
    .select(
      "id, business_name, business_slug, email, status, created_at, billing_customers(status, plan, current_period_end)",
      { count: "exact" }
    )

  if (lookup.venue) {
    query = query.ilike("business_name", containsPattern(lookup.venue))
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(window.from, window.to)

  if (error) {
    throw new Error(`Unable to load merchants: ${error.message}`)
  }

  return { rows: data ?? [], meta: pageMeta(count ?? 0, page, lookup.size) }
}

/**
 * QR records, paged and venue-filterable. `merchants!inner` is safe here:
 * `qr_codes.merchant_id` is NOT NULL, so the join drops no rows — it only
 * lets the venue fragment filter the parent.
 */
export async function getAdminQrCodes(lookup: AdminLookupQuery = {}) {
  const supabase = await createAdminServiceRoleClient()
  const page = lookup.page ?? 1
  const window = lookupRange(page, lookup.size)

  let query = supabase
    .from("qr_codes")
    .select(
      "id, qr_id, is_active, destination_type, created_at, merchants!inner(business_name)",
      { count: "exact" }
    )

  if (lookup.venue) {
    query = query.ilike(
      "merchants.business_name",
      containsPattern(lookup.venue)
    )
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(window.from, window.to)

  if (error) {
    throw new Error(`Unable to load QR codes: ${error.message}`)
  }

  return { rows: data ?? [], meta: pageMeta(count ?? 0, page, lookup.size) }
}

export async function getAdminCustomers(lookup: AdminLookupQuery = {}) {
  const supabase = await createAdminServiceRoleClient()
  const page = lookup.page ?? 1
  const window = lookupRange(page, lookup.size)

  // `!inner` joins keep the embedded filters (contact/venue) applied to the
  // parent rows; membership FKs are non-null so the join never drops rows.
  let query = supabase
    .from("customer_memberships")
    .select(
      "id, current_stamp_count, total_stamps_earned, total_rewards_redeemed, created_at, customers!inner(email, phone_last4), merchants!inner(business_name)",
      { count: "exact" }
    )

  if (lookup.contact) {
    query = query.or(contactOrIlikeFilter(lookup.contact), {
      referencedTable: "customers",
    })
  }
  if (lookup.venue) {
    query = query.ilike(
      "merchants.business_name",
      containsPattern(lookup.venue)
    )
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(window.from, window.to)

  if (error) {
    throw new Error(`Unable to load customer memberships: ${error.message}`)
  }

  return { rows: data ?? [], meta: pageMeta(count ?? 0, page, lookup.size) }
}

export async function getAdminPrivacySupportRows(
  lookup: AdminLookupQuery = {}
) {
  const supabase = await createAdminServiceRoleClient()
  const page = lookup.page ?? 1
  const window = lookupRange(page, lookup.size)

  let query = supabase
    .from("customer_memberships")
    .select(
      "id, merchant_id, customer_id, created_at, customers!inner(email, phone_last4), merchants!inner(business_name)",
      { count: "exact" }
    )

  if (lookup.contact) {
    query = query.or(contactOrIlikeFilter(lookup.contact), {
      referencedTable: "customers",
    })
  }
  if (lookup.venue) {
    query = query.ilike(
      "merchants.business_name",
      containsPattern(lookup.venue)
    )
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(window.from, window.to)

  if (error) {
    throw new Error(`Unable to load privacy support rows: ${error.message}`)
  }

  return { rows: data ?? [], meta: pageMeta(count ?? 0, page, lookup.size) }
}

export type AdminUnaffiliatedCustomerRow = {
  readonly id: string
  readonly email: string | null
  readonly phone_last4: string | null
  readonly is_verified: boolean
  readonly created_at: string
}

/**
 * Verified customers with no membership (db privacy lifecycle). Every other
 * admin lookup queries FROM `customer_memberships`, so a verified customer who
 * never joined a venue is invisible to support. Reads the service-role-only
 * `customers_unaffiliated` view (verified only, newest first) so they can be
 * discovered and serviced, with the same contact-fragment search as the other
 * lookups.
 */
export async function getAdminUnaffiliatedCustomers(
  lookup: AdminLookupQuery = {}
): Promise<AdminPagedRows<AdminUnaffiliatedCustomerRow>> {
  const supabase = await createAdminServiceRoleClient()
  const page = lookup.page ?? 1
  const window = lookupRange(page, lookup.size)

  let query = supabase
    .from("customers_unaffiliated")
    .select("id, email, phone_last4, is_verified, created_at", {
      count: "exact",
    })
    .eq("is_verified", true)

  if (lookup.contact) {
    query = query.or(contactOrIlikeFilter(lookup.contact))
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(window.from, window.to)

  if (error) {
    throw new Error(`Unable to load unaffiliated customers: ${error.message}`)
  }

  return { rows: data ?? [], meta: pageMeta(count ?? 0, page, lookup.size) }
}

export async function getAdminConsentRecords(page = 1, size?: number) {
  const supabase = await createAdminServiceRoleClient()
  const window = lookupRange(page, size)
  const { data, error, count } = await supabase
    .from("consent_records")
    .select(
      "id, channel, consent_status, source, policy_version, created_at, metadata, customers(email, phone_last4), merchants(business_name)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(window.from, window.to)

  if (error) {
    throw new Error(`Unable to load consent records: ${error.message}`)
  }

  return { rows: data ?? [], meta: pageMeta(count ?? 0, page, size) }
}

export async function getAdminRewards(page = 1, size?: number) {
  const supabase = await createAdminServiceRoleClient()
  const window = lookupRange(page, size)
  const { data, error, count } = await supabase
    .from("reward_events")
    .select(
      "id, status, cancelled_reason, created_at, redeemed_at, customers(email, phone_last4), merchants(business_name), loyalty_cards(reward_name)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(window.from, window.to)

  if (error) {
    throw new Error(`Unable to load rewards: ${error.message}`)
  }

  return { rows: data ?? [], meta: pageMeta(count ?? 0, page, size) }
}

/** fraud_flags.status check constraint: open / reviewed / dismissed. */
export type AdminFraudQueue = "open" | "high" | "all"

/** Severity rank for triage ordering; fraud_flags.severity is low/medium/high. */
const FRAUD_SEVERITY_RANK: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

/**
 * Triage-shaped fraud readback. Flags used to arrive newest-first regardless of
 * status or severity, so an operator scrolled past resolved work to find open
 * work and a high-severity flag had no priority position. `queue` filters
 * server-side (default: open only) and the returned page is ordered by severity
 * then recency — the sort happens in memory over the fetched window because
 * `severity` is a text column whose alphabetical order (high/low/medium) is not
 * its severity order.
 */
export async function getAdminFraudSignals(queue: AdminFraudQueue = "open") {
  const supabase = await createAdminServiceRoleClient()
  let flagQuery = supabase
    .from("fraud_flags")
    .select(
      "id, signal, severity, status, metadata, created_at, merchants(business_name), customers(email, phone_last4)",
      { count: "exact" }
    )

  if (queue === "open") {
    flagQuery = flagQuery.eq("status", "open")
  }
  if (queue === "high") {
    flagQuery = flagQuery.eq("severity", "high")
  }

  const [
    { data: fraudFlags, error: flagsError, count: flagCount },
    { data: failures, error: failureError, count: failureCount },
  ] = await Promise.all([
    flagQuery.order("created_at", { ascending: false }).limit(100),
    supabase
      .from("product_events")
      .select("id, event_name, created_at, merchants(business_name)", {
        count: "exact",
      })
      .eq("event_name", "reward_redemption_failed")
      .order("created_at", { ascending: false })
      .limit(100),
  ])

  if (flagsError) {
    throw new Error(`Unable to load fraud flags: ${flagsError.message}`)
  }

  if (failureError) {
    throw new Error(`Unable to load fraud events: ${failureError.message}`)
  }

  const flags = Array.isArray(fraudFlags) ? fraudFlags.map(redactFraudFlag) : []
  flags.sort((left, right) => {
    const rank =
      (FRAUD_SEVERITY_RANK[left.severity.toLowerCase()] ?? 1) -
      (FRAUD_SEVERITY_RANK[right.severity.toLowerCase()] ?? 1)
    if (rank !== 0) return rank
    return right.created_at.localeCompare(left.created_at)
  })

  return {
    fraudFlags: flags,
    flagTotal: flagCount ?? flags.length,
    failures: failures ?? [],
    failureTotal: failureCount ?? failures?.length ?? 0,
  }
}

/** Bucket counts for the fraud queue tabs (head-only, no rows transferred). */
export async function getAdminFraudQueueCounts() {
  const supabase = await createAdminServiceRoleClient()
  const [open, high, all] = await Promise.all([
    supabase
      .from("fraud_flags")
      .select("*", { count: "exact", head: true })
      .eq("status", "open"),
    supabase
      .from("fraud_flags")
      .select("*", { count: "exact", head: true })
      .eq("severity", "high"),
    supabase.from("fraud_flags").select("*", { count: "exact", head: true }),
  ])

  return {
    open: open.count ?? 0,
    high: high.count ?? 0,
    all: all.count ?? 0,
  }
}

export type AdminReferralOpsRow = {
  readonly referralId: string
  readonly venueName: string | null
  readonly status: string
  readonly holdReason: string | null
  readonly referrerEmail: string | null
  readonly referredEmail: string | null
  readonly attributedAt: string | null
  readonly qualifiedAt: string | null
  readonly bonusAwardedAt: string | null
  readonly retryCount: number
  readonly fraudFlagCount: number
}

/** A venue the referral lookup fragment matched, for disambiguation. */
export type AdminReferralVenueMatch = {
  readonly id: string
  readonly name: string
}

export type AdminReferralOpsPage = {
  readonly rows: AdminReferralOpsRow[]
  readonly meta: AdminPageMeta
  /**
   * Populated only when the venue fragment matched more than one venue. The
   * RPC filters by a single `p_merchant_id`, so an ambiguous fragment cannot
   * be pushed down; the panel asks which venue instead of silently showing
   * one of them or nothing.
   */
  readonly venueMatches: readonly AdminReferralVenueMatch[]
}

/** Venues whose name contains the fragment, newest name order, capped. */
const REFERRAL_VENUE_MATCH_LIMIT = 25

async function findReferralVenues(
  supabase: Awaited<ReturnType<typeof createAdminServiceRoleClient>>,
  venue: string
): Promise<AdminReferralVenueMatch[]> {
  const { data, error } = await supabase
    .from("merchants")
    .select("id, business_name")
    .ilike("business_name", containsPattern(venue))
    .order("business_name", { ascending: true })
    .limit(REFERRAL_VENUE_MATCH_LIMIT)

  if (error) {
    throw new Error(`Unable to resolve referral venue: ${error.message}`)
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.business_name),
  }))
}

/**
 * Support operational referral view (referral ops visibility): the
 * internal-admin detail behind /admin/referrals. Reads the admin_referral_ops RPC
 * through the gated admin service-role client (its is_service_role_request branch
 * accepts the loader; requireAdminRead has already gated the page).
 *
 * Paged, counted and venue-filterable (04#6). Two shapes the other admin
 * lists do not have to deal with, both forced by the RPC's fixed signature
 * `admin_referral_ops(uuid, text, integer, integer)`:
 *
 * 1. It returns no total, so the count is a separate head-only read of
 *    `referrals` — the same pattern billing uses.
 * 2. It filters by one venue id, not a name fragment. The fragment is
 *    resolved against `merchants` first; a single match is pushed down, and
 *    an ambiguous one is returned as `venueMatches` for the operator to
 *    choose from rather than being applied to whichever venue sorted first.
 */
export async function getAdminReferralOps(
  lookup: AdminLookupQuery = {}
): Promise<AdminReferralOpsPage> {
  const supabase = await createAdminServiceRoleClient()
  const page = lookup.page ?? 1
  const window = lookupRange(page, lookup.size)

  const matches = lookup.venue
    ? await findReferralVenues(supabase, lookup.venue)
    : []
  const decision = decideVenueFilter(lookup.venue, matches)
  if (decision.kind === "none" || decision.kind === "ambiguous") {
    // Not "fall back to unfiltered": a fragment that resolves to no single
    // venue must not be answered with every referral on the platform.
    return {
      rows: [],
      meta: pageMeta(0, page, lookup.size),
      venueMatches: matches,
    }
  }
  const venueId = decision.kind === "single" ? decision.venueId : null

  const countQuery = supabase
    .from("referrals")
    .select("id", { count: "exact", head: true })
  const { count } = await (venueId
    ? countQuery.eq("venue_id", venueId)
    : countQuery)

  const { data, error } = await supabase.rpc("admin_referral_ops", {
    p_merchant_id: venueId,
    p_status: null,
    p_limit: window.to - window.from + 1,
    p_offset: window.from,
  })

  if (error) {
    throw new Error(`Unable to load referral ops: ${error.message}`)
  }

  const rows: unknown = data
  if (!Array.isArray(rows)) {
    return {
      rows: [],
      meta: pageMeta(count ?? 0, page, lookup.size),
      venueMatches: [],
    }
  }

  return {
    rows: rows.map(toAdminReferralOpsRow),
    meta: pageMeta(count ?? 0, page, lookup.size),
    venueMatches: [],
  }
}

function toAdminReferralOpsRow(row: unknown): AdminReferralOpsRow {
  const r = (row ?? {}) as Record<string, unknown>
  return {
    referralId: String(r.referral_id ?? ""),
    venueName: typeof r.venue_name === "string" ? r.venue_name : null,
    status: String(r.status ?? ""),
    holdReason: typeof r.hold_reason === "string" ? r.hold_reason : null,
    referrerEmail:
      typeof r.referrer_email === "string" ? r.referrer_email : null,
    referredEmail:
      typeof r.referred_email === "string" ? r.referred_email : null,
    attributedAt: typeof r.attributed_at === "string" ? r.attributed_at : null,
    qualifiedAt: typeof r.qualified_at === "string" ? r.qualified_at : null,
    bonusAwardedAt:
      typeof r.bonus_awarded_at === "string" ? r.bonus_awarded_at : null,
    retryCount: Number(r.retry_count ?? 0),
    fraudFlagCount: Number(r.fraud_flag_count ?? 0),
  }
}

/**
 * Data-request lifecycle readback for the privacy page (audit_logs is the
 * source of truth): pending manual requests (`data_request_logged`) plus the
 * self-executing completions (`customer_data_exported`,
 * `customer_pii_erased`). Metadata is redacted to the request facts the
 * console already shows; notes stay out of the list view.
 */
const DATA_REQUEST_AUDIT_ACTIONS = [
  "data_request_logged",
  "customer_data_exported",
  "customer_pii_erased",
] as const

export type AdminDataRequestActivityRow = {
  readonly id: string
  readonly action: string
  readonly requestType: string | null
  readonly channel: string | null
  readonly createdAt: string
  readonly maskedCustomer: string
  readonly merchant: string
}

export async function getAdminDataRequestActivity(
  limit = 20
): Promise<AdminDataRequestActivityRow[]> {
  const supabase = await createAdminServiceRoleClient()
  const { data, error } = await supabase
    .from("audit_logs")
    .select(
      "id, action, metadata, created_at, customers(email, phone_last4), merchants(business_name)"
    )
    .in("action", [...DATA_REQUEST_AUDIT_ACTIONS])
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Unable to load data request activity: ${error.message}`)
  }

  return (Array.isArray(data) ? data : []).map(redactDataRequestActivity)
}

function redactDataRequestActivity(row: unknown): AdminDataRequestActivityRow {
  const record = isRecord(row) ? row : {}
  const metadata = isRecord(record.metadata) ? record.metadata : {}
  const customer = firstRecord(record.customers)
  const merchant = firstRecord(record.merchants)

  return {
    id: fallbackString(record.id, "data-request"),
    action: fallbackString(record.action, "data_request_logged"),
    requestType: stringValue(metadata.request_type) ?? null,
    channel: stringValue(metadata.channel) ?? null,
    createdAt: fallbackString(record.created_at, ""),
    maskedCustomer: adminMaskedCustomer(customer),
    merchant: fallbackString(merchant?.business_name, "Merchant"),
  }
}

/**
 * Paged audit readback with an optional venue filter. The audit log is a
 * search surface by definition ("what did we do to venue X?"); it used to
 * render the newest 100 rows with no filter, no total and no way to reach row
 * 101. `merchants!inner` is only used when a venue fragment is supplied —
 * plenty of audit rows have no merchant, and an unconditional inner join
 * would silently drop them.
 */
export async function getAdminAuditPage(lookup: AdminLookupQuery = {}) {
  const supabase = await createAdminServiceRoleClient()
  const page = lookup.page ?? 1
  const window = lookupRange(page, lookup.size)
  const merchantEmbed = lookup.venue
    ? "merchants!inner(business_name)"
    : "merchants(business_name)"

  let query = supabase
    .from("audit_logs")
    .select(
      `id, actor_type, actor_id, action, target_table, target_id, metadata, created_at, ${merchantEmbed}, customers(email, phone_last4)`,
      { count: "exact" }
    )

  if (lookup.venue) {
    query = query.ilike(
      "merchants.business_name",
      containsPattern(lookup.venue)
    )
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(window.from, window.to)

  if (error) {
    throw new Error(`Unable to load audit logs: ${error.message}`)
  }

  return { rows: data ?? [], meta: pageMeta(count ?? 0, page, lookup.size) }
}

export async function getAdminAuditLogs(limit = 100) {
  const supabase = await createAdminServiceRoleClient()
  const { data, error } = await supabase
    .from("audit_logs")
    .select(
      "id, actor_type, actor_id, action, target_table, target_id, metadata, created_at, merchants(business_name), customers(email, phone_last4)"
    )
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Unable to load audit logs: ${error.message}`)
  }

  return data ?? []
}

async function countRows(table: "merchants" | "customers") {
  const supabase = await createAdminServiceRoleClient()
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })

  if (error) {
    throw new Error(`Unable to count ${table}: ${error.message}`)
  }

  return count ?? 0
}

async function countBillingIssues() {
  const supabase = await createAdminServiceRoleClient()
  const { count, error } = await supabase
    .from("billing_customers")
    .select("*", { count: "exact", head: true })
    .in("status", ["past_due", "cancelled", "suspended"])

  if (error) {
    throw new Error(`Unable to count billing issues: ${error.message}`)
  }

  return count ?? 0
}

type AdminFraudFlag = {
  readonly id: string
  readonly signal: string
  readonly severity: string
  readonly status: string
  readonly created_at: string
  readonly cycleStampNumber: number | null
  readonly locationStatus: string
  readonly distanceBucket: string
  readonly accuracyBucket: string
  readonly confidence: string
  readonly reason: string
  readonly merchant: string
  readonly maskedCustomer: string
}

function redactFraudFlag(row: unknown): AdminFraudFlag {
  const record = isRecord(row) ? row : {}
  const metadata = fraudFlagMetadata(record)
  const customer = firstRecord(record.customers)
  const merchant = firstRecord(record.merchants)

  return {
    id: fallbackString(record.id, "fraud-flag"),
    signal: fallbackString(record.signal, "fraud_signal"),
    severity: fallbackString(record.severity, "unknown"),
    status: fallbackString(record.status, "unknown"),
    created_at: fallbackString(record.created_at, ""),
    cycleStampNumber: numberValue(metadata.cycle_stamp_number),
    locationStatus: fallbackString(metadata.location_status, "unknown"),
    distanceBucket: fallbackString(metadata.distance_bucket, "unknown"),
    accuracyBucket: fallbackString(metadata.accuracy_bucket, "unknown"),
    confidence: fallbackString(metadata.confidence, "unknown"),
    reason: fraudFlagReason(metadata, record),
    merchant: fallbackString(merchant?.business_name, "Merchant"),
    maskedCustomer: adminMaskedCustomer(customer),
  }
}

function fraudFlagMetadata(
  record: Record<string, unknown>
): Record<string, unknown> {
  return isRecord(record.metadata) ? record.metadata : {}
}

function fallbackString(value: unknown, fallback: string): string {
  return stringValue(value) ?? fallback
}

function fraudFlagReason(
  metadata: Record<string, unknown>,
  record: Record<string, unknown>
): string {
  return stringValue(metadata.reason) ?? stringValue(record.signal) ?? "review"
}

function adminMaskedCustomer(customer: Record<string, unknown> | undefined) {
  const email = stringValue(customer?.email)
  if (email) return maskAdminContact(email)
  const last4 = stringValue(customer?.phone_last4)
  return last4 ? `Phone ending ${last4}` : "Customer"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function firstRecord(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) {
    return isRecord(value[0]) ? value[0] : undefined
  }

  return isRecord(value) ? value : undefined
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function maskAdminContact(value?: string) {
  if (!value) return "Customer"
  if (value.includes("@")) {
    const [name = "", domain = ""] = value.split("@")
    return `${name.slice(0, 2)}***@${domain}`
  }
  return `${value.slice(0, 4)}***${value.slice(-2)}`
}

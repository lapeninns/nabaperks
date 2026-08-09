import "server-only"

import { createAdminServiceRoleClient } from "@/lib/admin/service-role"
import {
  containsPattern,
  lookupRange,
  pageMeta,
  type AdminLookupState,
  type AdminPageMeta,
} from "@/lib/admin/lookup-query"

/** Alphabetical picker window. Named so the truncation notice cannot drift. */
const MERCHANT_PICKER_LIMIT = 200

export type AdminEvidenceLookup = Partial<AdminLookupState>

/**
 * The evidence ledger, searchable and paged like the merchants, audit, billing
 * and referral lists (ADM 04#6).
 *
 * It could follow that pattern immediately because it is a plain
 * `created_at desc` read. The fraud queue next door could not: it ranked
 * severity IN MEMORY after fetching, because `severity` is a text column whose
 * alphabetical order (high/low/medium) is not its severity order, and paging
 * that server-side would rank each page independently — a high-severity flag on
 * page 3 sitting below a low-severity one on page 1. That is now fixed at the
 * source: `20260809100000_fraud_flag_severity_rank.sql` adds a generated
 * `severity_rank` column and `getAdminFraudFlags` orders by it in SQL.
 */
export async function getAdminEvidenceWorkspace(
  lookup: AdminEvidenceLookup = {}
) {
  const supabase = await createAdminServiceRoleClient()
  const window = lookupRange(lookup.page ?? 1, lookup.size)
  const caseEmbed = lookup.venue
    ? "merchants!inner(business_name)"
    : "merchants(business_name)"

  let caseQuery = supabase
    .from("commercial_evidence_cases")
    .select(
      `id,merchant_id,source_kind,status,attribution_name,before_summary,after_summary,testimonial_quote,measurement_start,measurement_end,new_members,normal_visit_stamps,verified_return_visits,rewards_redeemed,metric_definition_version,metric_snapshot_hash,metric_snapshot_at,merchant_approved_at,published_at,created_at,${caseEmbed}`,
      { count: "exact" }
    )

  if (lookup.venue) {
    caseQuery = caseQuery.ilike(
      "merchants.business_name",
      containsPattern(lookup.venue)
    )
  }

  // The picker is an alphabetical <select> capped at MERCHANT_PICKER_LIMIT, so
  // past the cap a venue late in the alphabet could not be chosen AT ALL — an
  // operator could not file evidence against it, and the list gave no hint the
  // name was missing. The same `?venue=` term that filters the ledger now
  // narrows the picker, so any venue is reachable in one search (ADM 04#6).
  let merchantQuery = supabase
    .from("merchants")
    .select("id,business_name", { count: "exact" })

  if (lookup.venue) {
    merchantQuery = merchantQuery.ilike(
      "business_name",
      containsPattern(lookup.venue)
    )
  }

  const [merchantsResult, casesResult] = await Promise.all([
    merchantQuery
      .order("business_name", { ascending: true })
      .limit(MERCHANT_PICKER_LIMIT),
    caseQuery
      .order("created_at", { ascending: false })
      .range(window.from, window.to),
  ])

  if (merchantsResult.error) {
    throw new Error(
      `Unable to load evidence merchants: ${merchantsResult.error.message}`
    )
  }
  if (casesResult.error) {
    throw new Error(
      `Unable to load commercial evidence: ${casesResult.error.message}`
    )
  }

  const merchants = merchantsResult.data ?? []
  const cases = casesResult.data ?? []

  const caseTotal = casesResult.count ?? cases.length

  return {
    merchants,
    cases,
    // The ledger is paged now, so `caseTotal` drives a real paginator rather
    // than a truncation notice. The merchant PICKER is still a hard-capped
    // alphabetical <select> — past the cap a venue late in the alphabet cannot
    // be chosen at all — so it keeps its count and its notice (ADM 04#6).
    merchantTotal: merchantsResult.count ?? merchants.length,
    caseTotal,
    caseMeta: pageMeta(
      caseTotal,
      lookup.page ?? 1,
      lookup.size
    ) as AdminPageMeta,
    merchantLimit: MERCHANT_PICKER_LIMIT,
  }
}

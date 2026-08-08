import "server-only"

import { createAdminServiceRoleClient } from "@/lib/admin/service-role"

/** Alphabetical picker window. Named so the truncation notice cannot drift. */
const MERCHANT_PICKER_LIMIT = 200
const EVIDENCE_CASE_LIMIT = 100

export async function getAdminEvidenceWorkspace() {
  const supabase = await createAdminServiceRoleClient()
  const [merchantsResult, casesResult] = await Promise.all([
    supabase
      .from("merchants")
      .select("id,business_name", { count: "exact" })
      .order("business_name", { ascending: true })
      .limit(MERCHANT_PICKER_LIMIT),
    supabase
      .from("commercial_evidence_cases")
      .select(
        "id,merchant_id,source_kind,status,attribution_name,before_summary,after_summary,testimonial_quote,measurement_start,measurement_end,new_members,normal_visit_stamps,verified_return_visits,rewards_redeemed,metric_definition_version,metric_snapshot_hash,metric_snapshot_at,merchant_approved_at,published_at,created_at,merchants(business_name)"
      )
      .order("created_at", { ascending: false })
      .limit(EVIDENCE_CASE_LIMIT),
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

  return {
    merchants,
    cases,
    // Counts, not just rows. Both queries are hard-capped, and neither cap was
    // signposted: the merchant picker is an alphabetical `<select>`, so past
    // the cap a venue late in the alphabet simply could not be chosen, and the
    // case list looked complete at 100 (ADM 04#6).
    merchantTotal: merchantsResult.count ?? merchants.length,
    caseTotal: casesResult.count ?? cases.length,
    merchantLimit: MERCHANT_PICKER_LIMIT,
  }
}

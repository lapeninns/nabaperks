import "server-only"

import { createAdminServiceRoleClient } from "@/lib/admin/service-role"

export async function getAdminEvidenceWorkspace() {
  const supabase = await createAdminServiceRoleClient()
  const [merchantsResult, casesResult] = await Promise.all([
    supabase
      .from("merchants")
      .select("id,business_name")
      .order("business_name", { ascending: true })
      .limit(200),
    supabase
      .from("commercial_evidence_cases")
      .select(
        "id,merchant_id,source_kind,status,attribution_name,before_summary,after_summary,testimonial_quote,measurement_start,measurement_end,new_members,normal_visit_stamps,verified_return_visits,rewards_redeemed,metric_definition_version,metric_snapshot_hash,metric_snapshot_at,merchant_approved_at,published_at,created_at,merchants(business_name)"
      )
      .order("created_at", { ascending: false })
      .limit(100),
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

  return {
    merchants: merchantsResult.data ?? [],
    cases: casesResult.data ?? [],
  }
}

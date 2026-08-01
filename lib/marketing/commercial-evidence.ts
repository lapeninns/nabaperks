import "server-only"

import { unstable_cache } from "next/cache"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type PublishedCommercialEvidence = {
  id: string
  attributionName: string
  afterSummary: string
  testimonialQuote: string | null
  measurementStart: string
  measurementEnd: string
  newMembers: number
  verifiedReturnVisits: number
  rewardsRedeemed: number
  definitionVersion: string
  snapshotAt: string
}

const loadPublishedCommercialEvidence = unstable_cache(
  async (): Promise<PublishedCommercialEvidence[]> => {
    const supabase = createSupabaseServiceRoleClient()
    const { data, error } = await supabase
      .from("commercial_evidence_cases")
      .select(
        "id,attribution_name,after_summary,testimonial_quote,measurement_start,measurement_end,new_members,verified_return_visits,rewards_redeemed,metric_definition_version,metric_snapshot_at"
      )
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(3)

    // Deploy-before-migrate safety: evidence is an optional proof enhancement,
    // never a reason for the public landing page to fail closed.
    if (error) return []

    return (data ?? []).flatMap((row) => {
      if (
        typeof row.id !== "string" ||
        typeof row.attribution_name !== "string" ||
        typeof row.after_summary !== "string" ||
        typeof row.measurement_start !== "string" ||
        typeof row.measurement_end !== "string" ||
        typeof row.new_members !== "number" ||
        typeof row.verified_return_visits !== "number" ||
        typeof row.rewards_redeemed !== "number" ||
        typeof row.metric_definition_version !== "string" ||
        typeof row.metric_snapshot_at !== "string"
      ) {
        return []
      }

      return [
        {
          id: row.id,
          attributionName: row.attribution_name,
          afterSummary: row.after_summary,
          testimonialQuote:
            typeof row.testimonial_quote === "string"
              ? row.testimonial_quote
              : null,
          measurementStart: row.measurement_start,
          measurementEnd: row.measurement_end,
          newMembers: row.new_members,
          verifiedReturnVisits: row.verified_return_visits,
          rewardsRedeemed: row.rewards_redeemed,
          definitionVersion: row.metric_definition_version,
          snapshotAt: row.metric_snapshot_at,
        },
      ]
    })
  },
  ["published-commercial-evidence-v1"],
  { revalidate: 300, tags: ["commercial-evidence"] }
)

export async function getPublishedCommercialEvidence() {
  return loadPublishedCommercialEvidence()
}

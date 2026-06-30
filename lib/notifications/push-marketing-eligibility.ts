import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

import { latestPushMarketingConsentOptedIn } from "@/lib/notifications/push-marketing-eligibility-core"

type SupabaseServiceRoleClient = ReturnType<
  typeof createSupabaseServiceRoleClient
>

export async function hasPushMarketingConsent(
  supabase: SupabaseServiceRoleClient,
  {
    customerId,
    merchantId,
  }: {
    readonly customerId: string
    readonly merchantId: string
  }
) {
  const { data, error } = await supabase
    .from("consent_records")
    .select("customer_id, channel, consent_status, created_at")
    .eq("customer_id", customerId)
    .eq("merchant_id", merchantId)
    .eq("channel", "push")
    .order("created_at", { ascending: false })
    .limit(1)

  if (error) {
    throw new Error(`Unable to load push marketing consent: ${error.message}`)
  }

  return latestPushMarketingConsentOptedIn(data ?? [])
}

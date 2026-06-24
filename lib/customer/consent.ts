import "server-only"

import { getCurrentCustomer } from "@/lib/customer/identity"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type MarketingChannel = "email" | "sms" | "whatsapp" | "push"

const MARKETING_CHANNELS: readonly MarketingChannel[] = [
  "email",
  "sms",
  "whatsapp",
  "push",
]

/**
 * Consent policy version captured with each marketing-consent record. Mirrors the
 * value used at join time in `app/m/[merchantSlug]/join/actions.ts`.
 */
export const MARKETING_POLICY_VERSION = "2026-06-06"

export function isMarketingChannel(value: string): value is MarketingChannel {
  return (MARKETING_CHANNELS as readonly string[]).includes(value)
}

/**
 * Records a global marketing preference for the signed-in customer. The RPC writes
 * one append-only `consent_records` row per membership, so the per-merchant audit
 * trail is preserved while the customer manages a single toggle per channel. Reads
 * stay in `getCustomerProfile` (latest row per channel).
 */
export async function updateCustomerMarketingConsent({
  channel,
  optedIn,
}: {
  channel: MarketingChannel
  optedIn: boolean
}): Promise<void> {
  const customer = await getCurrentCustomer()
  if (!customer) throw new Error("No signed-in customer to update.")

  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase.rpc("record_customer_marketing_consent", {
    p_customer_id: customer.id,
    p_channel: channel,
    p_consent_status: optedIn ? "opted_in" : "opted_out",
    p_policy_version: MARKETING_POLICY_VERSION,
  })

  if (error) {
    throw new Error(`Unable to update marketing consent: ${error.message}`)
  }
}

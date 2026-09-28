import "server-only"

import { getCurrentCustomer } from "@/lib/customer/identity"
import { CUSTOMER_LEGAL_VERSION } from "@/lib/legal/content"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type MarketingChannel = "email" | "sms" | "whatsapp" | "push"

const MARKETING_CHANNELS: readonly MarketingChannel[] = [
  "email",
  "sms",
  "whatsapp",
  "push",
]

/** Channels delivered to a phone, so only for a wallet that holds one. */
export const PHONE_MARKETING_CHANNELS: ReadonlySet<MarketingChannel> = new Set([
  "sms",
  "whatsapp",
])

/**
 * The current join RPC records one policy version for the accepted venue terms
 * and the optional marketing row, so profile changes keep that version aligned.
 */
export const MARKETING_POLICY_VERSION = CUSTOMER_LEGAL_VERSION

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
  // record_customer_marketing_consent accepts any channel, so the phone
  // channels are refused here for a wallet with no phone (email-only).
  if (
    optedIn &&
    PHONE_MARKETING_CHANNELS.has(channel) &&
    !customer.phoneLast4
  ) {
    throw new Error("Phone marketing needs a phone number on the wallet.")
  }

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

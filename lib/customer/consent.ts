import "server-only"

import { cache } from "react"

import {
  marketingConsentRefusal,
  type MarketingConsentEligibility,
  type MarketingConsentRefusal,
} from "@/lib/customer/experience/marketing-consent-row"
import { getCurrentCustomer } from "@/lib/customer/identity"
import { customerHasVerifiedPhone } from "@/lib/customer/phone-verification-state"
import { CUSTOMER_LEGAL_VERSION } from "@/lib/legal/content"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type { MarketingConsentEligibility, MarketingConsentRefusal }

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

async function loadMarketingConsentEligibility(customer: {
  id: string
  emailVerifiedAt: string | null
}): Promise<MarketingConsentEligibility> {
  const supabase = createSupabaseServiceRoleClient()
  const [hasVerifiedPhone, memberships] = await Promise.all([
    customerHasVerifiedPhone(customer.id),
    supabase
      .from("customer_memberships")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customer.id),
  ])
  if (memberships.error) {
    throw new Error(`Unable to load memberships: ${memberships.error.message}`)
  }
  return {
    hasVerifiedPhone,
    hasVerifiedEmail: Boolean(customer.emailVerifiedAt),
    membershipCount: memberships.count ?? 0,
  }
}

/**
 * Which marketing channels the signed-in wallet can choose: a verified phone
 * for text and WhatsApp, a verified email for email, and at least one venue
 * membership to record the choice against. Null when nobody is signed in.
 */
export const getMarketingConsentEligibility = cache(
  async (): Promise<MarketingConsentEligibility | null> => {
    const customer = await getCurrentCustomer()
    return customer ? loadMarketingConsentEligibility(customer) : null
  }
)

/**
 * Records a global marketing preference for the signed-in customer. The RPC writes
 * one append-only `consent_records` row per membership, so the per-merchant audit
 * trail is preserved while the customer manages a single toggle per channel. Reads
 * stay in `getCustomerProfile` (latest row per channel).
 *
 * Returns why nothing was recorded, or null once the RPC has written the rows.
 * record_customer_marketing_consent accepts any channel and silently writes
 * nothing without a membership, so an opt-in needs the verified contact for
 * its channel (an unverified or staged contact counts as absent) and any
 * change needs a membership.
 */
export async function updateCustomerMarketingConsent({
  channel,
  optedIn,
}: {
  channel: MarketingChannel
  optedIn: boolean
}): Promise<MarketingConsentRefusal | null> {
  const customer = await getCurrentCustomer()
  if (!customer) throw new Error("No signed-in customer to update.")

  const refusal = marketingConsentRefusal({
    channel,
    optedIn,
    eligibility: await loadMarketingConsentEligibility(customer),
  })
  if (refusal) return refusal

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
  return null
}

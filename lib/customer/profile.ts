import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { getCurrentCustomer } from "@/lib/customer/identity"

export type ConsentChannel = "email" | "sms" | "whatsapp"

export type CustomerConsent = {
  channel: ConsentChannel
  optedIn: boolean
}

export type CustomerProfile = {
  email: string | null
  phone: string | null
  memberSince: string
  membershipCount: number
  consents: CustomerConsent[]
}

/**
 * Account-level detail for the signed-in customer: contact channels, when they
 * joined, how many venues they belong to, and their latest marketing-consent
 * state per channel (read-only in this pass). Returns `null` for a signed-in
 * user with no `customers` row yet.
 */
export async function getCustomerProfile(): Promise<CustomerProfile | null> {
  const customer = await getCurrentCustomer()

  if (!customer) return null

  const supabase = createSupabaseServiceRoleClient()

  const [membershipResult, consentResult] = await Promise.all([
    supabase
      .from("customer_memberships")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customer.id),
    supabase
      .from("consent_records")
      .select("channel, consent_status, created_at")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false }),
  ])

  if (membershipResult.error) {
    throw new Error(`Unable to load memberships: ${membershipResult.error.message}`)
  }
  if (consentResult.error) {
    throw new Error(`Unable to load consents: ${consentResult.error.message}`)
  }

  // Keep only the latest record per channel (rows arrive newest-first).
  const latestByChannel = new Map<ConsentChannel, boolean>()
  for (const row of consentResult.data ?? []) {
    const channel = row.channel as ConsentChannel
    if (!latestByChannel.has(channel)) {
      latestByChannel.set(channel, row.consent_status === "opted_in")
    }
  }

  const consents: CustomerConsent[] = [...latestByChannel.entries()].map(
    ([channel, optedIn]) => ({ channel, optedIn })
  )

  return {
    email: customer.email,
    phone: customer.phone,
    memberSince: customer.createdAt,
    membershipCount: membershipResult.count ?? 0,
    consents,
  }
}

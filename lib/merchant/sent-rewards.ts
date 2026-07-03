import "server-only"

import { getCurrentMerchant } from "@/lib/auth/session"
import { formatMerchantCustomerIdentifier } from "@/lib/merchant/customer-identity-display"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type SentReward = {
  rewardId: string
  memberLabel: string
  rewardName: string
  status: string
  createdAt: string
  expiresAt: string | null
}

/**
 * A merchant's own sent (`merchant_direct`) rewards, newest first, with the
 * recipient masked. Invite rows join this list in Phase 4.
 */
export async function getMerchantSentRewards(
  merchantId: string,
  limit = 20
): Promise<SentReward[]> {
  const merchant = await getCurrentMerchant()
  if (!merchant || merchant.id !== merchantId) {
    throw new Error("Current merchant access required for sent rewards.")
  }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("reward_events")
    .select("id, reward_name, status, created_at, expires_at, customer_id")
    .eq("merchant_id", merchantId)
    .eq("source", "merchant_direct")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Unable to load sent rewards: ${error.message}`)
  }

  const rows = data ?? []
  const customerIds = [
    ...new Set(
      rows.map((row) => row.customer_id).filter((id): id is string => Boolean(id))
    ),
  ]
  const maskedById = await loadMaskedCustomers(customerIds)

  return rows.map((row) => ({
    rewardId: row.id as string,
    memberLabel: formatMerchantCustomerIdentifier(
      row.customer_id ? (maskedById.get(row.customer_id) ?? null) : null
    ),
    rewardName: row.reward_name as string,
    status: row.status as string,
    createdAt: row.created_at as string,
    expiresAt: (row.expires_at as string | null) ?? null,
  }))
}

async function loadMaskedCustomers(ids: string[]) {
  const byId = new Map<string, { email: string | null; phone: string | null }>()
  if (!ids.length) return byId

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customers_masked")
    .select("id, email, phone")
    .in("id", ids)

  if (error) {
    throw new Error(`Unable to load masked sent-reward members: ${error.message}`)
  }

  for (const customer of (data ?? []) as Array<{
    id: string
    email: string | null
    phone: string | null
  }>) {
    byId.set(customer.id, { email: customer.email, phone: customer.phone })
  }

  return byId
}

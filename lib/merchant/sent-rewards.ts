import "server-only"

import { getCurrentMerchant } from "@/lib/auth/session"
import { formatMerchantCustomerIdentifier } from "@/lib/merchant/customer-identity-display"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type SentRewardTone = "leaf" | "sun" | "plain"

export type SentReward = {
  rewardId: string
  memberLabel: string
  rewardName: string
  statusLabel: string
  statusTone: SentRewardTone
  createdAt: string
  kind: "reward" | "invite"
}

/**
 * A merchant's own sent rewards + pending invites, newest first, with the
 * recipient masked. Invite statuses are collapsed to the same label as a
 * direct send so the merchant cannot use this list to probe membership.
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
  const [rewardsResult, invitesResult] = await Promise.all([
    supabase
      .from("reward_events")
      .select("id, reward_name, status, created_at, customer_id")
      .eq("merchant_id", merchantId)
      .eq("source", "merchant_direct")
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("pending_reward_invites")
      .select("id, reward_name, created_at, email_masked, phone_last4")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false })
      .limit(limit),
  ])

  if (rewardsResult.error) {
    throw new Error(
      `Unable to load sent rewards: ${rewardsResult.error.message}`
    )
  }
  if (invitesResult.error) {
    throw new Error(
      `Unable to load reward invites: ${invitesResult.error.message}`
    )
  }

  const rewardRows = rewardsResult.data ?? []
  const customerIds = [
    ...new Set(
      rewardRows
        .map((row) => row.customer_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]
  const maskedById = await loadMaskedCustomers(customerIds)

  const rewards: SentReward[] = rewardRows.map((row) => ({
    rewardId: row.id as string,
    memberLabel: formatMerchantCustomerIdentifier(
      row.customer_id ? (maskedById.get(row.customer_id) ?? null) : null
    ),
    rewardName: row.reward_name as string,
    ...rewardStatus(row.status as string),
    createdAt: row.created_at as string,
    kind: "reward" as const,
  }))

  const invites: SentReward[] = (invitesResult.data ?? []).map((row) => ({
    rewardId: row.id as string,
    memberLabel:
      (row.email_masked as string | null) ??
      (row.phone_last4 ? `Phone ending ${row.phone_last4}` : "New contact"),
    rewardName: row.reward_name as string,
    ...inviteStatus(),
    createdAt: row.created_at as string,
    kind: "invite" as const,
  }))

  return [...rewards, ...invites]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
}

function rewardStatus(status: string): {
  statusLabel: string
  statusTone: SentRewardTone
} {
  switch (status) {
    case "redeemed":
      return { statusLabel: "Redeemed", statusTone: "leaf" }
    case "expired":
      return { statusLabel: "Expired", statusTone: "plain" }
    case "cancelled":
      return { statusLabel: "Cancelled", statusTone: "plain" }
    default:
      return { statusLabel: "Sent", statusTone: "sun" }
  }
}

function inviteStatus(): {
  statusLabel: string
  statusTone: SentRewardTone
} {
  return { statusLabel: "Sent", statusTone: "sun" }
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
    throw new Error(
      `Unable to load masked sent-reward members: ${error.message}`
    )
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

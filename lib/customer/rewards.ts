import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { firstOf, getCurrentCustomer } from "@/lib/customer/identity"
import {
  narrowRewardSource,
  type RewardSource,
} from "@/lib/customer/issued-reward-display"
import { isRedeemableFrom } from "@/lib/customer/uk-date"

export type CustomerRewardItem = {
  rewardId: string
  membershipId: string
  businessName: string
  rewardName: string
  rewardTerms: string
  source: RewardSource
  redeemableFrom: string | null
  expiresAt: string | null
  expiredAt: string | null
  redeemedAt: string | null
  createdAt: string
}

export type CustomerRewards = {
  redeemable: CustomerRewardItem[]
  upcoming: CustomerRewardItem[]
  redeemed: CustomerRewardItem[]
  expired: CustomerRewardItem[]
}

type RawRewardEvent = {
  id: string
  membership_id: string
  status: string
  source: string | null
  reward_name: string
  reward_terms: string
  redeemable_from: string | null
  expires_at: string | null
  expired_at: string | null
  redeemed_at: string | null
  created_at: string
  merchants: { business_name: string } | Array<{ business_name: string }> | null
}

export async function getCustomerRewards(): Promise<CustomerRewards> {
  const customer = await getCurrentCustomer()

  if (!customer) {
    return { redeemable: [], upcoming: [], redeemed: [], expired: [] }
  }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("reward_events")
    .select(
      "id, membership_id, status, source, reward_name, reward_terms, redeemable_from, expires_at, expired_at, redeemed_at, created_at, merchants(business_name)"
    )
    .eq("customer_id", customer.id)
    .in("status", ["unlocked", "redeemed", "expired"])
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(`Unable to load rewards: ${error.message}`)
  }

  const rows = (data ?? []) as RawRewardEvent[]
  const redeemable: CustomerRewardItem[] = []
  const upcoming: CustomerRewardItem[] = []
  const redeemed: CustomerRewardItem[] = []
  const expired: CustomerRewardItem[] = []

  for (const row of rows) {
    const merchant = firstOf(row.merchants)
    const item: CustomerRewardItem = {
      rewardId: row.id,
      membershipId: row.membership_id,
      businessName: merchant?.business_name ?? "Unknown venue",
      rewardName: row.reward_name,
      rewardTerms: row.reward_terms,
      source: narrowRewardSource(row.source),
      redeemableFrom: row.redeemable_from,
      expiresAt: row.expires_at,
      expiredAt: row.expired_at,
      redeemedAt: row.redeemed_at,
      createdAt: row.created_at,
    }

    if (row.status === "redeemed") {
      redeemed.push(item)
    } else if (row.status === "expired" || isRewardExpired(row.expires_at)) {
      expired.push(item)
    } else if (isRedeemableFrom(row.redeemable_from)) {
      redeemable.push(item)
    } else {
      upcoming.push(item)
    }
  }

  redeemed.sort((a, b) =>
    (b.redeemedAt ?? b.createdAt).localeCompare(a.redeemedAt ?? a.createdAt)
  )
  expired.sort((a, b) =>
    (b.expiredAt ?? b.expiresAt ?? b.createdAt).localeCompare(
      a.expiredAt ?? a.expiresAt ?? a.createdAt
    )
  )

  return { redeemable, upcoming, redeemed, expired }
}

export function isRewardExpired(expiresAt: string | null, now = new Date()) {
  return expiresAt ? new Date(expiresAt).getTime() <= now.getTime() : false
}

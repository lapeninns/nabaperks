import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { firstOf, getCurrentCustomer } from "@/lib/customer/identity"
import {
  narrowRewardSource,
  type RewardSource,
} from "@/lib/customer/issued-reward-display"
import { getRewardCollectionState } from "@/lib/customer/reward"
import type { RewardCollectionState } from "@/lib/customer/reward-collection-state"
import { groupRewardsForList } from "@/lib/customer/reward-list-groups"

export type CustomerRewardItem = {
  rewardId: string
  membershipId: string
  businessName: string
  rewardName: string
  rewardTerms: string
  source: RewardSource
  collectionState: RewardCollectionState
  collectionReason: string | null
  availableFrom: string | null
  redeemableFrom: string | null
  expiresAt: string | null
  expiredAt: string | null
  redeemedAt: string | null
  createdAt: string
}

export type CustomerRewards = {
  /** Ready to collect now. */
  redeemable: CustomerRewardItem[]
  /** Unlocked, but a detail must be added on the reward page first. */
  needsSetup: CustomerRewardItem[]
  /** Waiting for its opening time, or held by the venue. */
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
    return {
      redeemable: [],
      needsSetup: [],
      upcoming: [],
      redeemed: [],
      expired: [],
    }
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
  const collections = await Promise.all(
    rows.map((row) => getRewardCollectionState(supabase, row.id))
  )
  const items = rows.map((row, index): CustomerRewardItem => {
    const merchant = firstOf(row.merchants)
    const collection = collections[index]
    return {
      rewardId: row.id,
      membershipId: row.membership_id,
      businessName: merchant?.business_name ?? "Unknown venue",
      rewardName: row.reward_name,
      rewardTerms: row.reward_terms,
      source: narrowRewardSource(row.source),
      collectionState: collection.state,
      collectionReason: collection.reason,
      availableFrom: collection.availableFrom,
      redeemableFrom: row.redeemable_from,
      expiresAt: collection.expiresAt,
      expiredAt: row.expired_at,
      redeemedAt: row.redeemed_at,
      createdAt: row.created_at,
    }
  })
  const { redeemable, needsSetup, upcoming, redeemed, expired } =
    groupRewardsForList(items)

  redeemed.sort((a, b) =>
    (b.redeemedAt ?? b.createdAt).localeCompare(a.redeemedAt ?? a.createdAt)
  )
  expired.sort((a, b) =>
    (b.expiredAt ?? b.expiresAt ?? b.createdAt).localeCompare(
      a.expiredAt ?? a.expiresAt ?? a.createdAt
    )
  )

  return { redeemable, needsSetup, upcoming, redeemed, expired }
}

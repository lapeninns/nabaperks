import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { firstOf, getCurrentCustomer } from "@/lib/customer/identity"
import { isRedeemableFrom } from "@/lib/customer/uk-date"

export type CustomerRewardItem = {
  rewardId: string
  membershipId: string
  businessName: string
  rewardName: string
  rewardTerms: string
  minSpendPence: number | null
  redeemableFrom: string | null
  redeemedAt: string | null
  createdAt: string
}

export type CustomerRewards = {
  redeemable: CustomerRewardItem[]
  upcoming: CustomerRewardItem[]
  redeemed: CustomerRewardItem[]
}

type RawRewardEvent = {
  id: string
  membership_id: string
  status: string
  reward_name: string
  reward_terms: string
  min_spend_pence: number | null
  redeemable_from: string | null
  redeemed_at: string | null
  created_at: string
  merchants: { business_name: string } | Array<{ business_name: string }> | null
}

export async function getCustomerRewards(): Promise<CustomerRewards> {
  const customer = await getCurrentCustomer()

  if (!customer) return { redeemable: [], upcoming: [], redeemed: [] }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("reward_events")
    .select(
      "id, membership_id, status, reward_name, reward_terms, min_spend_pence, redeemable_from, redeemed_at, created_at, merchants(business_name)"
    )
    .eq("customer_id", customer.id)
    .in("status", ["unlocked", "redeemed"])
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(`Unable to load rewards: ${error.message}`)
  }

  const rows = (data ?? []) as RawRewardEvent[]
  const redeemable: CustomerRewardItem[] = []
  const upcoming: CustomerRewardItem[] = []
  const redeemed: CustomerRewardItem[] = []

  for (const row of rows) {
    const merchant = firstOf(row.merchants)
    const item: CustomerRewardItem = {
      rewardId: row.id,
      membershipId: row.membership_id,
      businessName: merchant?.business_name ?? "Unknown venue",
      rewardName: row.reward_name,
      rewardTerms: row.reward_terms,
      minSpendPence: row.min_spend_pence,
      redeemableFrom: row.redeemable_from,
      redeemedAt: row.redeemed_at,
      createdAt: row.created_at,
    }

    if (row.status === "redeemed") {
      redeemed.push(item)
    } else if (isRedeemableFrom(row.redeemable_from)) {
      redeemable.push(item)
    } else {
      upcoming.push(item)
    }
  }

  redeemed.sort((a, b) =>
    (b.redeemedAt ?? b.createdAt).localeCompare(a.redeemedAt ?? a.createdAt)
  )

  return { redeemable, upcoming, redeemed }
}

import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { firstOf, getCurrentCustomer } from "@/lib/customer/identity"
import {
  isRewardExpired,
  narrowRewardSource,
  type RewardSource,
} from "@/lib/customer/issued-reward-display"
import {
  CUSTOMER_REWARD_HISTORY_PAGE_SIZE,
  normalizeRewardHistoryPage,
  rewardHistoryRange,
} from "@/lib/customer/reward-history-pagination"
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
  historyPage: number
  historyPageCount: number
  historyTotal: number
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

export async function getCustomerRewards(
  requestedHistoryPage = 1
): Promise<CustomerRewards> {
  const customer = await getCurrentCustomer()
  const historyPage = normalizeRewardHistoryPage(requestedHistoryPage)

  if (!customer) {
    return emptyRewards(historyPage)
  }

  const supabase = createSupabaseServiceRoleClient()
  const historyRange = rewardHistoryRange(historyPage)
  const rewardFields =
    "id, membership_id, status, source, reward_name, reward_terms, redeemable_from, expires_at, expired_at, redeemed_at, created_at, merchants(business_name)"

  const [activeResult, historyResult] = await Promise.all([
    supabase
      .from("reward_events")
      .select(rewardFields)
      .eq("customer_id", customer.id)
      .eq("status", "unlocked")
      .order("created_at", { ascending: false }),
    supabase
      .from("reward_events")
      .select(rewardFields, { count: "exact" })
      .eq("customer_id", customer.id)
      .in("status", ["redeemed", "expired"])
      .order("created_at", { ascending: false })
      .range(historyRange.from, historyRange.to),
  ])

  if (activeResult.error) {
    throw new Error(
      `Unable to load active rewards: ${activeResult.error.message}`
    )
  }
  if (historyResult.error) {
    throw new Error(
      `Unable to load reward history: ${historyResult.error.message}`
    )
  }

  const activeRows = (activeResult.data ?? []) as RawRewardEvent[]
  const historyRows = (historyResult.data ?? []) as RawRewardEvent[]
  const rows = [...activeRows, ...historyRows]
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

  const historyTotal = historyResult.count ?? 0

  return {
    redeemable,
    upcoming,
    redeemed,
    expired,
    historyPage,
    historyPageCount: Math.ceil(
      historyTotal / CUSTOMER_REWARD_HISTORY_PAGE_SIZE
    ),
    historyTotal,
  }
}

function emptyRewards(historyPage: number): CustomerRewards {
  return {
    redeemable: [],
    upcoming: [],
    redeemed: [],
    expired: [],
    historyPage,
    historyPageCount: 0,
    historyTotal: 0,
  }
}

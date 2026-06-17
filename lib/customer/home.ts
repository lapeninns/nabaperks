import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import {
  getMembershipStampDisplayDatesByMembership,
  reconcileCardStampCount,
  unavailableMessage,
} from "@/lib/customer/card"
import { getCustomerActivity } from "@/lib/customer/activity"
import { buildHomeSummary, sortHomeCards } from "@/lib/customer/home-dashboard"
import {
  buildRewardCountsByMembership,
  emptyRewardCounts,
  getTopRedeemable,
  type RawHomeReward,
} from "@/lib/customer/home-rewards"
import type {
  CustomerHome,
  HomeCard,
  HomeDashboard,
  HomeSummary,
} from "@/lib/customer/home-types"
import { firstOf, getCurrentCustomer } from "@/lib/customer/identity"
import { ukTodayIso } from "@/lib/customer/uk-date"

export type {
  CustomerHome,
  HomeCard,
  HomeDashboard,
  HomeSummary,
  TopRedeemable,
} from "@/lib/customer/home-types"

type RawHomeMembership = {
  id: string
  merchant_id: string
  current_stamp_count: number
  active_cycle_number: number
  last_visit_at: string | null
  merchants:
    | { business_name: string; business_slug: string; status: string }
    | Array<{ business_name: string; business_slug: string; status: string }>
    | null
}

type RawLoyaltyCard = {
  merchant_id: string
  card_name: string
  stamps_required: number
  reward_name: string
  is_active: boolean
}

const HOME_STAMP_EVENT_LIMIT = 12
const EMPTY_SUMMARY: HomeSummary = {
  cardCount: 0,
  redeemableCount: 0,
  stampAvailableCount: 0,
}

/**
 * Every loyalty card the signed-in customer holds, across all merchants, with
 * live stamp progress and unlocked-reward counts. Powers the home dashboard.
 * Returns an empty list for a signed-in user who has not joined anything yet.
 */
export async function getCustomerHome(): Promise<CustomerHome> {
  const { cards } = await getCustomerHomeDashboard()
  return { cards }
}

export async function getCustomerHomeDashboard(): Promise<HomeDashboard> {
  const customer = await getCurrentCustomer()

  if (!customer) return emptyDashboard()

  const supabase = createSupabaseServiceRoleClient()

  const { data: membershipRows, error } = await supabase
    .from("customer_memberships")
    .select(
      "id, merchant_id, current_stamp_count, active_cycle_number, last_visit_at, merchants(business_name, business_slug, status)"
    )
    .eq("customer_id", customer.id)
    .order("last_visit_at", { ascending: false, nullsFirst: false })

  if (error) {
    throw new Error(`Unable to load cards: ${error.message}`)
  }

  const memberships = (membershipRows ?? []) as RawHomeMembership[]

  if (memberships.length === 0) return emptyDashboard()

  const merchantIds = [...new Set(memberships.map((m) => m.merchant_id))]
  const membershipIds = memberships.map((m) => m.id)
  // Live card progress counts only the active cycle's stamps, so a card that has
  // rolled over after a redemption shows the new cycle, not lifetime history.
  const activeCycleByMembership = new Map(
    memberships.map((m) => [m.id, m.active_cycle_number])
  )

  const [
    cardsResult,
    rewardsResult,
    billingResult,
    stampDatesByMembership,
    recentActivity,
  ] = await Promise.all([
    supabase
      .from("loyalty_cards")
      .select(
        "merchant_id, card_name, stamps_required, reward_name, is_active, created_at"
      )
      .in("merchant_id", merchantIds)
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("reward_events")
      .select("id, membership_id, reward_name, redeemable_from")
      .in("membership_id", membershipIds)
      .eq("status", "unlocked"),
    supabase
      .from("billing_customers")
      .select("merchant_id, status")
      .in("merchant_id", merchantIds),
    getMembershipStampDisplayDatesByMembership(
      membershipIds,
      HOME_STAMP_EVENT_LIMIT,
      activeCycleByMembership
    ),
    getCustomerActivity(3),
  ])

  if (cardsResult.error) {
    throw new Error(
      `Unable to load loyalty cards: ${cardsResult.error.message}`
    )
  }
  if (rewardsResult.error) {
    throw new Error(`Unable to load rewards: ${rewardsResult.error.message}`)
  }
  if (billingResult.error) {
    throw new Error(
      `Unable to load billing status: ${billingResult.error.message}`
    )
  }

  // Ordered is_active desc, created asc → first row per merchant is the
  // active (or earliest) card, matching getCustomerCardState's selection.
  const cardByMerchant = new Map<string, RawLoyaltyCard>()
  for (const card of (cardsResult.data ?? []) as RawLoyaltyCard[]) {
    if (!cardByMerchant.has(card.merchant_id))
      cardByMerchant.set(card.merchant_id, card)
  }

  const billingByMerchant = new Map<string, string | null>()
  for (const row of billingResult.data ?? []) {
    billingByMerchant.set(row.merchant_id, row.status)
  }

  const rewardsByMembership = buildRewardCountsByMembership(
    (rewardsResult.data ?? []) as RawHomeReward[]
  )

  const today = ukTodayIso()
  const cards: HomeCard[] = memberships.map((membership) => {
    const merchant = firstOf(membership.merchants)
    const card = cardByMerchant.get(membership.merchant_id) ?? null
    const billingStatus = billingByMerchant.get(membership.merchant_id) ?? null
    const unavailableReason = merchant
      ? unavailableMessage(
          merchant.status,
          card?.is_active ?? false,
          billingStatus
        )
      : "This loyalty programme is unavailable at the moment."
    const rewards =
      rewardsByMembership.get(membership.id) ?? emptyRewardCounts()
    const stampsRequired = card?.stamps_required ?? null
    const stampInfo = stampDatesByMembership.get(membership.id) ?? {
      stampDates: [],
      latestBusinessDate: null,
    }
    const currentStamps =
      stampsRequired !== null
        ? reconcileCardStampCount({
            membershipCount: membership.current_stamp_count,
            stampDateCount: stampInfo.stampDates.length,
            total: stampsRequired,
          })
        : membership.current_stamp_count
    const stampDates =
      stampsRequired !== null
        ? stampInfo.stampDates.slice(0, currentStamps)
        : stampInfo.stampDates

    return {
      membershipId: membership.id,
      businessName: merchant?.business_name ?? "Unknown venue",
      businessSlug: merchant?.business_slug ?? "",
      cardName: card?.card_name ?? null,
      rewardName: card?.reward_name ?? null,
      currentStamps,
      stampsRequired,
      stampDates,
      stampedToday: stampInfo.latestBusinessDate === today,
      lastVisitAt: membership.last_visit_at,
      stampsRemaining:
        stampsRequired !== null
          ? Math.max(stampsRequired - currentStamps, 0)
          : 0,
      unlockedRewards: rewards.total,
      redeemableRewards: rewards.redeemable,
      ...(rewards.primaryRewardId
        ? { primaryRewardId: rewards.primaryRewardId }
        : {}),
      revealedRewardName: rewards.revealedRewardName,
      revealedRewardRedeemableFrom: rewards.revealedRewardRedeemableFrom,
      available: !unavailableReason,
      unavailableReason,
    }
  })

  const sortedCards = sortHomeCards(cards)
  const topRedeemable = getTopRedeemable(sortedCards, rewardsByMembership)

  return {
    cards: sortedCards,
    summary: buildHomeSummary(sortedCards),
    ...(topRedeemable ? { topRedeemable } : {}),
    recentActivity,
  }
}

function emptyDashboard(): HomeDashboard {
  return {
    cards: [],
    summary: { ...EMPTY_SUMMARY },
    recentActivity: [],
  }
}

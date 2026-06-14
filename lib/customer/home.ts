import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { unavailableMessage } from "@/lib/customer/card"
import { firstOf, getCurrentCustomer } from "@/lib/customer/identity"
import { isRedeemableFrom } from "@/lib/customer/uk-date"

export type HomeCard = {
  membershipId: string
  businessName: string
  businessSlug: string
  cardName: string | null
  rewardName: string | null
  currentStamps: number
  stampsRequired: number | null
  unlockedRewards: number
  redeemableRewards: number
  available: boolean
  unavailableReason?: string
}

export type CustomerHome = {
  cards: HomeCard[]
}

type RawHomeMembership = {
  id: string
  merchant_id: string
  current_stamp_count: number
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

/**
 * Every loyalty card the signed-in customer holds, across all merchants, with
 * live stamp progress and unlocked-reward counts. Powers the home dashboard.
 * Returns an empty list for a signed-in user who has not joined anything yet.
 */
export async function getCustomerHome(): Promise<CustomerHome> {
  const customer = await getCurrentCustomer()

  if (!customer) return { cards: [] }

  const supabase = createSupabaseServiceRoleClient()

  const { data: membershipRows, error } = await supabase
    .from("customer_memberships")
    .select(
      "id, merchant_id, current_stamp_count, last_visit_at, merchants(business_name, business_slug, status)"
    )
    .eq("customer_id", customer.id)
    .order("last_visit_at", { ascending: false, nullsFirst: false })

  if (error) {
    throw new Error(`Unable to load cards: ${error.message}`)
  }

  const memberships = (membershipRows ?? []) as RawHomeMembership[]

  if (memberships.length === 0) return { cards: [] }

  const merchantIds = [...new Set(memberships.map((m) => m.merchant_id))]
  const membershipIds = memberships.map((m) => m.id)

  const [cardsResult, rewardsResult, billingResult] = await Promise.all([
    supabase
      .from("loyalty_cards")
      .select("merchant_id, card_name, stamps_required, reward_name, is_active, created_at")
      .in("merchant_id", merchantIds)
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("reward_events")
      .select("membership_id, redeemable_from")
      .in("membership_id", membershipIds)
      .eq("status", "unlocked"),
    supabase
      .from("billing_customers")
      .select("merchant_id, status")
      .in("merchant_id", merchantIds),
  ])

  if (cardsResult.error) {
    throw new Error(`Unable to load loyalty cards: ${cardsResult.error.message}`)
  }
  if (rewardsResult.error) {
    throw new Error(`Unable to load rewards: ${rewardsResult.error.message}`)
  }
  if (billingResult.error) {
    throw new Error(`Unable to load billing status: ${billingResult.error.message}`)
  }

  // Ordered is_active desc, created asc → first row per merchant is the
  // active (or earliest) card, matching getCustomerCardState's selection.
  const cardByMerchant = new Map<string, RawLoyaltyCard>()
  for (const card of (cardsResult.data ?? []) as RawLoyaltyCard[]) {
    if (!cardByMerchant.has(card.merchant_id)) cardByMerchant.set(card.merchant_id, card)
  }

  const billingByMerchant = new Map<string, string | null>()
  for (const row of billingResult.data ?? []) {
    billingByMerchant.set(row.merchant_id, row.status)
  }

  const rewardsByMembership = new Map<string, { total: number; redeemable: number }>()
  for (const row of (rewardsResult.data ?? []) as Array<{
    membership_id: string
    redeemable_from: string | null
  }>) {
    const entry = rewardsByMembership.get(row.membership_id) ?? { total: 0, redeemable: 0 }
    entry.total += 1
    if (isRedeemableFrom(row.redeemable_from)) entry.redeemable += 1
    rewardsByMembership.set(row.membership_id, entry)
  }

  const cards: HomeCard[] = memberships.map((membership) => {
    const merchant = firstOf(membership.merchants)
    const card = cardByMerchant.get(membership.merchant_id) ?? null
    const billingStatus = billingByMerchant.get(membership.merchant_id) ?? null
    const unavailableReason = merchant
      ? unavailableMessage(merchant.status, card?.is_active ?? false, billingStatus)
      : "This loyalty programme is unavailable at the moment."
    const rewards = rewardsByMembership.get(membership.id) ?? { total: 0, redeemable: 0 }
    const stampsRequired = card?.stamps_required ?? null

    return {
      membershipId: membership.id,
      businessName: merchant?.business_name ?? "Unknown venue",
      businessSlug: merchant?.business_slug ?? "",
      cardName: card?.card_name ?? null,
      rewardName: card?.reward_name ?? null,
      currentStamps:
        stampsRequired !== null
          ? Math.min(membership.current_stamp_count, stampsRequired)
          : membership.current_stamp_count,
      stampsRequired,
      unlockedRewards: rewards.total,
      redeemableRewards: rewards.redeemable,
      available: !unavailableReason,
      unavailableReason,
    }
  })

  return { cards }
}

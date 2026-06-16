import "server-only"

import { getCurrentCustomer } from "@/lib/customer/identity"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export {
  getMembershipStampDisplayDates,
  getMembershipStampDisplayDatesByMembership,
  reconcileCardStampCount,
  type MembershipStampDisplayDates,
} from "@/lib/customer/card-stamps"

export type CustomerCardState =
  | { status: "unauthenticated" | "unauthorized" | "not_found" }
  | {
      status: "ready"
      unavailableReason?: string
      membership: {
        id: string
        current_stamp_count: number
        total_rewards_redeemed: number
        active_cycle_number: number
      }
      merchant: {
        id: string
        business_name: string
        business_slug: string
        status: string
      }
      loyaltyCard: {
        card_name: string
        stamps_required: number
        reward_name: string
        reward_terms: string
        min_spend_pence: number | null
        is_active: boolean
      } | null
      latestReward: {
        id: string
        status: string
        reward_name: string
        reward_terms: string
        min_spend_pence: number | null
        redeemable_from: string | null
      } | null
      billingStatus: string | null
    }

type RawMembership = {
  id: string
  merchant_id: string
  customer_id: string
  current_stamp_count: number
  total_rewards_redeemed: number
  active_cycle_number: number
  merchants:
    | {
        business_name: string
        business_slug: string
        status: string
      }
    | Array<{
        business_name: string
        business_slug: string
        status: string
      }>
}

export async function getCustomerCardState(
  membershipId: string
): Promise<CustomerCardState> {
  const currentCustomer = await getCurrentCustomer()

  if (!currentCustomer) return { status: "unauthenticated" }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customer_memberships")
    .select(
      "id, merchant_id, customer_id, current_stamp_count, total_rewards_redeemed, active_cycle_number, merchants(business_name, business_slug, status)"
    )
    .eq("id", membershipId)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to load customer card: ${error.message}`)
  }

  if (!data) return { status: "not_found" }

  const membership = data as RawMembership
  const merchant = first(membership.merchants)

  if (membership.customer_id !== currentCustomer.id) {
    return { status: "unauthorized" }
  }

  const [
    { data: loyaltyCard, error: cardError },
    { data: latestReward, error: rewardError },
    { data: billing, error: billingError },
  ] = await Promise.all([
    supabase
      .from("loyalty_cards")
      .select(
        "card_name, stamps_required, reward_name, reward_terms, min_spend_pence, is_active"
      )
      .eq("merchant_id", membership.merchant_id)
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("reward_events")
      .select(
        "id, status, reward_name, reward_terms, min_spend_pence, redeemable_from"
      )
      .eq("membership_id", membership.id)
      .eq("status", "unlocked")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("billing_customers")
      .select("status")
      .eq("merchant_id", membership.merchant_id)
      .maybeSingle(),
  ])

  if (cardError) {
    throw new Error(`Unable to load loyalty card: ${cardError.message}`)
  }
  if (rewardError) {
    throw new Error(`Unable to load reward status: ${rewardError.message}`)
  }
  if (billingError) {
    throw new Error(`Unable to load billing status: ${billingError.message}`)
  }

  const unavailableReason = unavailableMessage(
    merchant.status,
    loyaltyCard?.is_active ?? false,
    billing?.status ?? null
  )

  return {
    status: "ready",
    unavailableReason,
    membership: {
      id: membership.id,
      current_stamp_count: membership.current_stamp_count,
      total_rewards_redeemed: membership.total_rewards_redeemed,
      active_cycle_number: membership.active_cycle_number,
    },
    merchant: {
      id: membership.merchant_id,
      business_name: merchant.business_name,
      business_slug: merchant.business_slug,
      status: merchant.status,
    },
    loyaltyCard,
    latestReward: latestReward
      ? {
          id: latestReward.id,
          status: latestReward.status,
          reward_name: latestReward.reward_name,
          reward_terms: latestReward.reward_terms,
          min_spend_pence: latestReward.min_spend_pence,
          redeemable_from: latestReward.redeemable_from,
        }
      : null,
    billingStatus: billing?.status ?? null,
  }
}

export function unavailableMessage(
  merchantStatus: string,
  cardActive: boolean,
  billingStatus: string | null
) {
  if (!["trial", "active"].includes(merchantStatus)) {
    return "This merchant loyalty programme is not currently active."
  }

  if (!cardActive) {
    return "This loyalty card is not currently active."
  }

  // Match the RPC billing policy: both `cancelled` and `suspended` block the
  // self-service stamp/redeem mutations, so no customer surface should imply the
  // action is available. `trialing`, `active` and `past_due` stay allowed.
  if (billingStatus === "suspended" || billingStatus === "cancelled") {
    return "This loyalty programme is unavailable at the moment."
  }

  return undefined
}

function first<T>(value: T | T[]) {
  return Array.isArray(value) ? value[0] : value
}

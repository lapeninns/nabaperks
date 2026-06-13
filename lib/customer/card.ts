import "server-only"

import { getCurrentUser } from "@/lib/auth/session"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type CustomerCardState =
  | { status: "unauthenticated" | "unauthorized" | "not_found" }
  | {
      status: "ready"
      unavailableReason?: string
      membership: {
        id: string
        current_stamp_count: number
        total_rewards_redeemed: number
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
  customers:
    | { auth_user_id: string }
    | Array<{
        auth_user_id: string
      }>
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
  const user = await getCurrentUser()

  if (!user) return { status: "unauthenticated" }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customer_memberships")
    .select(
      "id, merchant_id, customer_id, current_stamp_count, total_rewards_redeemed, customers(auth_user_id), merchants(business_name, business_slug, status)"
    )
    .eq("id", membershipId)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to load customer card: ${error.message}`)
  }

  if (!data) return { status: "not_found" }

  const membership = data as RawMembership
  const customer = first(membership.customers)
  const merchant = first(membership.merchants)

  if (customer.auth_user_id !== user.id) {
    return { status: "unauthorized" }
  }

  const { data: loyaltyCard, error: cardError } = await supabase
    .from("loyalty_cards")
    .select(
      "card_name, stamps_required, reward_name, reward_terms, min_spend_pence, is_active"
    )
    .eq("merchant_id", membership.merchant_id)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (cardError) {
    throw new Error(`Unable to load loyalty card: ${cardError.message}`)
  }

  const { data: latestReward, error: rewardError } = await supabase
    .from("reward_events")
    .select("id, status, reward_name, reward_terms, min_spend_pence, redeemable_from")
    .eq("membership_id", membership.id)
    .eq("status", "unlocked")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (rewardError) {
    throw new Error(`Unable to load reward status: ${rewardError.message}`)
  }

  const { data: billing, error: billingError } = await supabase
    .from("billing_customers")
    .select("status")
    .eq("merchant_id", membership.merchant_id)
    .maybeSingle()

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

function unavailableMessage(
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

  if (billingStatus === "suspended") {
    return "This loyalty programme is unavailable at the moment."
  }

  return undefined
}

function first<T>(value: T | T[]) {
  return Array.isArray(value) ? value[0] : value
}

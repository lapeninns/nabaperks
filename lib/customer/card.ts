import "server-only"

import { loyaltyAvailability } from "@/lib/customer/availability"
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
        is_active: boolean
      } | null
      latestReward: {
        id: string
        status: string
        reward_name: string
        reward_terms: string
        redeemable_from: string | null
        expires_at: string | null
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
        requires_billing: boolean
      }
    | Array<{
        business_name: string
        business_slug: string
        status: string
        requires_billing: boolean
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
      "id, merchant_id, customer_id, current_stamp_count, total_rewards_redeemed, active_cycle_number, merchants(business_name, business_slug, status, requires_billing)"
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
        "card_name, stamps_required, reward_name, reward_terms, is_active"
      )
      .eq("merchant_id", membership.merchant_id)
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("reward_events")
      .select(
        "id, status, reward_name, reward_terms, redeemable_from, expires_at"
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
    billing?.status ?? null,
    merchant.requires_billing
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
          redeemable_from: latestReward.redeemable_from,
          expires_at: latestReward.expires_at,
        }
      : null,
    billingStatus: billing?.status ?? null,
  }
}

export function unavailableMessage(
  merchantStatus: string,
  cardActive: boolean,
  billingStatus: string | null,
  requiresBilling = false
) {
  return loyaltyAvailability({
    merchantStatus,
    cardActive,
    billingStatus,
    requiresBilling,
  }).message
}

function first<T>(value: T | T[]) {
  return Array.isArray(value) ? value[0] : value
}

import "server-only"

import { loyaltyAvailability } from "@/lib/customer/availability"
import { toRewardSummary } from "@/lib/customer/card-state-row"
import {
  pickIssuedUnlockedReward,
  pickStampBlockingUnlockedReward,
} from "@/lib/customer/primary-reward"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

import type { CustomerCardState } from "@/lib/customer/card"

type RawMembership = {
  id: string
  merchant_id: string
  customer_id: string
  current_stamp_count: number
  total_rewards_redeemed: number
  active_cycle_number: number
  referral_code: string
  referral_code_active: boolean
  merchants:
    | {
        business_name: string
        business_slug: string
        status: string
        requires_billing: boolean
        pub_google_review: string | null
        locals: string | null
      }
    | Array<{
        business_name: string
        business_slug: string
        status: string
        requires_billing: boolean
        pub_google_review: string | null
        locals: string | null
      }>
}

/**
 * The pre-RPC card read, kept for one release so the app can deploy ahead of
 * the `get_customer_card_state` migration. Same contract as the RPC path:
 * ownership is proven before any card, reward or billing detail is read.
 */
export async function legacyGetCustomerCardState(
  customerId: string,
  membershipId: string
): Promise<CustomerCardState> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customer_memberships")
    .select(
      "id, merchant_id, customer_id, current_stamp_count, total_rewards_redeemed, active_cycle_number, referral_code, referral_code_active, merchants(business_name, business_slug, status, requires_billing, pub_google_review, locals)"
    )
    .eq("id", membershipId)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to load customer card: ${error.message}`)
  }

  if (!data) return { status: "not_found" }

  const membership = data as RawMembership
  const merchant = first(membership.merchants)

  if (membership.customer_id !== customerId) {
    return { status: "unauthorized" }
  }

  const [
    { data: loyaltyCard, error: cardError },
    { data: unlockedRewards, error: rewardError },
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
        "id, status, reward_name, reward_terms, redeemable_from, expires_at, source, created_at"
      )
      .eq("membership_id", membership.id)
      .eq("status", "unlocked")
      .order("created_at", { ascending: false }),
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

  const unlockedRewardRows = unlockedRewards ?? []

  return {
    status: "ready",
    unavailableReason: loyaltyAvailability({
      merchantStatus: merchant.status,
      cardActive: loyaltyCard?.is_active ?? false,
      billingStatus: billing?.status ?? null,
      requiresBilling: merchant.requires_billing,
    }).message,
    membership: {
      id: membership.id,
      current_stamp_count: membership.current_stamp_count,
      total_rewards_redeemed: membership.total_rewards_redeemed,
      active_cycle_number: membership.active_cycle_number,
      referral_code: membership.referral_code,
      referral_code_active: membership.referral_code_active,
    },
    merchant: {
      id: membership.merchant_id,
      business_name: merchant.business_name,
      business_slug: merchant.business_slug,
      status: merchant.status,
      pub_google_review: merchant.pub_google_review,
      locals: merchant.locals,
    },
    loyaltyCard,
    stampCycleReward: toRewardSummary(
      pickStampBlockingUnlockedReward(unlockedRewardRows)
    ),
    issuedReward: toRewardSummary(pickIssuedUnlockedReward(unlockedRewardRows)),
    billingStatus: billing?.status ?? null,
  }
}

function first<T>(value: T | T[]) {
  return Array.isArray(value) ? value[0] : value
}

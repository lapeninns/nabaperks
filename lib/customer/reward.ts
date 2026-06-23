import "server-only"

import { loyaltyAvailability } from "@/lib/customer/availability"
import { getCurrentCustomer } from "@/lib/customer/identity"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type CustomerRewardState =
  | { status: "unauthenticated" | "unauthorized" | "not_found" }
  | {
      status: "ready"
      customerId: string
      unavailableReason?: string
      reward: {
        id: string
        status: string
        membership_id: string
        created_at: string
        redeemed_at: string | null
        reward_name: string
        reward_terms: string
        min_spend_pence: number | null
        redeemable_from: string | null
        expires_at: string | null
        expired_at: string | null
      }
      assignedReward: {
        reward_name: string
        reward_terms: string
        min_spend_pence: number | null
        redeemable_from: string | null
        expires_at: string | null
      }
      membership: {
        current_stamp_count: number
        total_rewards_redeemed: number
      }
      merchant: {
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
      }
      billingStatus: string | null
    }

type RawReward = {
  id: string
  status: string
  membership_id: string
  merchant_id: string
  customer_id: string
  created_at: string
  redeemed_at: string | null
  reward_name: string
  reward_terms: string
  min_spend_pence: number | null
  redeemable_from: string | null
  expires_at: string | null
  expired_at: string | null
  customer_memberships:
    | {
        current_stamp_count: number
        total_rewards_redeemed: number
      }
    | Array<{
        current_stamp_count: number
        total_rewards_redeemed: number
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
  loyalty_cards:
    | {
        card_name: string
        stamps_required: number
        reward_name: string
        reward_terms: string
        min_spend_pence: number | null
        is_active: boolean
      }
    | Array<{
        card_name: string
        stamps_required: number
        reward_name: string
        reward_terms: string
        min_spend_pence: number | null
        is_active: boolean
      }>
}

export async function getCustomerRewardState(
  rewardId: string
): Promise<CustomerRewardState> {
  const currentCustomer = await getCurrentCustomer()

  if (!currentCustomer) return { status: "unauthenticated" }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("reward_events")
    .select(
      "id, status, membership_id, merchant_id, customer_id, created_at, redeemed_at, reward_name, reward_terms, min_spend_pence, redeemable_from, expires_at, expired_at, customer_memberships!reward_events_membership_id_fkey(current_stamp_count, total_rewards_redeemed), merchants(business_name, business_slug, status), loyalty_cards(card_name, stamps_required, reward_name, reward_terms, min_spend_pence, is_active)"
    )
    .eq("id", rewardId)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to load reward: ${error.message}`)
  }

  if (!data) return { status: "not_found" }

  const reward = data as RawReward
  const membership = first(reward.customer_memberships)
  const merchant = first(reward.merchants)
  const loyaltyCard = first(reward.loyalty_cards)

  if (reward.customer_id !== currentCustomer.id) {
    return { status: "unauthorized" }
  }

  const { data: billing, error: billingError } = await supabase
    .from("billing_customers")
    .select("status")
    .eq("merchant_id", reward.merchant_id)
    .maybeSingle()

  if (billingError) {
    throw new Error(`Unable to load billing status: ${billingError.message}`)
  }

  const unavailableReason = loyaltyAvailability({
    merchantStatus: merchant.status,
    cardActive: loyaltyCard.is_active,
    billingStatus: billing?.status ?? null,
  }).message

  return {
    status: "ready",
    customerId: reward.customer_id,
    unavailableReason,
    reward: {
      id: reward.id,
      status: reward.status,
      membership_id: reward.membership_id,
      created_at: reward.created_at,
      redeemed_at: reward.redeemed_at,
      reward_name: reward.reward_name,
      reward_terms: reward.reward_terms,
      min_spend_pence: reward.min_spend_pence,
      redeemable_from: reward.redeemable_from,
      expires_at: reward.expires_at,
      expired_at: reward.expired_at,
    },
    assignedReward: {
      reward_name: reward.reward_name,
      reward_terms: reward.reward_terms,
      min_spend_pence: reward.min_spend_pence,
      redeemable_from: reward.redeemable_from,
      expires_at: reward.expires_at,
    },
    membership,
    merchant,
    loyaltyCard,
    billingStatus: billing?.status ?? null,
  }
}

function first<T>(value: T | T[]) {
  return Array.isArray(value) ? value[0] : value
}

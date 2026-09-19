import "server-only"

import { getCurrentCustomer } from "@/lib/customer/identity"
import { legacyRewardCollectionRow } from "@/lib/customer/reward-collection-batch"
import { parseCustomerCardStateRow } from "@/lib/customer/card-state-row"
import {
  parseRewardCollectionState,
  type RewardCollectionSnapshot,
} from "@/lib/customer/reward-collection-state"
import { isMissingRpcError } from "@/lib/supabase/missing-rpc"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { loyaltyEarningTermsFromRewardSnapshot } from "@/lib/loyalty/earning-terms"

export type CustomerRewardState =
  | { status: "unauthenticated" | "unauthorized" | "not_found" }
  | {
      status: "ready"
      customerId: string
      collection: RewardCollectionSnapshot
      reward: {
        id: string
        status: string
        membership_id: string
        created_at: string
        redeemed_at: string | null
        reward_name: string
        reward_terms: string
        redeemable_from: string | null
        expires_at: string | null
        expired_at: string | null
        source: string | null
        requires_age_check: boolean
        earning_terms: string | null
      }
      assignedReward: {
        reward_name: string
        reward_terms: string
        redeemable_from: string | null
        expires_at: string | null
        requires_age_check: boolean
      }
      membership: {
        current_stamp_count: number
        total_rewards_redeemed: number
      }
      merchant: {
        business_name: string
        business_slug: string
        status: string
        requires_billing: boolean
      }
      loyaltyCard: {
        card_name: string
        stamps_required: number
        reward_name: string
        reward_terms: string
        location_id: string | null
        is_active: boolean
      }
      billingStatus: string | null
    }

export type CustomerRewardStatus =
  | { status: "unauthenticated" | "unauthorized" | "not_found" }
  | {
      status: "ready"
      customerId: string
      reward: {
        status: string
        redeemed_at: string | null
      }
    }

type BillingCustomerEmbed =
  | { status: string | null }
  | Array<{ status: string | null }>
  | null

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
  redeemable_from: string | null
  expires_at: string | null
  expired_at: string | null
  source: string | null
  reward_policy_snapshot: unknown
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
        requires_billing: boolean
        billing_customers: BillingCustomerEmbed
      }
    | Array<{
        business_name: string
        business_slug: string
        status: string
        requires_billing: boolean
        billing_customers: BillingCustomerEmbed
      }>
  loyalty_cards:
    | {
        card_name: string
        stamps_required: number
        reward_name: string
        reward_terms: string
        location_id: string | null
        is_active: boolean
      }
    | Array<{
        card_name: string
        stamps_required: number
        reward_name: string
        reward_terms: string
        location_id: string | null
        is_active: boolean
      }>
}

type RawRewardStatus = {
  status: string
  redeemed_at: string | null
  customer_id: string
}

export async function getCustomerRewardStatus(
  rewardId: string
): Promise<CustomerRewardStatus> {
  const currentCustomer = await getCurrentCustomer()

  if (!currentCustomer) return { status: "unauthenticated" }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("reward_events")
    .select("status, redeemed_at, customer_id")
    .eq("id", rewardId)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to load reward status: ${error.message}`)
  }

  if (!data) return { status: "not_found" }

  const reward = data as RawRewardStatus

  if (reward.customer_id !== currentCustomer.id) {
    return { status: "unauthorized" }
  }

  return {
    status: "ready",
    customerId: reward.customer_id,
    reward: {
      status: reward.status,
      redeemed_at: reward.redeemed_at,
    },
  }
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
      "id, status, membership_id, merchant_id, customer_id, created_at, redeemed_at, reward_name, reward_terms, redeemable_from, expires_at, expired_at, source, reward_policy_snapshot, customer_memberships!reward_events_membership_id_fkey(current_stamp_count, total_rewards_redeemed), merchants(business_name, business_slug, status, requires_billing, billing_customers(status)), loyalty_cards(card_name, stamps_required, reward_name, reward_terms, location_id, is_active)"
    )
    .eq("id", rewardId)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to load reward: ${error.message}`)
  }

  if (!data) return { status: "not_found" }

  const reward = data as RawReward
  if (reward.customer_id !== currentCustomer.id) {
    return { status: "unauthorized" }
  }

  const membership = first(reward.customer_memberships)
  const merchant = first(reward.merchants)
  const loyaltyCard = first(reward.loyalty_cards)
  const billingStatus =
    firstNullable(merchant.billing_customers)?.status ?? null

  const [baseCollection, cardState] = await Promise.all([
    getRewardCollectionState(supabase, rewardId, {
      redeemableFrom: reward.redeemable_from,
    }),
    supabase.rpc("get_customer_card_state", {
      p_membership_id: reward.membership_id,
      p_customer_id: currentCustomer.id,
    }),
  ])
  if (cardState.error) {
    throw new Error(`Unable to load reward card state: ${cardState.error.message}`)
  }
  const parsedCardState = parseCustomerCardStateRow(cardState.data)
  const effectiveReward =
    parsedCardState.status === "ready"
      ? parsedCardState.unlockedRewards.find((entry) => entry.id === reward.id)
      : undefined
  const collection: RewardCollectionSnapshot = {
    ...baseCollection,
    requiresAgeCheck: effectiveReward?.requires_age_check ?? false,
  }

  return {
    status: "ready",
    customerId: reward.customer_id,
    collection,
    reward: {
      id: reward.id,
      status: reward.status,
      membership_id: reward.membership_id,
      created_at: reward.created_at,
      redeemed_at: reward.redeemed_at,
      reward_name: reward.reward_name,
      reward_terms: reward.reward_terms,
      redeemable_from: reward.redeemable_from,
      expires_at: reward.expires_at,
      expired_at: reward.expired_at,
      source: reward.source,
      requires_age_check: collection.requiresAgeCheck,
      earning_terms: loyaltyEarningTermsFromRewardSnapshot(
        reward.reward_policy_snapshot
      ),
    },
    assignedReward: {
      reward_name: reward.reward_name,
      reward_terms: reward.reward_terms,
      redeemable_from: reward.redeemable_from,
      expires_at: reward.expires_at,
      requires_age_check: collection.requiresAgeCheck,
    },
    membership,
    merchant,
    loyaltyCard,
    billingStatus,
  }
}

export async function getRewardCollectionState(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  rewardId: string,
  legacy?: { redeemableFrom: string | null }
): Promise<RewardCollectionSnapshot> {
  const { data, error } = await supabase.rpc("get_reward_collection_state", {
    p_reward_id: rewardId,
  })
  if (error) {
    if (legacy && isMissingRpcError(error)) {
      // App deployed ahead of the migration: derive readiness as the previous
      // release did, for one release.
      return parseRewardCollectionState(
        legacyRewardCollectionRow(legacy.redeemableFrom)
      )
    }
    throw new Error(`Unable to load reward collection state: ${error.message}`)
  }

  const value = Array.isArray(data) ? data[0] : data
  return parseRewardCollectionState(value)
}

function first<T>(value: T | T[]) {
  return Array.isArray(value) ? value[0] : value
}

function firstNullable<T>(value: T | T[] | null) {
  if (!value) return null
  return Array.isArray(value) ? value[0] : value
}

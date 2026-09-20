import {
  parseRewardCollectionState,
  type RewardCollectionState,
} from "@/lib/customer/reward-collection-state"
import { loyaltyEarningTermsFromRewardSnapshot } from "@/lib/loyalty/earning-terms"

/**
 * Narrows the jsonb returned by `public.get_customer_card_state` and holds the
 * reward-summary shape the card surfaces render, so the RPC loader and its
 * one-release fallback map rewards identically.
 */
export type UnlockedRewardRow = {
  id: string
  status: string
  reward_name: string
  reward_terms: string
  redeemable_from: string | null
  expires_at: string | null
  source: string | null
  created_at: string | null
  collection_state: RewardCollectionState
  collection_reason: string | null
  available_from: string | null
  in_window: boolean
  window_id: string | null
  window_ends_at: string | null
  upgrade_pool_item_id: string | null
  upgrade_reward_name: string | null
  upgrade_reward_terms: string | null
  next_window_starts_at: string | null
  next_window_ends_at: string | null
  next_window_upgrade_name: string | null
  requires_age_check: boolean
  earning_terms: string | null
}

export type RewardSummary = Omit<UnlockedRewardRow, "created_at">

export type CustomerCardStateRow =
  | { readonly status: "not_found" }
  | { readonly status: "unauthorized" }
  | {
      readonly status: "ready"
      readonly membership: {
        id: string
        merchant_id: string
        customer_id: string
        current_stamp_count: number
        total_rewards_redeemed: number
        active_cycle_number: number
        policy_cutover_notice_at: string | null
        referral_code: string
        referral_code_active: boolean
      }
      readonly merchant: {
        business_name: string
        business_slug: string
        status: string
        requires_billing: boolean
        pub_google_review: string | null
        locals: string | null
      }
      readonly loyaltyCard: {
        card_name: string
        stamps_required: number
        reward_name: string
        reward_terms: string
        is_active: boolean
        minimum_spend_pence: number | null
        one_transaction_per_stamp: boolean
      } | null
      readonly unlockedRewards: UnlockedRewardRow[]
      readonly billingStatus: string | null
    }

const MALFORMED = "Unable to load customer card: malformed state"

export function parseCustomerCardStateRow(data: unknown): CustomerCardStateRow {
  if (!isRecord(data)) throw new Error(MALFORMED)

  if (data.status === "not_found") return { status: "not_found" }
  if (data.status === "unauthorized") return { status: "unauthorized" }
  if (data.status !== "ready") throw new Error(MALFORMED)

  const membership = data.membership
  const merchant = data.merchant
  if (!isRecord(membership) || !isRecord(merchant)) throw new Error(MALFORMED)

  const rewards = Array.isArray(data.unlocked_rewards)
    ? data.unlocked_rewards
    : []

  return {
    status: "ready",
    membership: {
      id: requireString(membership.id),
      merchant_id: requireString(membership.merchant_id),
      customer_id: requireString(membership.customer_id),
      current_stamp_count: requireNumber(membership.current_stamp_count),
      total_rewards_redeemed: requireNumber(membership.total_rewards_redeemed),
      active_cycle_number: requireNumber(membership.active_cycle_number),
      policy_cutover_notice_at: nullableString(
        membership.policy_cutover_notice_at
      ),
      referral_code: nullableString(membership.referral_code) ?? "",
      referral_code_active: membership.referral_code_active === true,
    },
    merchant: {
      business_name: requireString(merchant.business_name),
      business_slug: requireString(merchant.business_slug),
      status: requireString(merchant.status),
      requires_billing: merchant.requires_billing === true,
      pub_google_review: nullableString(merchant.pub_google_review),
      locals: nullableString(merchant.locals),
    },
    loyaltyCard: parseLoyaltyCard(data.loyalty_card),
    unlockedRewards: rewards.map(parseReward),
    billingStatus: nullableString(data.billing_status),
  }
}

export function toRewardSummary(
  reward: UnlockedRewardRow | null
): RewardSummary | null {
  if (!reward) return null

  return {
    id: reward.id,
    status: reward.status,
    reward_name: reward.reward_name,
    reward_terms: reward.reward_terms,
    redeemable_from: reward.redeemable_from,
    expires_at: reward.expires_at,
    source: reward.source,
    collection_state: reward.collection_state,
    collection_reason: reward.collection_reason,
    available_from: reward.available_from,
    in_window: reward.in_window,
    window_id: reward.window_id,
    window_ends_at: reward.window_ends_at,
    upgrade_pool_item_id: reward.upgrade_pool_item_id,
    upgrade_reward_name: reward.upgrade_reward_name,
    upgrade_reward_terms: reward.upgrade_reward_terms,
    next_window_starts_at: reward.next_window_starts_at,
    next_window_ends_at: reward.next_window_ends_at,
    next_window_upgrade_name: reward.next_window_upgrade_name,
    requires_age_check: reward.requires_age_check,
    earning_terms: reward.earning_terms,
  }
}

function parseLoyaltyCard(value: unknown) {
  if (value === null || value === undefined) return null
  if (!isRecord(value)) throw new Error(MALFORMED)

  return {
    card_name: requireString(value.card_name),
    stamps_required: requireNumber(value.stamps_required),
    reward_name: requireString(value.reward_name),
    reward_terms: requireString(value.reward_terms),
    is_active: value.is_active === true,
    minimum_spend_pence: nullableNumber(value.minimum_spend_pence),
    one_transaction_per_stamp: value.one_transaction_per_stamp !== false,
  }
}

function parseReward(value: unknown): UnlockedRewardRow {
  if (!isRecord(value)) throw new Error(MALFORMED)
  const collection = parseRewardCollectionState({
    state: value.collection_state,
    reason: value.collection_reason,
    available_from: value.available_from,
    expires_at: value.expires_at,
    in_window: value.in_window,
    window_id: value.window_id,
    window_ends_at: value.window_ends_at,
    upgrade_pool_item_id: value.upgrade_pool_item_id,
    upgrade_reward_name: value.upgrade_reward_name,
    upgrade_reward_terms: value.upgrade_reward_terms,
    next_window_starts_at: value.next_window_starts_at,
    next_window_ends_at: value.next_window_ends_at,
    next_window_upgrade_name: value.next_window_upgrade_name,
    requires_age_check: value.requires_age_check,
  })
  const policySnapshot = isRecord(value.reward_policy_snapshot)
    ? value.reward_policy_snapshot
    : null

  return {
    id: requireString(value.id),
    status: requireString(value.status),
    reward_name: requireString(value.reward_name),
    reward_terms: requireString(value.reward_terms),
    redeemable_from: nullableString(value.redeemable_from),
    expires_at: nullableString(value.expires_at),
    source: nullableString(value.source),
    created_at: nullableString(value.created_at),
    collection_state: collection.state,
    collection_reason: collection.reason,
    available_from: collection.availableFrom,
    in_window: collection.inWindow,
    window_id: collection.windowId,
    window_ends_at: collection.windowEndsAt,
    upgrade_pool_item_id: collection.upgradePoolItemId,
    upgrade_reward_name: collection.upgradeRewardName,
    upgrade_reward_terms: collection.upgradeRewardTerms,
    next_window_starts_at: collection.nextWindowStartsAt,
    next_window_ends_at: collection.nextWindowEndsAt,
    next_window_upgrade_name: collection.nextWindowUpgradeName,
    requires_age_check:
      typeof value.requires_age_check === "boolean"
        ? collection.requiresAgeCheck
        : policySnapshot?.age_check === true,
    earning_terms: loyaltyEarningTermsFromRewardSnapshot(policySnapshot),
  }
}

function requireString(value: unknown): string {
  if (typeof value !== "string") throw new Error(MALFORMED)
  return value
}

function requireNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(MALFORMED)
  }
  return value
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  return requireNumber(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

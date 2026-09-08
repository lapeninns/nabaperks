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
  }
}

function parseReward(value: unknown): UnlockedRewardRow {
  if (!isRecord(value)) throw new Error(MALFORMED)

  return {
    id: requireString(value.id),
    status: requireString(value.status),
    reward_name: requireString(value.reward_name),
    reward_terms: requireString(value.reward_terms),
    redeemable_from: nullableString(value.redeemable_from),
    expires_at: nullableString(value.expires_at),
    source: nullableString(value.source),
    created_at: nullableString(value.created_at),
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

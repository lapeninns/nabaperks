import "server-only"

import { getCurrentMerchant } from "@/lib/auth/session"
import { formatMerchantCustomerIdentifier } from "@/lib/merchant/customer-identity-display"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type MerchantRewardScanContext =
  | { status: "unauthenticated" | "not_found" | "unauthorized" }
  | {
      status: "ready" | "redeemed" | "blocked"
      rewardId: string
      rewardName: string
      rewardTerms: string
      minSpendPence: number | null
      membershipId: string
      currentStampCount: number | null
      customerLabel: string
      blockedReason?: string
    }

export type MerchantScannedRewardCollectionResult =
  | {
      status: "collected"
      rewardId: string
      membershipId: string
      rewardName: string
    }
  | { status: "blocked"; reason: string }

export async function loadMerchantRewardScanContext(
  rewardId: string
): Promise<MerchantRewardScanContext> {
  const merchant = await getCurrentMerchant()
  if (!merchant) return { status: "unauthenticated" }

  const row = await loadRewardRow(rewardId)
  if (!row) return { status: "not_found" }

  if (stringField(row, "merchant_id") !== merchant.id) {
    return { status: "unauthorized" }
  }

  const membership = firstRecord(row.customer_memberships)
  const customer = firstRecord(row.customers)
  const loyaltyCard = firstRecord(row.loyalty_cards)
  const rewardStatus = stringField(row, "status")
  const rewardName = stringField(row, "reward_name") ?? "Reward"
  const membershipId = stringField(row, "membership_id") ?? ""
  const stampsRequired = numberField(loyaltyCard, "stamps_required")
  const currentStampCount = numberField(membership, "current_stamp_count")
  const cardActive = booleanField(loyaltyCard, "is_active")

  if (rewardStatus === "redeemed") {
    return scanContext(
      row,
      "redeemed",
      rewardName,
      membershipId,
      currentStampCount
    )
  }

  if (rewardStatus !== "unlocked") {
    return scanContext(
      row,
      "blocked",
      rewardName,
      membershipId,
      currentStampCount,
      {
        blockedReason: "This reward is not ready to collect.",
      }
    )
  }

  if (cardActive === false) {
    return scanContext(
      row,
      "blocked",
      rewardName,
      membershipId,
      currentStampCount,
      {
        blockedReason: "This loyalty card is not active.",
      }
    )
  }

  if (
    stampsRequired !== null &&
    currentStampCount !== null &&
    currentStampCount < stampsRequired
  ) {
    return scanContext(
      row,
      "blocked",
      rewardName,
      membershipId,
      currentStampCount,
      {
        blockedReason: "This customer has not collected enough stamps yet.",
      }
    )
  }

  return scanContext(
    row,
    "ready",
    rewardName,
    membershipId,
    currentStampCount,
    {
      customer,
    }
  )
}

export async function collectMerchantScannedReward(
  rewardId: string
): Promise<MerchantScannedRewardCollectionResult> {
  const merchant = await getCurrentMerchant()
  if (!merchant)
    return { status: "blocked", reason: "Log in to collect rewards." }

  const row = await loadRewardRow(rewardId)
  if (!row) return { status: "blocked", reason: "Reward not found." }

  if (stringField(row, "merchant_id") !== merchant.id) {
    return {
      status: "blocked",
      reason: "This reward belongs to a different merchant.",
    }
  }

  const customerId = stringField(row, "customer_id")
  if (!customerId) {
    return { status: "blocked", reason: "Reward customer not found." }
  }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("redeem_self_service_reward", {
    p_reward_event_id: rewardId,
    p_customer_id: customerId,
    p_latitude: null,
    p_longitude: null,
  })

  if (error) {
    return { status: "blocked", reason: error.message }
  }

  const result = firstRecord(data)
  const redeemedRewardId = stringField(result, "reward_event_id")
  const rewardName = stringField(result, "reward_name")
  const membershipId = stringField(result, "membership_id")

  if (!redeemedRewardId || !rewardName || !membershipId) {
    return { status: "blocked", reason: "Reward could not be collected." }
  }

  return {
    status: "collected",
    rewardId: redeemedRewardId,
    rewardName,
    membershipId,
  }
}

async function loadRewardRow(rewardId: string) {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("reward_events")
    .select(
      "id, status, merchant_id, customer_id, membership_id, reward_name, reward_terms, min_spend_pence, redeemable_from, redeemed_at, customer_memberships!reward_events_membership_id_fkey(current_stamp_count, total_rewards_redeemed), customers(email, phone, phone_last4), loyalty_cards(stamps_required, is_active)"
    )
    .eq("id", rewardId)
    .maybeSingle()

  if (error) {
    throw new Error(
      `Unable to load reward collection context: ${error.message}`
    )
  }

  return isRecord(data) ? data : null
}

function scanContext(
  row: Record<string, unknown>,
  status: Extract<MerchantRewardScanContext, { rewardId: string }>["status"],
  rewardName: string,
  membershipId: string,
  currentStampCount: number | null,
  options: {
    readonly customer?: Record<string, unknown> | null
    readonly blockedReason?: string
  } = {}
): Extract<MerchantRewardScanContext, { rewardId: string }> {
  const customer = options.customer ?? firstRecord(row.customers)

  return {
    status,
    rewardId: stringField(row, "id") ?? "",
    rewardName,
    rewardTerms: stringField(row, "reward_terms") ?? "",
    minSpendPence: numberField(row, "min_spend_pence"),
    membershipId,
    currentStampCount,
    customerLabel: formatMerchantCustomerIdentifier({
      email: stringField(customer, "email"),
      phone: stringField(customer, "phone"),
      phoneLast4: stringField(customer, "phone_last4"),
    }),
    blockedReason: options.blockedReason,
  }
}

function firstRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const [first] = value
    return isRecord(first) ? first : null
  }

  return isRecord(value) ? value : null
}

function stringField(
  record: Record<string, unknown> | null,
  key: string
): string | null {
  const value = record?.[key]
  return typeof value === "string" && value.trim() ? value : null
}

function numberField(
  record: Record<string, unknown> | null,
  key: string
): number | null {
  const value = record?.[key]
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function booleanField(
  record: Record<string, unknown> | null,
  key: string
): boolean | null {
  const value = record?.[key]
  return typeof value === "boolean" ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

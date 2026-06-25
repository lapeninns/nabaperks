import "server-only"

import { getCurrentMerchant } from "@/lib/auth/session"
import { formatMerchantCustomerIdentifier } from "@/lib/merchant/customer-identity-display"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type MerchantRewardScanContext =
  | { status: "unauthenticated" | "not_found" | "unauthorized" }
  | {
      status: "ready" | "redeemed" | "blocked"
      scanToken: string
      rewardId: string
      rewardName: string
      rewardTerms: string
      membershipId: string
      currentStampCount: number | null
      customerLabel: string
      blockedReason?: string
    }

export type MerchantScannedRewardCollectionResult =
  | {
      status: "collected"
      scanToken: string
      rewardId: string
      membershipId: string
      rewardName: string
    }
  | { status: "blocked"; reason: string }

export async function loadMerchantRewardScanContext(
  scanToken: string
): Promise<MerchantRewardScanContext> {
  const merchant = await getCurrentMerchant()
  if (!merchant) return { status: "unauthenticated" }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("get_reward_scan_context", {
    p_scan_token: scanToken,
    p_merchant_id: merchant.id,
  })

  if (error) {
    throw new Error(`Unable to load reward scan context: ${error.message}`)
  }

  const row = firstRecord(data)
  if (!row) return { status: "not_found" }

  const scanStatus = stringField(row, "scan_status")

  if (scanStatus === "not_found" || !scanStatus) return { status: "not_found" }
  if (scanStatus === "unauthorized") return { status: "unauthorized" }

  if (
    scanStatus !== "ready" &&
    scanStatus !== "redeemed" &&
    scanStatus !== "blocked"
  ) {
    return { status: "not_found" }
  }

  return scanContext(scanToken, row, scanStatus)
}

export async function collectMerchantScannedReward(
  scanToken: string
): Promise<MerchantScannedRewardCollectionResult> {
  const merchant = await getCurrentMerchant()
  if (!merchant)
    return {
      status: "blocked",
      reason: "Log in to your merchant account to mark this reward collected.",
    }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("collect_reward_scan_token", {
    p_scan_token: scanToken,
    p_merchant_id: merchant.id,
  })

  if (error) {
    return {
      status: "blocked",
      reason: merchantCollectionBlockedCopy(error.message),
    }
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
    scanToken,
    rewardId: redeemedRewardId,
    rewardName,
    membershipId,
  }
}

function merchantCollectionBlockedCopy(message: string): string {
  const rules: ReadonlyArray<readonly [readonly string[], string]> = [
    [
      ["belongs to a different merchant"],
      "This reward belongs to a different merchant.",
    ],
    [["scan token already used"], "This reward has already been collected."],
    [
      ["scan token expired", "scan token not found"],
      "This reward could not be collected. Refresh and try again.",
    ],
    [["Reward already redeemed"], "This reward has already been collected."],
    [
      ["not redeemable until the next UK business day"],
      "This reward cannot be collected until the next opening day.",
    ],
    [
      ["Complete your profile"],
      "Ask the customer to finish their profile before this reward can be collected.",
    ],
    [["This loyalty card is not active"], "This loyalty card is not active."],
    [
      ["Reward is not ready to redeem"],
      "This customer has not collected enough stamps yet.",
    ],
    [
      ["Reward is not redeemable"],
      "This reward is no longer available to collect.",
    ],
    [
      ["not active", "unavailable"],
      "This loyalty programme is unavailable right now.",
    ],
    [
      ["Reward not found", "ownership required", "Verified customer required"],
      "This reward could not be collected. Refresh and try again.",
    ],
  ]

  for (const [needles, copy] of rules) {
    if (needles.some((needle) => message.includes(needle))) return copy
  }

  return "This reward could not be collected. Try again or refresh."
}

function scanContext(
  scanToken: string,
  row: Record<string, unknown>,
  status: Extract<MerchantRewardScanContext, { rewardId: string }>["status"]
): Extract<MerchantRewardScanContext, { rewardId: string }> {
  return {
    status,
    scanToken,
    rewardId: stringField(row, "reward_event_id") ?? "",
    rewardName: stringField(row, "reward_name") ?? "Reward",
    rewardTerms: stringField(row, "reward_terms") ?? "",
    membershipId: stringField(row, "membership_id") ?? "",
    currentStampCount: numberField(row, "current_stamp_count"),
    customerLabel: formatMerchantCustomerIdentifier({
      email: stringField(row, "customer_email"),
      phone: stringField(row, "customer_phone"),
      phoneLast4: stringField(row, "customer_phone_last4"),
    }),
    blockedReason: stringField(row, "blocked_reason") ?? undefined,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

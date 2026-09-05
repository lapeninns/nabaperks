import "server-only"

import { getCurrentMerchant } from "@/lib/auth/session"
import { formatMerchantCustomerIdentifier } from "@/lib/merchant/customer-identity-display"
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server"
import { LOYALTY_PROGRAMME_UNAVAILABLE } from "@/lib/copy/product-copy"

export type MerchantRewardScanContext =
  | { status: "unauthenticated" | "not_found" | "unauthorized" | "expired" }
  | {
      status: "ready" | "redeemed" | "blocked" | "verification_required"
      scanToken: string
      rewardId: string
      rewardName: string
      rewardTerms: string
      membershipId: string
      currentStampCount: number | null
      customerLabel: string
      idCheck?: { fullName: string; dateOfBirth: string }
      blockedReason?: string
    }

export type MerchantScannedRewardCollectionResult =
  | {
      status: "collected"
      scanToken: string
      rewardId: string
      membershipId: string
      merchantId: string
      rewardName: string
    }
  | { status: "blocked"; reason: string }

export async function loadMerchantRewardScanContext(
  scanToken: string
): Promise<MerchantRewardScanContext> {
  const merchant = await getCurrentMerchant()
  if (!merchant) return { status: "unauthenticated" }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("get_owner_reward_scan_context", {
    p_scan_token: scanToken,
  })

  if (error) {
    if (error.code === "42501") return { status: "not_found" }
    // Log only the failure code; provider messages can contain identity fields.
    console.error("get_owner_reward_scan_context failed", { code: error.code })
    throw new Error("Unable to load reward scan context.")
  }

  const row = firstRecord(data)
  if (!row) return { status: "not_found" }

  const scanStatus = stringField(row, "scan_status")

  if (scanStatus === "not_found" || !scanStatus) return { status: "not_found" }
  if (scanStatus === "unauthorized") return { status: "unauthorized" }
  // Keep token expiry distinct from missing records, without parsing error text.
  if (scanStatus === "expired") return { status: "expired" }

  if (
    scanStatus !== "ready" &&
    scanStatus !== "verification_required" &&
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
  const { data, error } = await supabase.rpc(
    "collect_current_reward_scan_token",
    {
      p_scan_token: scanToken,
      p_merchant_id: merchant.id,
    }
  )

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
    merchantId: merchant.id,
    rewardName,
    membershipId,
  }
}

export function merchantCollectionBlockedCopy(message: string): string {
  const rules: ReadonlyArray<readonly [readonly string[], string]> = [
    [
      ["date of birth changed"],
      "The customer's date of birth changed. Refresh and check their ID again.",
    ],
    [
      ["Confirm the in-person"],
      "Confirm the in-person photo ID check before collection.",
    ],
    [
      [
        "Merchant owner access required",
        "Reward not available to this merchant",
      ],
      "This reward is not available to your merchant account.",
    ],
    [
      ["Verified adult date of birth required"],
      "Check the customer's photo ID before collecting this reward. Refresh to open the ID check.",
    ],
    [["Reward expired"], "This reward has expired and cannot be collected."],
    [
      ["belongs to a different merchant"],
      "This reward belongs to a different merchant.",
    ],
    [["scan token already used"], "This reward has already been collected."],
    [
      ["reward already collected", "Reward already collected"],
      "This reward has already been collected.",
    ],
    [
      ["scan token expired", "scan token not found", "scan token superseded"],
      "This reward could not be collected. Refresh and try again.",
    ],
    [["Reward already redeemed"], "This reward has already been collected."],
    [
      ["not redeemable until the next UK business day"],
      "This reward cannot be collected until the next opening day.",
    ],
    [
      ["Complete your profile", "Verified email required"],
      "Ask the customer to finish their profile before this reward can be collected.",
    ],
    [
      ["must be 18 or over"],
      "This customer must be 18 or over to collect this reward.",
    ],
    [["This loyalty card is not active"], "This loyalty card is not active."],
    [
      ["Reward is not ready to redeem"],
      "This customer has not collected enough stamps yet.",
    ],
    [
      ["Reward is not redeemable", "Reward is not ready to collect"],
      "This reward is no longer available to collect.",
    ],
    [["not active", "unavailable"], LOYALTY_PROGRAMME_UNAVAILABLE],
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
):
  | Extract<MerchantRewardScanContext, { rewardId: string }>
  | { status: "not_found" } {
  // Identity fields the TS union promises are always present: if the RPC ever
  // returns a partially-populated row, fall back to not_found rather than
  // rendering a banner with a blank reward name or empty card label.
  const rewardId = stringField(row, "reward_event_id")
  const rewardName = stringField(row, "reward_name")
  const membershipId = stringField(row, "membership_id")

  if (!rewardId || !rewardName || !membershipId) {
    return { status: "not_found" }
  }

  const fullName = stringField(row, "customer_full_name")
  const dateOfBirth = stringField(row, "customer_date_of_birth")
  if (status === "verification_required" && (!fullName || !dateOfBirth)) {
    return { status: "not_found" }
  }

  return {
    status,
    scanToken,
    rewardId,
    rewardName,
    rewardTerms: stringField(row, "reward_terms") ?? "",
    membershipId,
    idCheck:
      status === "verification_required" && fullName && dateOfBirth
        ? { fullName, dateOfBirth }
        : undefined,
    currentStampCount: numberField(row, "current_stamp_count"),
    // The authenticated RPC already returns masked email and a phone suffix.
    // Preserve the display fallback without relying on this loader for privacy.
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

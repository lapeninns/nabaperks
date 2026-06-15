import "server-only"

import { getCurrentMerchant } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type RedemptionLookup =
  | {
      readonly status: "ready"
      readonly publicToken: string
      readonly rewardId: string
      readonly rewardName: string
      readonly rewardTerms: string
      readonly customerLabel: string
      readonly expiresAt: string
    }
  | {
      readonly status:
        | "not_found"
        | "expired"
        | "consumed"
        | "cancelled"
        | "unavailable"
        | "unauthenticated"
      readonly publicToken: string
      readonly reason: string
    }

export type ConsumeRedemptionResult =
  | {
      readonly status: "redeemed"
      readonly rewardId: string
      readonly rewardName: string
      readonly membershipId: string
      readonly newStampCount: number
      readonly consumedAt: string
    }
  | { readonly status: "blocked"; readonly reason: string }

export async function lookupRedemptionToken(
  rawTokenOrUrl: string
): Promise<RedemptionLookup> {
  const merchant = await getCurrentMerchant()
  const publicToken = extractPublicToken(rawTokenOrUrl)

  if (!merchant) {
    return {
      status: "unauthenticated",
      publicToken,
      reason: "Merchant login required.",
    }
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc(
    "lookup_redemption_token_for_merchant",
    {
      p_public_token: publicToken,
      p_merchant_id: merchant.id,
    }
  )

  if (error) {
    return { status: "not_found", publicToken, reason: error.message }
  }

  const row = firstRecord(data)
  const status = lookupStatus(row?.status)

  if (status !== "ready") {
    return { status, publicToken, reason: lookupReason(status) }
  }

  const rewardId = stringValue(row?.reward_event_id)
  const rewardName = stringValue(row?.reward_name)
  const rewardTerms = stringValue(row?.reward_terms)
  const customerLabel = stringValue(row?.customer_label)
  const expiresAt = stringValue(row?.expires_at)

  if (
    !rewardId ||
    !rewardName ||
    !rewardTerms ||
    !customerLabel ||
    !expiresAt
  ) {
    return {
      status: "unavailable",
      publicToken,
      reason: "Redemption QR details are unavailable.",
    }
  }

  return {
    status: "ready",
    publicToken,
    rewardId,
    rewardName,
    rewardTerms,
    customerLabel,
    expiresAt,
  }
}

export async function consumeRedemptionToken(
  rawTokenOrUrl: string
): Promise<ConsumeRedemptionResult> {
  const merchant = await getCurrentMerchant()
  if (!merchant)
    return { status: "blocked", reason: "Merchant login required." }

  const publicToken = extractPublicToken(rawTokenOrUrl)
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("consume_redemption_token", {
    p_public_token: publicToken,
    p_merchant_id: merchant.id,
  })

  if (error) return { status: "blocked", reason: error.message }

  const row = firstRecord(data)
  const rewardId = stringValue(row?.reward_event_id)
  const rewardName = stringValue(row?.reward_name)
  const membershipId = stringValue(row?.membership_id)
  const newStampCount = numberValue(row?.new_stamp_count)
  const consumedAt = stringValue(row?.consumed_at)

  if (
    !rewardId ||
    !rewardName ||
    !membershipId ||
    newStampCount === null ||
    !consumedAt
  ) {
    return { status: "blocked", reason: "Reward could not be redeemed." }
  }

  return {
    status: "redeemed",
    rewardId,
    rewardName,
    membershipId,
    newStampCount,
    consumedAt,
  }
}

export function extractPublicToken(rawTokenOrUrl: string): string {
  const trimmed = rawTokenOrUrl.trim()
  if (!trimmed) return ""

  try {
    const url = new URL(trimmed, "https://nabaperks.local")
    const parts = url.pathname.split("/").filter(Boolean)
    if (parts[0] === "r" && parts[1]) {
      return normalizeToken(parts[1])
    }
  } catch (error) {
    if (error instanceof TypeError) {
      return normalizeToken(trimmed)
    }

    throw error
  }

  return normalizeToken(trimmed)
}

function normalizeToken(value: string): string {
  return value
    .trim()
    .replace(/^\/?r\//, "")
    .toUpperCase()
}

function lookupStatus(value: unknown): RedemptionLookup["status"] {
  switch (value) {
    case "ready":
    case "not_found":
    case "expired":
    case "consumed":
    case "cancelled":
    case "unavailable":
      return value
    default:
      return "not_found"
  }
}

function lookupReason(status: Exclude<RedemptionLookup["status"], "ready">) {
  switch (status) {
    case "expired":
      return "This redemption QR has expired."
    case "consumed":
      return "This reward has already been redeemed."
    case "cancelled":
      return "This redemption QR was replaced by a newer one."
    case "unavailable":
      return "This reward is not redeemable."
    case "unauthenticated":
      return "Merchant login required."
    case "not_found":
      return "Redemption QR not found for this merchant."
    default:
      return "Redemption QR not found for this merchant."
  }
}

function firstRecord(value: unknown): Record<string, unknown> | null {
  if (!Array.isArray(value)) return null

  const [first] = value
  if (!isRecord(first)) return null

  return first
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

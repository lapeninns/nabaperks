import "server-only"

import { getCurrentMerchant } from "@/lib/auth/session"
import { formatMerchantCustomerIdentifier } from "@/lib/merchant/customer-identity-display"
import { LOYALTY_PROGRAMME_UNAVAILABLE } from "@/lib/copy/product-copy"
import type { OfferPassScanStatus } from "@/lib/offers/redeem-core"
import {
  firstRpcRecord,
  rpcNumberField,
  rpcStringField,
} from "@/lib/offers/rpc-rows"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * Merchant boundary for the discount pass: one read and one mutation, both
 * service-role, both proving venue ownership through the merchant session
 * rather than trusting anything in the URL.
 *
 * Reading NEVER redeems. `loadMerchantOfferPassScanContext` calls a function
 * that takes no lock and writes nothing, so a scan is safe to repeat, bookmark
 * or replay. Redemption happens only when a human posts the confirm form.
 *
 * PII: get_offer_pass_scan_context returns customer_email / customer_phone_last4
 * so a mask can be computed. They are read here to produce `customerLabel` and
 * are deliberately absent from MerchantOfferPassScanContext, so no merchant
 * surface can render a raw address or number even by accident. Same rule, and
 * same reason, as lib/merchant/reward-collection.ts.
 */

// Split rather than combined ("unauthenticated" | "not_found" on one member) so
// a route can narrow to the pass-bearing member by discriminant alone.
export type MerchantOfferPassScanContext =
  | { status: "unauthenticated" }
  | { status: "not_found" }
  | {
      status: OfferPassScanStatus
      scanToken: string
      entitlementId: string
      discountPercent: number
      requiresIdCheck: boolean
      extraTerms: string
      validTo: string | null
      membershipId: string
      customerLabel: string
      blockedReason?: string
    }

export type MerchantOfferPassRedemptionResult =
  | {
      status: "redeemed"
      scanToken: string
      merchantId: string
      membershipId: string
      discountPercent: number
    }
  | { status: "blocked"; reason: string }

export type MerchantOfferPassAttestations = {
  readonly idChecked: boolean
  readonly noStacking: boolean
}

export async function loadMerchantOfferPassScanContext(
  scanToken: string
): Promise<MerchantOfferPassScanContext> {
  const merchant = await getCurrentMerchant()
  if (!merchant) return { status: "unauthenticated" }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("get_offer_pass_scan_context", {
    p_scan_token: scanToken,
    p_merchant_id: merchant.id,
  })

  if (error) {
    // Raw Postgres detail stays in the server log; the screen gets a stable,
    // non-revealing message rather than a database hint.
    console.error("get_offer_pass_scan_context failed", error)
    throw new Error("Unable to load offer pass scan context.")
  }

  const row = firstRpcRecord(data)
  if (!row) return { status: "not_found" }

  const scanStatus = rpcStringField(row, "scan_status")

  if (!scanStatus || scanStatus === "not_found") return { status: "not_found" }

  if (
    scanStatus !== "ready" &&
    scanStatus !== "redeemed" &&
    scanStatus !== "blocked" &&
    scanStatus !== "expired" &&
    scanStatus !== "unauthorized"
  ) {
    return { status: "not_found" }
  }

  return passContext(scanToken, row, scanStatus)
}

export async function redeemMerchantOfferPass(
  scanToken: string,
  attestations: MerchantOfferPassAttestations
): Promise<MerchantOfferPassRedemptionResult> {
  const merchant = await getCurrentMerchant()
  if (!merchant)
    return {
      status: "blocked",
      reason: "Log in to your merchant account to redeem this discount.",
    }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("redeem_offer_pass", {
    p_scan_token: scanToken,
    p_merchant_id: merchant.id,
    p_id_check_attested: attestations.idChecked,
    p_no_stacking_attested: attestations.noStacking,
  })

  if (error) {
    return {
      status: "blocked",
      reason: merchantOfferPassBlockedCopy(error.message),
    }
  }

  const row = firstRpcRecord(data)
  const redemptionId = rpcStringField(row, "redemption_id")
  const membershipId = rpcStringField(row, "membership_id")
  const discountPercent = rpcNumberField(row, "discount_percent")

  if (!redemptionId || !membershipId || discountPercent === null) {
    return { status: "blocked", reason: "This discount could not be redeemed." }
  }

  return {
    status: "redeemed",
    scanToken,
    merchantId: merchant.id,
    membershipId,
    discountPercent,
  }
}

/**
 * Postgres message to staff-facing British English. Substring matching, so the
 * table must be kept in step with the raises in
 * 20260803100300_offer_pass_scan_and_redeem.sql.
 */
function merchantOfferPassBlockedCopy(message: string): string {
  const rules: ReadonlyArray<readonly [readonly string[], string]> = [
    [
      ["belongs to a different merchant"],
      "This pass belongs to a different venue.",
    ],
    [
      ["scan token already used"],
      "This code has already been used. Ask the member to show a fresh code from their pass.",
    ],
    [
      ["scan token expired", "scan token not found"],
      "This code has expired. Ask the member to show their pass again.",
    ],
    [
      ["not being combined with another reward or offer"],
      "Confirm the discount is not being combined with another reward or offer.",
    ],
    [
      ["requires an ID check"],
      "This offer needs an ID check before it can be redeemed.",
    ],
    [["This pass is no longer active"], "This pass is no longer active."],
    [
      ["outside its valid dates"],
      "This pass is outside the dates it can be used.",
    ],
    [["unavailable"], LOYALTY_PROGRAMME_UNAVAILABLE],
    [
      ["Offer pass not found", "ownership required"],
      "This discount could not be redeemed. Refresh and try again.",
    ],
  ]

  for (const [needles, copy] of rules) {
    if (needles.some((needle) => message.includes(needle))) return copy
  }

  return "This discount could not be redeemed. Try again or refresh."
}

function passContext(
  scanToken: string,
  row: Record<string, unknown>,
  status: OfferPassScanStatus
): MerchantOfferPassScanContext {
  // Identity fields the union promises are always present. A partially
  // populated row falls back to not_found rather than rendering a pass face
  // with a blank discount or an empty member label.
  const entitlementId = rpcStringField(row, "entitlement_id")
  const membershipId = rpcStringField(row, "membership_id")
  const discountPercent = rpcNumberField(row, "discount_percent")

  if (!entitlementId || !membershipId || discountPercent === null) {
    return { status: "not_found" }
  }

  return {
    status,
    scanToken,
    entitlementId,
    discountPercent,
    requiresIdCheck: row.requires_id_check === true,
    extraTerms: rpcStringField(row, "extra_terms") ?? "",
    validTo: rpcStringField(row, "valid_to"),
    membershipId,
    // Only the masked label leaves this loader. The raw email and phone ending
    // are read solely to compute it and never reach the returned type.
    customerLabel: formatMerchantCustomerIdentifier({
      email: rpcStringField(row, "customer_email"),
      phoneLast4: rpcStringField(row, "customer_phone_last4"),
    }),
    blockedReason: rpcStringField(row, "blocked_reason") ?? undefined,
  }
}

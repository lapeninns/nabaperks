import "server-only"

import { firstRpcRecord, rpcStringField } from "@/lib/offers/rpc-rows"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * Mint (or reuse) the short-lived uuid behind a customer's discount-pass QR.
 *
 * The token is bearer material: `offer_pass_scan_tokens` has no `authenticated`
 * grant and no `authenticated` policy, so it is only ever read server-side.
 * `create_offer_pass_scan_token` proves ownership, checks the pass is active and
 * inside its window, purges dead rows, and returns an unconsumed token that
 * still has comfortable life left rather than minting one per QR refresh.
 *
 * Each token is SINGLE USE. The pass is not: a customer may mint another the
 * moment the first is redeemed, which is exactly how unlimited uses inside the
 * pass window are delivered without ever consuming the entitlement.
 */

export type OfferPassScanToken = {
  /** The uuid encoded in the QR as `${origin}/p/<scanToken>`. */
  readonly scanToken: string
  /** ISO timestamp at which the token stops being accepted. */
  readonly expiresAt: string
}

/**
 * Returns null when the pass cannot currently produce a code — expired window,
 * revoked pass, venue unavailable, or a caller who does not own it. The caller
 * renders a calm state; the Postgres detail stays in the server log.
 */
export async function mintOfferPassScanToken(
  entitlementId: string,
  customerId: string
): Promise<OfferPassScanToken | null> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("create_offer_pass_scan_token", {
    p_entitlement_id: entitlementId,
    p_customer_id: customerId,
  })

  if (error) {
    console.error("create_offer_pass_scan_token failed", error)
    return null
  }

  const row = firstRpcRecord(data)
  const scanToken = rpcStringField(row, "scan_token")
  const expiresAt = rpcStringField(row, "expires_at")

  if (!scanToken || !expiresAt) return null

  return { scanToken, expiresAt }
}

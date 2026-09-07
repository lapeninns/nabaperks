import "server-only"

import { createSupabaseServerClient } from "@/lib/supabase/server"

export type VenueCodeToday = {
  readonly code: string
  readonly rotatesAt: string
}

/**
 * Today's venue code for the signed-in owner's merchant. Read through the
 * user-JWT client so the RPC's own `is_merchant_owner` check is the authority;
 * the code is never derived or cached in the application.
 */
export async function getVenueCodeToday(
  merchantId: string
): Promise<VenueCodeToday | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("get_venue_code_today", {
    p_merchant_id: merchantId,
  })

  if (error) {
    // Log only the failure code; never the payload.
    console.error("get_venue_code_today failed", { code: error.code })
    return null
  }

  return venueCodeFromRow(data)
}

/** Replace the seed so today's code changes at once. Owner only, audited. */
export async function rotateVenueCode(
  merchantId: string
): Promise<VenueCodeToday | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("rotate_venue_code", {
    p_merchant_id: merchantId,
  })

  if (error) {
    console.error("rotate_venue_code failed", { code: error.code })
    return null
  }

  return venueCodeFromRow(data)
}

function venueCodeFromRow(data: unknown): VenueCodeToday | null {
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== "object") return null

  const record = row as Record<string, unknown>
  const code = typeof record.code === "string" ? record.code : null
  const rotatesAt =
    typeof record.rotates_at === "string" ? record.rotates_at : null

  if (!code || !/^[0-9]{6}$/.test(code) || !rotatesAt) return null

  return { code, rotatesAt }
}

import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type LocationScopeIds = {
  readonly cardIds: string[]
  readonly qrCodeIds: string[]
}

export async function loadLocationScopeIds(
  merchantId: string,
  locationId: string
): Promise<LocationScopeIds> {
  const supabase = createSupabaseServiceRoleClient()
  const [cards, qrs] = await Promise.all([
    supabase
      .from("loyalty_cards")
      .select("id")
      .eq("merchant_id", merchantId)
      .eq("location_id", locationId),
    supabase
      .from("qr_codes")
      .select("id")
      .eq("merchant_id", merchantId)
      .eq("location_id", locationId),
  ])

  if (cards.error) {
    throw new Error(`Unable to load location cards: ${cards.error.message}`)
  }

  if (qrs.error) {
    throw new Error(`Unable to load location QR codes: ${qrs.error.message}`)
  }

  return {
    cardIds: (cards.data ?? []).map((row) => row.id).filter(isString),
    qrCodeIds: (qrs.data ?? []).map((row) => row.id).filter(isString),
  }
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}

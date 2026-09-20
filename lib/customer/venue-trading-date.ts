import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export async function getVenueTradingDate(merchantId: string): Promise<string> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("venue_trading_date", {
    p_merchant_id: merchantId,
  })
  if (error) {
    throw new Error(`Unable to load venue trading date: ${error.message}`)
  }
  if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    throw new Error("Unable to load venue trading date: malformed result")
  }
  return data
}

import "server-only"

import { logger } from "@/lib/observability/logger"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

import { DEFAULT_TRADING_DAY_START, nextStampAvailableAt } from "./next-stamp"

/**
 * When this venue's next normal visit stamp opens (ISO instant), from the
 * venue trading date already loaded for the page and the day start of the
 * location `public.venue_trading_date` reads: the merchant's primary location,
 * ordered exactly as the SQL orders it, with the SQL's 05:00 default when the
 * venue has no location row.
 *
 * Display only. It never gates a stamp; the RPC does that. Any failure returns
 * null so the screen says "on your next visit" instead of breaking or guessing.
 */
export async function loadNextStampFrom(
  merchantId: string,
  tradingDate: string
): Promise<string | null> {
  try {
    const supabase = createSupabaseServiceRoleClient()
    const { data, error } = await supabase
      .from("merchant_locations")
      .select("trading_day_starts_at")
      .eq("merchant_id", merchantId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) {
      logger.warn("customer_next_stamp_start_unavailable", {
        merchantId,
        error: error.message,
      })
      return null
    }

    const start =
      data === null
        ? DEFAULT_TRADING_DAY_START
        : typeof data.trading_day_starts_at === "string"
          ? data.trading_day_starts_at
          : null

    return nextStampAvailableAt({ tradingDate, tradingDayStartsAt: start })
  } catch (error) {
    logger.warn("customer_next_stamp_start_unavailable", {
      merchantId,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

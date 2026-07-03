import "server-only"

import { logger } from "@/lib/observability/logger"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * Best-effort birthday issuance for a single member — called from the profile
 * (DOB saved) and join hooks so a mid-month DOB-setter / new joiner is covered
 * without waiting for the daily cron. Never throws into the host action; the
 * idempotent function self-heals a missed member on the next cron tick.
 */
export async function triggerBirthdayIssuanceForCustomer(
  customerId: string
): Promise<void> {
  try {
    const supabase = createSupabaseServiceRoleClient()
    const { error } = await supabase.rpc("issue_birthday_rewards", {
      p_customer_id: customerId,
    })
    if (error) {
      logger.warn("birthday_issuance_failed", {
        customerId,
        reason: error.message,
      })
    }
  } catch (error) {
    logger.warn("birthday_issuance_failed", {
      customerId,
      reason: error instanceof Error ? error.message : "unknown",
    })
  }
}

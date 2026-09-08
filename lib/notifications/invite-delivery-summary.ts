import "server-only"

import { logger } from "@/lib/observability/logger"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/** Count new global suppression rows, not webhook attempts or recipient identities. */
export async function logWeeklyInviteDeliverySummary(now: Date) {
  try {
    const supabase = createSupabaseServiceRoleClient()
    const since = new Date(now.getTime() - 7 * 24 * 60 * 60_000).toISOString()
    const counts: Record<string, number> = {}
    for (const reason of ["complained", "bounced"] as const) {
      const { count, error } = await supabase
        .from("loyalty_invite_email_suppressions")
        .select("id", { count: "exact", head: true })
        .is("merchant_id", null)
        .eq("reason", reason)
        .gte("created_at", since)
        .lt("created_at", now.toISOString())
      if (error || count === null) throw new Error("Summary unavailable")
      counts[reason] = count
    }
    logger.info("invite_delivery_weekly_suppressions", {
      since,
      until: now.toISOString(),
      newComplaintSuppressions: counts.complained,
      newBounceSuppressions: counts.bounced,
    })
  } catch {
    logger.warn("invite_delivery_weekly_summary_unavailable")
  }
}

import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

import {
  CUSTOMER_DAILY_NOTIFICATION_CAP,
  NOTIFICATION_CAP_WINDOW_MS,
} from "@/lib/notifications/frequency-cap-core"

// Pure policy (constants + classifier + retry window) lives in the -core module
// so it is unit-testable; re-exported here for existing importers.
export {
  CUSTOMER_DAILY_NOTIFICATION_CAP,
  NOTIFICATION_CAP_WINDOW_MS,
  NOTIFICATION_CAP_RETRY_MS,
  isFrequencyCappedCategory,
  nextNotificationFrequencyWindow,
} from "@/lib/notifications/frequency-cap-core"

type SupabaseServiceRoleClient = ReturnType<
  typeof createSupabaseServiceRoleClient
>

export async function customerNotificationFrequencyCapReached(
  supabase: SupabaseServiceRoleClient,
  {
    customerId,
    now,
    excludeEventId,
  }: {
    customerId: string
    now: Date
    excludeEventId?: string | null
  }
) {
  let query = supabase
    .from("notification_events")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId)
    .in("status", ["queued", "delivering", "sent"])
    .gte(
      "created_at",
      new Date(now.getTime() - NOTIFICATION_CAP_WINDOW_MS).toISOString()
    )

  if (excludeEventId) {
    query = query.neq("id", excludeEventId)
  }

  const { count, error } = await query

  if (error) {
    throw new Error(`Unable to check notification frequency cap: ${error.message}`)
  }

  return (count ?? 0) >= CUSTOMER_DAILY_NOTIFICATION_CAP
}

import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

import {
  CUSTOMER_DAILY_NOTIFICATION_CAP,
  NOTIFICATION_DELIVERY_CAP_STATUSES,
  NOTIFICATION_ENQUEUE_CAP_STATUSES,
  NOTIFICATION_CAP_WINDOW_MS,
} from "@/lib/notifications/frequency-cap-core"

// Pure policy (constants + classifier + retry window) lives in the -core module
// so it is unit-testable; re-exported here for existing importers.
export {
  CUSTOMER_DAILY_NOTIFICATION_CAP,
  NOTIFICATION_DELIVERY_CAP_STATUSES,
  NOTIFICATION_ENQUEUE_CAP_STATUSES,
  NOTIFICATION_CAP_WINDOW_MS,
  NOTIFICATION_CAP_RETRY_MS,
  isFrequencyCappedCategory,
  nextNotificationFrequencyWindow,
} from "@/lib/notifications/frequency-cap-core"

type SupabaseServiceRoleClient = ReturnType<
  typeof createSupabaseServiceRoleClient
>

type NotificationCapStatus = (typeof NOTIFICATION_ENQUEUE_CAP_STATUSES)[number]

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
  return customerNotificationCapReached(supabase, {
    customerId,
    now,
    excludeEventId,
    statuses: NOTIFICATION_ENQUEUE_CAP_STATUSES,
  })
}

export async function customerNotificationDeliveryCapReached(
  supabase: SupabaseServiceRoleClient,
  {
    customerId,
    now,
  }: {
    customerId: string
    now: Date
  }
) {
  return customerNotificationCapReached(supabase, {
    customerId,
    now,
    statuses: NOTIFICATION_DELIVERY_CAP_STATUSES,
  })
}

async function customerNotificationCapReached(
  supabase: SupabaseServiceRoleClient,
  {
    customerId,
    now,
    excludeEventId,
    statuses,
  }: {
    customerId: string
    now: Date
    excludeEventId?: string | null
    statuses: readonly NotificationCapStatus[]
  }
) {
  let query = supabase
    .from("notification_events")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId)
    .in("status", [...statuses])
    .gte(
      "created_at",
      new Date(now.getTime() - NOTIFICATION_CAP_WINDOW_MS).toISOString()
    )

  if (excludeEventId) {
    query = query.neq("id", excludeEventId)
  }

  const { count, error } = await query

  if (error) {
    throw new Error(
      `Unable to check notification frequency cap: ${error.message}`
    )
  }

  return (count ?? 0) >= CUSTOMER_DAILY_NOTIFICATION_CAP
}

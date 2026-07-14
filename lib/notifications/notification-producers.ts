import "server-only"

import {
  buildNotificationPayload,
  type NotificationEventType,
  type NotificationPayload,
} from "@/lib/notifications/catalog"
import { londonBusinessDate } from "@/lib/notifications/london-time"
import { logger } from "@/lib/observability/logger"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export const scheduledNotificationProducerEventTypes = [
  "next_stamp_available",
  "reward_ready",
  "reward_expiring_soon",
  "reward_expired",
  "dormant_progress",
] as const

type NotificationProducer = {
  readonly failureEvent: string
  readonly produce: () => Promise<number>
}

export async function produceDueNotificationEvents(now = new Date()) {
  const supabase = createSupabaseServiceRoleClient()
  let produced = 0

  const { data: expiredCount, error: expiredError } = await supabase.rpc(
    "expire_due_reward_events",
    { p_now: now.toISOString() }
  )
  if (expiredError) {
    logger.warn("push_reward_expiry_producer_failed", {
      reason: expiredError.message,
    })
  } else {
    produced += typeof expiredCount === "number" ? expiredCount : 0
  }

  const producers: readonly NotificationProducer[] = [
    {
      failureEvent: "push_reward_expiring_soon_producer_failed",
      produce: () => enqueueRewardExpiringSoon(now),
    },
    {
      failureEvent: "push_reward_ready_producer_failed",
      produce: () => enqueueRewardReady(now),
    },
    {
      failureEvent: "push_next_stamp_available_producer_failed",
      produce: () => enqueueNextStampAvailable(now),
    },
    {
      failureEvent: "push_dormant_progress_producer_failed",
      produce: () => enqueueDormantProgress(now),
    },
  ]

  const producerResults = await Promise.allSettled(
    producers.map((producer) => producer.produce())
  )

  for (const [index, result] of producerResults.entries()) {
    const producer = producers[index]
    if (!producer) continue

    if (result.status === "fulfilled") {
      produced += result.value
      continue
    }

    logger.warn(producer.failureEvent, {
      reason: errorMessage(result.reason),
    })
  }

  return produced
}

async function enqueueRewardExpiringSoon(now: Date) {
  const supabase = createSupabaseServiceRoleClient()
  const upperBound = new Date(now.getTime() + 72 * 60 * 60 * 1000)
  const { data, error } = await supabase
    .from("reward_events")
    .select(
      "id, customer_id, merchant_id, membership_id, reward_name, expires_at, cycle_number, merchants(business_name)"
    )
    .eq("status", "unlocked")
    .not("expires_at", "is", null)
    .gt("expires_at", now.toISOString())
    .lte("expires_at", upperBound.toISOString())
    .order("expires_at", { ascending: true })
    .limit(100)

  if (error) {
    logger.warn("push_reward_expiring_producer_failed", {
      reason: error.message,
    })
    return 0
  }

  let count = 0
  for (const row of data ?? []) {
    if (!isRecord(row)) continue
    const eventType = "reward_expiring_soon"
    const payload = buildNotificationPayload({
      eventType,
      businessName: businessName(row),
      rewardName: stringValue(row.reward_name),
      url: "/home/rewards",
      merchantId: stringValue(row.merchant_id),
      membershipId: stringValue(row.membership_id),
      rewardEventId: stringValue(row.id),
    })
    const queued = await enqueueRawEvent(eventType, row, payload, {
      source: "scheduled_worker",
      due_window: "72h",
    })
    count += queued ? 1 : 0
  }

  return count
}

async function enqueueRewardReady(now: Date) {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("reward_events")
    .select(
      "id, customer_id, merchant_id, membership_id, reward_name, redeemable_from, cycle_number, merchants(business_name)"
    )
    .eq("status", "unlocked")
    .eq("source", "stamp_cycle")
    .lte("redeemable_from", londonBusinessDate(now))
    .order("redeemable_from", { ascending: true })
    .limit(100)

  if (error) {
    logger.warn("push_reward_ready_producer_failed", { reason: error.message })
    return 0
  }

  let count = 0
  for (const row of data ?? []) {
    if (!isRecord(row)) continue
    const eventType = "reward_ready"
    const payload = buildNotificationPayload({
      eventType,
      businessName: businessName(row),
      rewardName: stringValue(row.reward_name),
      url: "/home/rewards",
      merchantId: stringValue(row.merchant_id),
      membershipId: stringValue(row.membership_id),
      rewardEventId: stringValue(row.id),
    })
    const queued = await enqueueRawEvent(eventType, row, payload, {
      source: "scheduled_worker",
    })
    count += queued ? 1 : 0
  }

  return count
}

async function enqueueNextStampAvailable(now: Date) {
  const supabase = createSupabaseServiceRoleClient()
  const businessDate = londonBusinessDate(now)
  const { data, error } = await supabase
    .from("customer_memberships")
    .select(
      "id, customer_id, merchant_id, current_stamp_count, active_cycle_number, merchants(business_name)"
    )
    .gt("current_stamp_count", 0)
    .order("updated_at", { ascending: true })
    .limit(100)

  if (error) {
    logger.warn("push_next_stamp_producer_failed", { reason: error.message })
    return 0
  }

  let count = 0
  for (const row of data ?? []) {
    if (!isRecord(row)) continue
    const eventType = "next_stamp_available"
    const payload = buildNotificationPayload({
      eventType,
      businessName: businessName(row),
      url: `/card/${stringValue(row.id)}`,
      merchantId: stringValue(row.merchant_id),
      membershipId: stringValue(row.id),
    })
    const queued = await enqueueRawEvent(
      eventType,
      { ...row, membership_id: row.id, cycle_number: row.active_cycle_number },
      payload,
      { source: "scheduled_worker" },
      businessDate
    )
    count += queued ? 1 : 0
  }

  return count
}

async function enqueueDormantProgress(now: Date) {
  const supabase = createSupabaseServiceRoleClient()
  const dormantCutoff = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000)
  const { data, error } = await supabase
    .from("customer_memberships")
    .select(
      "id, customer_id, merchant_id, current_stamp_count, active_cycle_number, updated_at, merchants(business_name)"
    )
    .gt("current_stamp_count", 0)
    .lte("updated_at", dormantCutoff.toISOString())
    .order("updated_at", { ascending: true })
    .limit(100)

  if (error) {
    logger.warn("push_dormant_progress_producer_failed", {
      reason: error.message,
    })
    return 0
  }

  let count = 0
  for (const row of data ?? []) {
    if (!isRecord(row)) continue
    const eventType = "dormant_progress"
    const payload = buildNotificationPayload({
      eventType,
      businessName: businessName(row),
      url: `/card/${stringValue(row.id)}`,
      merchantId: stringValue(row.merchant_id),
      membershipId: stringValue(row.id),
    })
    const queued = await enqueueRawEvent(
      eventType,
      { ...row, membership_id: row.id, cycle_number: row.active_cycle_number },
      payload,
      { source: "scheduled_worker" }
    )
    count += queued ? 1 : 0
  }

  return count
}

async function enqueueRawEvent(
  eventType: NotificationEventType,
  row: Record<string, unknown>,
  payload: NotificationPayload,
  metadata: Record<string, unknown>,
  businessDate = londonBusinessDate(new Date())
) {
  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase.rpc("enqueue_notification_event", {
    p_event_type: eventType,
    p_customer_id: stringValue(row.customer_id),
    p_merchant_id: nullableString(row.merchant_id),
    p_membership_id: nullableString(row.membership_id),
    p_reward_event_id: eventType.startsWith("reward_")
      ? nullableString(row.id)
      : null,
    p_cycle_number: numberValue(row.cycle_number),
    p_business_date: businessDate,
    p_due_at: new Date().toISOString(),
    p_dedupe_key: null,
    p_payload: payload,
    p_metadata: metadata,
  })

  if (error && !/duplicate/i.test(error.message)) {
    logger.warn("push_due_event_enqueue_failed", {
      eventType,
      reason: error.message,
    })
  }

  return !error
}

function businessName(row: Record<string, unknown>) {
  const merchant = firstRecord(row.merchants)
  return stringValue(merchant?.business_name) || "Your venue"
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error"
}

function firstRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return isRecord(value[0]) ? value[0] : null
  return isRecord(value) ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : ""
}

function nullableString(value: unknown) {
  return typeof value === "string" ? value : null
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

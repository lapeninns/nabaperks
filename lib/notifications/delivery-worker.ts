import "server-only"

import * as webPush from "web-push"
import type { PushSubscription, SendResult } from "web-push"

import { recordProductEvent } from "@/lib/analytics/events"
import {
  buildNotificationPayload,
  isNotificationEventType,
  notificationEventCategory,
  notificationRequiresMarketingConsent,
  type NotificationEventType,
  type NotificationPayload,
} from "@/lib/notifications/catalog"
import {
  getWebPushServerConfig,
  type NotificationPreferenceState,
} from "@/lib/notifications/push-subscriptions"
import { logger } from "@/lib/observability/logger"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type PushDeliveryWorkerResult = {
  produced: number
  processed: number
  sent: number
  skipped: number
  failed: number
}

type WebPushSender = (
  subscription: PushSubscription,
  payload: string
) => Promise<SendResult | void>

type NotificationEventRow = {
  id: string
  event_type: string
  category: string
  customer_id: string
  merchant_id: string | null
  membership_id: string | null
  reward_event_id: string | null
  payload: Record<string, unknown>
  metadata: Record<string, unknown>
  due_at: string
}

type PushSubscriptionRow = {
  id: string
  customer_id: string
  endpoint: string
  p256dh: string
  auth: string
}

export const scheduledNotificationProducerEventTypes = [
  "next_stamp_available",
  "reward_ready",
  "reward_expiring_soon",
  "reward_expired",
  "dormant_progress",
] as const

export async function runPushNotificationDeliveryWorker({
  now = new Date(),
  batchSize = 50,
}: {
  now?: Date
  batchSize?: number
} = {}): Promise<PushDeliveryWorkerResult> {
  const supabase = createSupabaseServiceRoleClient()
  const produced = await produceDueNotificationEvents(now)
  const result: PushDeliveryWorkerResult = {
    produced,
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  }

  if (!getWebPushServerConfig()) {
    logger.warn("push_delivery_worker_not_configured")
    void recordWorkerProductEvent(result, "not_configured")
    return result
  }

  const { data, error } = await supabase
    .from("notification_events")
    .select(
      "id, event_type, category, customer_id, merchant_id, membership_id, reward_event_id, payload, metadata, due_at"
    )
    .eq("status", "queued")
    .lte("due_at", now.toISOString())
    .order("due_at", { ascending: true })
    .limit(batchSize)

  if (error) {
    throw new Error(`Unable to load due notification events: ${error.message}`)
  }

  for (const event of (data ?? []) as NotificationEventRow[]) {
    const delivery = await deliverNotificationEvent(supabase, event, now)
    result.processed += 1
    result.sent += delivery.sent
    result.skipped += delivery.skipped
    result.failed += delivery.failed
  }

  void recordWorkerProductEvent(result, "completed")
  return result
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

  produced += await enqueueRewardExpiringSoon(now)
  produced += await enqueueRewardReady(now)
  produced += await enqueueNextStampAvailable(now)
  produced += await enqueueDormantProgress(now)

  return produced
}

export async function sendWebPushNotification(
  subscription: PushSubscription,
  payload: Partial<NotificationPayload>,
  sender: WebPushSender = defaultWebPushSender
) {
  const response = await sender(subscription, JSON.stringify(payload))
  return { ok: true as const, statusCode: response?.statusCode ?? 201 }
}

export function isPermanentWebPushFailure(error: unknown) {
  return (
    isRecord(error) &&
    (error.statusCode === 404 || error.statusCode === 410)
  )
}

export function isWithinQuietHours(
  date: Date,
  quietHoursStart = "21:00",
  quietHoursEnd = "09:00"
) {
  const minutes = londonMinutes(date)
  const start = timeToMinutes(quietHoursStart)
  const end = timeToMinutes(quietHoursEnd)

  if (start === end) return false
  if (start < end) return minutes >= start && minutes < end

  return minutes >= start || minutes < end
}

async function deliverNotificationEvent(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  event: NotificationEventRow,
  now: Date
) {
  const result = { sent: 0, skipped: 0, failed: 0 }
  if (!isNotificationEventType(event.event_type)) {
    await markEvent(supabase, event.id, "failed")
    result.failed += 1
    return result
  }

  if (
    (event.category === "reminder" || event.category === "marketing") &&
    isWithinQuietHours(now)
  ) {
    await deferEvent(supabase, event.id, nextQuietHoursEnd(now))
    result.skipped += 1
    return result
  }

  const allowed = await isDeliveryAllowed(supabase, event)
  if (!allowed) {
    await markEvent(supabase, event.id, "cancelled")
    await recordDelivery(supabase, event, null, "skipped", 0, "not_eligible")
    result.skipped += 1
    return result
  }

  const subscriptions = await getEnabledSubscriptions(supabase, event.customer_id)
  if (subscriptions.length === 0) {
    await markEvent(supabase, event.id, "cancelled")
    await recordDelivery(supabase, event, null, "skipped", 0, "no_subscription")
    result.skipped += 1
    return result
  }

  await markEvent(supabase, event.id, "delivering")
  for (const subscription of subscriptions) {
    try {
      const response = await sendWebPushNotification(
        toPushSubscription(subscription),
        event.payload
      )
      await recordDelivery(
        supabase,
        event,
        subscription.id,
        "sent",
        response.statusCode,
        null
      )
      result.sent += 1
    } catch (error) {
      const permanent = isPermanentWebPushFailure(error)
      await recordDelivery(
        supabase,
        event,
        subscription.id,
        permanent ? "permanent_failure" : "retryable_failure",
        statusCode(error),
        permanent ? "subscription_gone" : "send_failed"
      )

      if (permanent) {
        await supabase.rpc("disable_push_subscription_for_customer", {
          p_customer_id: subscription.customer_id,
          p_endpoint: subscription.endpoint,
          p_reason: "push_service_rejected",
        })
      }

      result.failed += 1
    }
  }

  await markEvent(supabase, event.id, result.sent > 0 ? "sent" : "failed")
  return result
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
    .limit(100)

  if (error) {
    logger.warn("push_reward_expiring_producer_failed", { reason: error.message })
    return 0
  }

  let count = 0
  for (const row of data ?? []) {
    if (!isRecord(row)) continue
    const eventType = "reward_expiring_soon"
    const rewardId = stringValue(row.id)
    const payload = buildNotificationPayload({
      eventType,
      businessName: businessName(row),
      rewardName: stringValue(row.reward_name),
      url: "/home/rewards",
      merchantId: stringValue(row.merchant_id),
      membershipId: stringValue(row.membership_id),
      rewardEventId: rewardId,
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
    .lte("redeemable_from", londonBusinessDate(now))
    .limit(100)

  if (error) {
    logger.warn("push_reward_ready_producer_failed", { reason: error.message })
    return 0
  }

  let count = 0
  for (const row of data ?? []) {
    if (!isRecord(row)) continue
    const eventType = "reward_ready"
    const rewardId = stringValue(row.id)
    const payload = buildNotificationPayload({
      eventType,
      businessName: businessName(row),
      rewardName: stringValue(row.reward_name),
      url: "/home/rewards",
      merchantId: stringValue(row.merchant_id),
      membershipId: stringValue(row.membership_id),
      rewardEventId: rewardId,
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
    .limit(100)

  if (error) {
    logger.warn("push_dormant_progress_producer_failed", { reason: error.message })
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
    p_dedupe_key: `${eventType}:${stringValue(row.id)}:${businessDate}`,
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

async function isDeliveryAllowed(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  event: NotificationEventRow
) {
  if (!isNotificationEventType(event.event_type)) return false
  const preferences = await getPreferences(supabase, event.customer_id)
  const category = notificationEventCategory(event.event_type)

  if (category === "transactional" && !preferences.transactionalEnabled) {
    return false
  }
  if (category === "reminder" && !preferences.reminderEnabled) return false
  if (notificationRequiresMarketingConsent(event.event_type)) {
    if (!preferences.marketingEnabled || !event.merchant_id) return false
    return hasMarketingConsent(supabase, event.customer_id, event.merchant_id)
  }

  return true
}

async function getPreferences(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  customerId: string
): Promise<NotificationPreferenceState> {
  const { data, error } = await supabase.rpc(
    "get_notification_preferences_for_customer",
    { p_customer_id: customerId }
  )

  if (error) {
    throw new Error(`Unable to load notification preferences: ${error.message}`)
  }

  const row = firstRecord(data)
  return {
    transactionalEnabled: booleanValue(row?.transactional_enabled, true),
    reminderEnabled: booleanValue(row?.reminder_enabled, true),
    marketingEnabled: booleanValue(row?.marketing_enabled, false),
    quietHoursStart: nullableString(row?.quiet_hours_start),
    quietHoursEnd: nullableString(row?.quiet_hours_end),
    activeSubscriptionCount: numberValue(row?.active_subscription_count) ?? 0,
  }
}

async function hasMarketingConsent(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  customerId: string,
  merchantId: string
) {
  const { data, error } = await supabase
    .from("consent_records")
    .select("consent_status, created_at")
    .eq("customer_id", customerId)
    .eq("merchant_id", merchantId)
    .order("created_at", { ascending: false })
    .limit(1)

  if (error) {
    throw new Error(`Unable to load marketing consent: ${error.message}`)
  }

  return firstRecord(data)?.consent_status === "opted_in"
}

async function getEnabledSubscriptions(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  customerId: string
) {
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id, customer_id, endpoint, p256dh, auth")
    .eq("customer_id", customerId)
    .eq("enabled", true)
    .is("revoked_at", null)
    .limit(20)

  if (error) {
    throw new Error(`Unable to load push subscriptions: ${error.message}`)
  }

  return (data ?? []).filter(isPushSubscriptionRow)
}

async function defaultWebPushSender(
  subscription: PushSubscription,
  payload: string
) {
  const config = getWebPushServerConfig()
  if (!config) throw new Error("Web Push VAPID configuration is missing")

  return webPush.sendNotification(subscription, payload, {
    vapidDetails: {
      subject: config.subject,
      publicKey: config.publicKey,
      privateKey: config.privateKey,
    },
    TTL: 60 * 60,
    urgency: "normal",
  })
}

async function recordDelivery(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  event: NotificationEventRow,
  subscriptionId: string | null,
  status: "sent" | "retryable_failure" | "permanent_failure" | "skipped",
  responseStatus: number,
  failureReason: string | null
) {
  await supabase.rpc("record_notification_delivery", {
    p_event_id: event.id,
    p_push_subscription_id: subscriptionId,
    p_customer_id: event.customer_id,
    p_status: status,
    p_attempt_number: 1,
    p_response_status: responseStatus || null,
    p_failure_reason: failureReason,
    p_response_metadata: {},
  })
  void recordDeliveryProductEvent(event, status, responseStatus, failureReason)
}

async function recordWorkerProductEvent(
  result: PushDeliveryWorkerResult,
  outcome: "completed" | "not_configured"
) {
  try {
    await recordProductEvent({
      eventName: "push_delivery_worker_ran",
      actorType: "system",
      metadata: {
        outcome,
        produced: result.produced,
        processed: result.processed,
        sent: result.sent,
        skipped: result.skipped,
        failed: result.failed,
      },
    })
  } catch (error) {
    logger.warn("push_delivery_worker_product_event_failed", { error })
  }
}

async function recordDeliveryProductEvent(
  event: NotificationEventRow,
  status: "sent" | "retryable_failure" | "permanent_failure" | "skipped",
  responseStatus: number,
  failureReason: string | null
) {
  const eventName =
    status === "sent"
      ? "push_notification_delivered"
      : status === "skipped"
        ? "push_notification_skipped"
        : "push_notification_failed"

  try {
    await recordProductEvent({
      eventName,
      merchantId: event.merchant_id,
      customerId: event.customer_id,
      membershipId: event.membership_id,
      actorType: "system",
      metadata: {
        notification_event_id: event.id,
        notification_event_type: event.event_type,
        delivery_status: status,
        response_status: responseStatus || null,
        failure_reason: failureReason,
      },
    })
  } catch (error) {
    logger.warn("push_delivery_product_event_failed", {
      eventName,
      notificationEventType: event.event_type,
      error,
    })
  }
}

async function markEvent(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  eventId: string,
  status: "delivering" | "sent" | "failed" | "cancelled"
) {
  await supabase
    .from("notification_events")
    .update({
      status,
      sent_at: status === "sent" ? new Date().toISOString() : null,
      cancelled_at: status === "cancelled" ? new Date().toISOString() : null,
    })
    .eq("id", eventId)
}

async function deferEvent(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  eventId: string,
  nextDueAt: Date
) {
  await supabase
    .from("notification_events")
    .update({ due_at: nextDueAt.toISOString() })
    .eq("id", eventId)
}

function toPushSubscription(row: PushSubscriptionRow): PushSubscription {
  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  }
}

function isPushSubscriptionRow(value: unknown): value is PushSubscriptionRow {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.customer_id === "string" &&
    typeof value.endpoint === "string" &&
    typeof value.p256dh === "string" &&
    typeof value.auth === "string"
  )
}

function businessName(row: Record<string, unknown>) {
  const merchant = firstRecord(row.merchants)
  return stringValue(merchant?.business_name) || "Your venue"
}

function nextQuietHoursEnd(date: Date) {
  const today = londonDateParts(date)
  const next = londonWallClockToUtc(today.year, today.month, today.day, 9, 0)

  if (next > date) return next

  const tomorrowSeed = new Date(Date.UTC(today.year, today.month - 1, today.day + 1))
  const tomorrow = londonDateParts(tomorrowSeed)
  return londonWallClockToUtc(tomorrow.year, tomorrow.month, tomorrow.day, 9, 0)
}

function londonWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
) {
  const target = Date.UTC(year, month - 1, day, hour, minute)
  let candidate = new Date(target)

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed = londonDateTimeParts(candidate)
    const observedAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute
    )
    const delta = target - observedAsUtc
    if (delta === 0) return candidate
    candidate = new Date(candidate.getTime() + delta)
  }

  return candidate
}

function londonDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  return {
    year: Number(part(parts, "year")),
    month: Number(part(parts, "month")),
    day: Number(part(parts, "day")),
  }
}

function londonDateTimeParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)

  return {
    ...londonDateParts(date),
    hour: Number(part(parts, "hour")),
    minute: Number(part(parts, "minute")),
  }
}

function londonBusinessDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  return `${part(parts, "year")}-${part(parts, "month")}-${part(parts, "day")}`
}

function londonMinutes(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)

  return timeToMinutes(`${part(parts, "hour")}:${part(parts, "minute")}`)
}

function timeToMinutes(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":")
  return Number(hours) * 60 + Number(minutes)
}

function part(parts: Intl.DateTimeFormatPart[], type: string) {
  return parts.find((entry) => entry.type === type)?.value ?? "00"
}

function statusCode(error: unknown) {
  return isRecord(error) && typeof error.statusCode === "number"
    ? error.statusCode
    : 0
}

function firstRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const [first] = value
    return isRecord(first) ? first : null
  }
  return isRecord(value) ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
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

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback
}

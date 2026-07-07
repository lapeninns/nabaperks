import "server-only"

import * as webPush from "web-push"
import type { PushSubscription, SendResult } from "web-push"

import { recordProductEvent } from "@/lib/analytics/events"
import {
  resolveDrainOptions,
  shouldContinueDraining,
} from "@/lib/notifications/drain-plan"
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
import {
  customerNotificationDeliveryCapReached,
  isFrequencyCappedCategory,
  nextNotificationFrequencyWindow,
} from "@/lib/notifications/frequency-cap"
import {
  isWithinQuietHours,
  londonBusinessDate,
  nextQuietHoursEnd,
} from "@/lib/notifications/london-time"
import { hasPushMarketingConsent } from "@/lib/notifications/push-marketing-eligibility"
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

type SubscriptionDeliveryResult = {
  sent: number
  retryableFailed: number
  permanentFailed: number
}

export const scheduledNotificationProducerEventTypes = [
  "next_stamp_available",
  "reward_ready",
  "reward_expiring_soon",
  "reward_expired",
  "dormant_progress",
] as const

const MAX_PUSH_DELIVERY_ATTEMPTS = 3
const PUSH_RETRY_BACKOFF_MS = [5 * 60_000, 30 * 60_000] as const

export async function runPushNotificationDeliveryWorker({
  now = new Date(),
  batchSize = 50,
  maxEvents,
  timeBudgetMs,
}: {
  now?: Date
  batchSize?: number
  maxEvents?: number
  timeBudgetMs?: number
} = {}): Promise<PushDeliveryWorkerResult> {
  const supabase = createSupabaseServiceRoleClient()
  // Producers run exactly once per invocation, before the drain loop —
  // re-producing mid-drain could starve the empty-batch exit.
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

  // Drain: claim successive batches until the due queue is empty or the run
  // budget (events / soft time) is spent (MS-notifications-drain-throughput).
  // Defaults keep the historical single-batch behavior; the cron route opts
  // into a larger budget explicitly.
  const options = resolveDrainOptions({ batchSize, maxEvents, timeBudgetMs })
  const startedAtMs = Date.now()

  while (true) {
    const { data, error } = await supabase.rpc("claim_due_notification_events", {
      p_limit: options.batchSize,
      p_now: now.toISOString(),
    })

    if (error) {
      throw new Error(`Unable to load due notification events: ${error.message}`)
    }

    const events = (data ?? []) as NotificationEventRow[]
    for (const event of events) {
      const delivery = await deliverNotificationEvent(supabase, event, now)
      result.processed += 1
      result.sent += delivery.sent
      result.skipped += delivery.skipped
      result.failed += delivery.failed
    }

    const state = { processed: result.processed, lastBatchSize: events.length }
    if (!shouldContinueDraining(state, options, Date.now() - startedAtMs)) {
      break
    }
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
    if (!producer) {
      continue
    }

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

type NotificationProducer = {
  readonly failureEvent: string
  readonly produce: () => Promise<number>
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
    isRecord(error) && (error.statusCode === 404 || error.statusCode === 410)
  )
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
  const eventType = event.event_type
  const category = notificationEventCategory(eventType)

  const preferences = await getPreferences(supabase, event.customer_id)
  if (
    isQuietHoursDeferrable(event) &&
    isWithinQuietHours(
      now,
      preferences.quietHoursStart ?? undefined,
      preferences.quietHoursEnd ?? undefined
    )
  ) {
    await deferEvent(
      supabase,
      event.id,
      nextQuietHoursEnd(now, preferences.quietHoursEnd ?? undefined)
    )
    result.skipped += 1
    return result
  }

  if (
    isFrequencyCappedCategory(category) &&
    (await customerNotificationDeliveryCapReached(supabase, {
      customerId: event.customer_id,
      now,
    }))
  ) {
    await deferEvent(supabase, event.id, nextNotificationFrequencyWindow(now))
    await recordDelivery(
      supabase,
      event,
      null,
      "skipped",
      1,
      0,
      "notification_frequency_cap"
    )
    result.skipped += 1
    return result
  }

  const allowed = await isDeliveryAllowed(supabase, event, preferences)
  if (!allowed) {
    await markEvent(supabase, event.id, "cancelled")
    await recordDelivery(supabase, event, null, "skipped", 1, 0, "not_eligible")
    result.skipped += 1
    return result
  }

  const enabledSubscriptions = await getEnabledSubscriptions(
    supabase,
    event.customer_id
  )
  const subscriptions = await filterAlreadySentSubscriptions(
    supabase,
    event.id,
    enabledSubscriptions
  )
  const previouslySentCount = Math.max(
    enabledSubscriptions.length - subscriptions.length,
    0
  )

  if (subscriptions.length === 0) {
    await markEvent(
      supabase,
      event.id,
      enabledSubscriptions.length === 0 ? "cancelled" : "sent"
    )
    if (enabledSubscriptions.length === 0) {
      await recordDelivery(
        supabase,
        event,
        null,
        "skipped",
        1,
        0,
        "no_subscription"
      )
    }
    result.skipped += 1
    return result
  }

  const attemptNumber = await nextDeliveryAttemptNumber(supabase, event.id)
  const deliveryResults = await Promise.all(
    subscriptions.map((subscription) =>
      deliverPushSubscription(supabase, event, subscription, attemptNumber)
    )
  )
  for (const delivery of deliveryResults) {
    result.sent += delivery.sent
    result.failed += delivery.retryableFailed + delivery.permanentFailed
  }

  const retryableFailures = deliveryResults.reduce(
    (count, delivery) => count + delivery.retryableFailed,
    0
  )
  const totalSentForEvent = previouslySentCount + result.sent

  if (retryableFailures > 0 && attemptNumber < MAX_PUSH_DELIVERY_ATTEMPTS) {
    await deferEvent(supabase, event.id, nextRetryDueAt(now, attemptNumber))
  } else if (totalSentForEvent > 0) {
    await markEvent(supabase, event.id, "sent")
  } else {
    await markEvent(supabase, event.id, "failed")
  }

  return result
}

async function deliverPushSubscription(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  event: NotificationEventRow,
  subscription: PushSubscriptionRow,
  attemptNumber: number
): Promise<SubscriptionDeliveryResult> {
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
      attemptNumber,
      response.statusCode,
      null
    )
    return { sent: 1, retryableFailed: 0, permanentFailed: 0 }
  } catch (error) {
    const deliveryError =
      error instanceof Error ? error : new Error(String(error))
    const permanent = isPermanentWebPushFailure(deliveryError)
    await recordDelivery(
      supabase,
      event,
      subscription.id,
      permanent ? "permanent_failure" : "retryable_failure",
      attemptNumber,
      statusCode(deliveryError),
      permanent ? "subscription_gone" : "send_failed"
    )

    if (permanent) {
      await disableRejectedPushSubscription(supabase, subscription)
    }

    return {
      sent: 0,
      retryableFailed: permanent ? 0 : 1,
      permanentFailed: permanent ? 1 : 0,
    }
  }
}

async function disableRejectedPushSubscription(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  subscription: PushSubscriptionRow
) {
  const { error } = await supabase.rpc(
    "disable_push_subscription_for_customer",
    {
      p_customer_id: subscription.customer_id,
      p_endpoint: subscription.endpoint,
      p_reason: "push_service_rejected",
    }
  )

  if (error) {
    logger.warn("push_subscription_disable_failed", {
      subscriptionId: subscription.id,
      customerId: subscription.customer_id,
      reason: error.message,
    })
  }
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
    logger.warn("push_reward_expiring_producer_failed", {
      reason: error.message,
    })
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
    // "Reward ready" is the earned-card celebration. Issued rewards (birthday /
    // merchant-sent) get their own arrival push at issue time, so scoping to
    // stamp_cycle here stops them re-pushing a transactional reward_ready every
    // day they sit unredeemed. The expiry reminders below stay unscoped —
    // they are bounded and useful for issued rewards too.
    .eq("source", "stamp_cycle")
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
  event: NotificationEventRow,
  preferences: NotificationPreferenceState
) {
  if (!isNotificationEventType(event.event_type)) return false
  const category = notificationEventCategory(event.event_type)

  if (category === "transactional" && !preferences.transactionalEnabled) {
    return false
  }
  if (category === "reminder" && !preferences.reminderEnabled) return false
  if (notificationRequiresMarketingConsent(event.event_type)) {
    if (!preferences.marketingEnabled || !event.merchant_id) return false
    return hasPushMarketingConsent(supabase, {
      customerId: event.customer_id,
      merchantId: event.merchant_id,
    })
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

async function filterAlreadySentSubscriptions(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  eventId: string,
  subscriptions: PushSubscriptionRow[]
) {
  if (subscriptions.length === 0) return []

  const { data, error } = await supabase
    .from("notification_deliveries")
    .select("push_subscription_id")
    .eq("notification_event_id", eventId)
    .eq("status", "sent")
    .in(
      "push_subscription_id",
      subscriptions.map((subscription) => subscription.id)
    )

  if (error) {
    throw new Error(
      `Unable to load sent notification subscriptions: ${error.message}`
    )
  }

  const sentSubscriptionIds = new Set(
    (data ?? [])
      .map((row) => stringValue(row.push_subscription_id))
      .filter((id): id is string => Boolean(id))
  )

  return subscriptions.filter(
    (subscription) => !sentSubscriptionIds.has(subscription.id)
  )
}

function isQuietHoursDeferrable(event: NotificationEventRow) {
  return event.category === "reminder" || event.category === "marketing"
}

async function nextDeliveryAttemptNumber(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  eventId: string
) {
  const { data, error } = await supabase
    .from("notification_deliveries")
    .select("attempt_number")
    .eq("notification_event_id", eventId)
    .order("attempt_number", { ascending: false })
    .limit(1)

  if (error) {
    throw new Error(
      `Unable to load notification delivery attempts: ${error.message}`
    )
  }

  return (numberValue(firstRecord(data)?.attempt_number) ?? 0) + 1
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
  attemptNumber: number,
  responseStatus: number,
  failureReason: string | null
) {
  const { error } = await supabase.rpc("record_notification_delivery", {
    p_notification_event_id: event.id,
    p_push_subscription_id: subscriptionId,
    p_customer_id: event.customer_id,
    p_status: status,
    p_attempt_number: attemptNumber,
    p_response_status: responseStatus || null,
    p_failure_reason: failureReason,
    p_response_metadata: {},
  })
  if (error) {
    throw new Error(`Unable to record notification delivery: ${error.message}`)
  }

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
    const productEventError =
      error instanceof Error ? error : new Error(String(error))
    logger.warn("push_delivery_worker_product_event_failed", {
      error: productEventError,
    })
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
    const productEventError =
      error instanceof Error ? error : new Error(String(error))
    logger.warn("push_delivery_product_event_failed", {
      eventName,
      notificationEventType: event.event_type,
      error: productEventError,
    })
  }
}

async function markEvent(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  eventId: string,
  status: "delivering" | "sent" | "failed" | "cancelled"
) {
  const { error } = await supabase
    .from("notification_events")
    .update({
      status,
      sent_at: status === "sent" ? new Date().toISOString() : null,
      cancelled_at: status === "cancelled" ? new Date().toISOString() : null,
    })
    .eq("id", eventId)

  if (error) {
    throw new Error(
      `Unable to mark notification event ${status}: ${error.message}`
    )
  }
}

async function deferEvent(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  eventId: string,
  nextDueAt: Date
) {
  const { error } = await supabase
    .from("notification_events")
    .update({ status: "queued", due_at: nextDueAt.toISOString() })
    .eq("id", eventId)

  if (error) {
    throw new Error(`Unable to defer notification event: ${error.message}`)
  }
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

function nextRetryDueAt(now: Date, attemptNumber: number) {
  const backoff =
    PUSH_RETRY_BACKOFF_MS[
      Math.min(Math.max(attemptNumber - 1, 0), PUSH_RETRY_BACKOFF_MS.length - 1)
    ]
  return new Date(now.getTime() + backoff)
}

function statusCode(error: unknown) {
  return isRecord(error) && typeof error.statusCode === "number"
    ? error.statusCode
    : 0
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error"
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

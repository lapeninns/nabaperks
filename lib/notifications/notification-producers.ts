import "server-only"

import {
  buildNotificationPayload,
  type NotificationEventType,
  type NotificationPayload,
} from "@/lib/notifications/catalog"
import { londonBusinessDate } from "@/lib/notifications/london-time"
import { logger } from "@/lib/observability/logger"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import {
  isCollectionSetupBlock,
  parseRewardCollectionState,
} from "@/lib/customer/reward-collection-state"

export const scheduledNotificationProducerEventTypes = [
  "next_stamp_available",
  "reward_ready",
  "reward_expiring_soon",
  "reward_expired",
  "dormant_progress",
  "collection_window_opens",
  "loyalty_terms_updated",
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
    {
      failureEvent: "push_collection_window_producer_failed",
      produce: () => enqueueCollectionWindowOpens(now),
    },
    {
      failureEvent: "push_loyalty_terms_updated_producer_failed",
      produce: () => enqueueLoyaltyTermsUpdated(now),
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
  const { data, error } = await supabase.rpc(
    "list_pending_reward_notification_candidates",
    {
      p_event_type: "reward_expiring_soon",
      p_now: now.toISOString(),
      p_limit: 100,
    }
  )

  if (error) {
    logger.warn("push_reward_expiring_producer_failed", {
      reason: error.message,
    })
    return 0
  }

  const rows = records(data)
  const collectionStates = await loadCollectionStates(supabase, rows)
  let count = 0
  for (const row of rows) {
    const rewardEventId = stringValue(row.reward_event_id)
    const collection = collectionStates.get(rewardEventId)
    // A setup block (profile, verified email) is recoverable, so the final
    // expiry warning still goes out; other blocks and terminal states do not.
    const warnable =
      ["waiting", "ready"].includes(collection?.state ?? "") ||
      (collection?.state === "blocked" &&
        isCollectionSetupBlock(collection.reason))
    if (!collection || !warnable || !collection.expiresAt) continue
    const eventType = "reward_expiring_soon"
    const payload = buildNotificationPayload({
      eventType,
      businessName: stringValue(row.business_name) || "Your venue",
      rewardName: stringValue(row.reward_name),
      url: "/home/rewards",
      merchantId: stringValue(row.merchant_id),
      membershipId: stringValue(row.membership_id),
      rewardEventId,
      expiresAt: collection.expiresAt,
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
  const { data, error } = await supabase.rpc(
    "list_pending_reward_notification_candidates",
    {
      p_event_type: "reward_ready",
      p_now: now.toISOString(),
      p_limit: 100,
    }
  )

  if (error) {
    logger.warn("push_reward_ready_producer_failed", { reason: error.message })
    return 0
  }

  const rows = records(data)
  const collectionStates = await loadCollectionStates(supabase, rows)
  let count = 0
  for (const row of rows) {
    const rewardEventId = stringValue(row.reward_event_id)
    const collection = collectionStates.get(rewardEventId)
    if (collection?.state !== "ready") continue
    const eventType = "reward_ready"
    const payload = buildNotificationPayload({
      eventType,
      businessName: stringValue(row.business_name) || "Your venue",
      rewardName: stringValue(row.reward_name),
      url: "/home/rewards",
      merchantId: stringValue(row.merchant_id),
      membershipId: stringValue(row.membership_id),
      rewardEventId,
    })
    const queued = await enqueueRawEvent(eventType, row, payload, {
      source: "scheduled_worker",
    })
    count += queued ? 1 : 0
  }

  return count
}

async function loadCollectionStates(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  rows: readonly Record<string, unknown>[]
) {
  const rewardIds = rows
    .map((row) => stringValue(row.reward_event_id))
    .filter(Boolean)
  if (rewardIds.length === 0) return new Map()

  const { data, error } = await supabase.rpc("get_reward_collection_states", {
    p_reward_ids: rewardIds,
  })
  if (error) {
    throw new Error(`Unable to load reward collection states: ${error.message}`)
  }
  return new Map(
    records(data).map((row) => [
      stringValue(row.reward_id),
      parseRewardCollectionState(row),
    ])
  )
}

async function enqueueNextStampAvailable(now: Date) {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc(
    "list_pending_next_stamp_available",
    { p_now: now.toISOString(), p_limit: 100 }
  )

  if (error) {
    logger.warn("push_next_stamp_producer_failed", { reason: error.message })
    return 0
  }

  let count = 0
  for (const row of records(data)) {
    const membershipId = stringValue(row.membership_id)
    const businessDate = stringValue(row.business_date)
    const dedupeKey = stringValue(row.dedupe_key)
    if (!membershipId || !businessDate || !dedupeKey) continue
    const eventType = "next_stamp_available"
    const payload = buildNotificationPayload({
      eventType,
      businessName: stringValue(row.business_name) || "Your venue",
      url: `/card/${membershipId}`,
      merchantId: stringValue(row.merchant_id),
      membershipId,
    })
    const queued = await enqueueRawEvent(
      eventType,
      row,
      payload,
      {
        source: "scheduled_worker",
        last_earned_business_date: nullableString(
          row.last_earned_business_date
        ),
      },
      businessDate,
      { dueAt: now.toISOString(), dedupeKey }
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

async function enqueueCollectionWindowOpens(now: Date) {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc(
    "list_collection_window_reminders",
    { p_now: now.toISOString(), p_horizon_hours: 24 }
  )
  if (error) throw new Error(error.message)

  const rows = (data ?? []).filter(
    (row: unknown): row is Record<string, unknown> => isRecord(row)
  )
  const merchantIds = [
    ...new Set(
      rows
        .map((row: Record<string, unknown>) => stringValue(row.merchant_id))
        .filter(Boolean)
    ),
  ]
  const businessNames = new Map<string, string>()
  if (merchantIds.length > 0) {
    const merchantResult = await supabase
      .from("merchants")
      .select("id, business_name")
      .in("id", merchantIds)
    if (merchantResult.error) throw new Error(merchantResult.error.message)
    for (const merchant of merchantResult.data ?? []) {
      if (!isRecord(merchant)) continue
      businessNames.set(
        stringValue(merchant.id),
        stringValue(merchant.business_name)
      )
    }
  }

  let count = 0
  for (const row of rows) {
    const eventType = "collection_window_opens"
    const rewardEventId = stringValue(row.reward_event_id)
    const membershipId = stringValue(row.membership_id)
    const merchantId = stringValue(row.merchant_id)
    const windowStartsAt = stringValue(row.window_starts_at)
    const dueAt = stringValue(row.due_at)
    const dedupeKey = stringValue(row.dedupe_key)
    if (
      !rewardEventId ||
      !membershipId ||
      !merchantId ||
      !dueAt ||
      !dedupeKey
    ) {
      continue
    }
    const payload = buildNotificationPayload({
      eventType,
      businessName: businessNames.get(merchantId) ?? "Your venue",
      rewardName: stringValue(row.upgrade_reward_name),
      url: `/reward/${rewardEventId}`,
      merchantId,
      membershipId,
      rewardEventId,
    })
    const queued = await enqueueRawEvent(
      eventType,
      row,
      payload,
      {
        source: "scheduled_worker",
        window_id: nullableString(row.window_id),
        window_starts_at: nullableString(row.window_starts_at),
        window_ends_at: nullableString(row.window_ends_at),
        upgrade_reward_name: nullableString(row.upgrade_reward_name),
      },
      windowStartsAt
        ? londonBusinessDate(new Date(windowStartsAt))
        : londonBusinessDate(now),
      { dueAt, dedupeKey }
    )
    count += queued ? 1 : 0
  }
  return count
}

async function enqueueLoyaltyTermsUpdated(now: Date) {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc(
    "list_pending_loyalty_terms_updates",
    {
      p_limit: 100,
    }
  )
  if (error) throw new Error(error.message)

  let count = 0
  for (const row of data ?? []) {
    if (!isRecord(row)) continue
    const membershipId = stringValue(row.membership_id)
    const cutoverAt = stringValue(row.policy_cutover_notice_at)
    if (!membershipId || !cutoverAt) continue
    const eventType = "loyalty_terms_updated"
    const payload = buildNotificationPayload({
      eventType,
      businessName: stringValue(row.business_name) || "Your venue",
      url: `/card/${membershipId}`,
      merchantId: stringValue(row.merchant_id),
      membershipId,
    })
    const queued = await enqueueRawEvent(
      eventType,
      { ...row, cycle_number: row.active_cycle_number },
      payload,
      {
        source: "policy_cutover",
        policy_cutover_notice_at: cutoverAt,
      },
      londonBusinessDate(new Date(cutoverAt)),
      {
        dueAt: now.toISOString(),
        dedupeKey: `loyalty_terms_updated:${membershipId}:${cutoverAt}`,
      }
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
  businessDate = londonBusinessDate(new Date()),
  schedule?: { readonly dueAt: string; readonly dedupeKey: string }
) {
  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase.rpc("enqueue_notification_event", {
    p_event_type: eventType,
    p_customer_id: stringValue(row.customer_id),
    p_merchant_id: nullableString(row.merchant_id),
    p_membership_id: nullableString(row.membership_id),
    p_reward_event_id:
      nullableString(row.reward_event_id) ??
      (eventType.startsWith("reward_") ? nullableString(row.id) : null),
    p_cycle_number: numberValue(row.cycle_number),
    p_business_date: businessDate,
    p_due_at: schedule?.dueAt ?? new Date().toISOString(),
    p_dedupe_key: schedule?.dedupeKey ?? null,
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

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
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

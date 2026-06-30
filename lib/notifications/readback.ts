import "server-only"

import {
  shapeCustomerNotificationDeliveryReadback,
  type CustomerNotificationDeliveryReadback,
} from "@/lib/notifications/readback-core"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type CustomerNotificationReadbackItem = {
  readonly id: string
  readonly eventType: string
  readonly category: string
  readonly status: string
  readonly merchantId: string | null
  readonly membershipId: string | null
  readonly rewardEventId: string | null
  readonly title: string | null
  readonly body: string | null
  readonly url: string | null
  readonly dueAt: string | null
  readonly sentAt: string | null
  readonly cancelledAt: string | null
  readonly createdAt: string
  readonly deliveries: readonly CustomerNotificationDeliveryReadback[]
}

type EventRow = {
  readonly id: string
  readonly event_type: string
  readonly category: string
  readonly status: string
  readonly merchant_id: string | null
  readonly membership_id: string | null
  readonly reward_event_id: string | null
  readonly payload: Record<string, unknown> | null
  readonly due_at: string | null
  readonly sent_at: string | null
  readonly cancelled_at: string | null
  readonly created_at: string
}

type DeliveryRow = {
  readonly notification_event_id: string
  readonly status: string
  readonly attempt_number: number
  readonly response_status: number | null
  readonly failure_reason: string | null
  readonly created_at: string
}

export async function getCustomerNotificationReadback({
  customerId,
  limit = 50,
}: {
  customerId: string
  limit?: number
}): Promise<CustomerNotificationReadbackItem[]> {
  const supabase = createSupabaseServiceRoleClient()
  const boundedLimit = Math.max(1, Math.min(limit, 100))
  const { data: events, error: eventsError } = await supabase
    .from("notification_events")
    .select(
      "id, event_type, category, status, merchant_id, membership_id, reward_event_id, payload, due_at, sent_at, cancelled_at, created_at"
    )
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(boundedLimit)

  if (eventsError) {
    throw new Error(
      `Unable to load notification events: ${eventsError.message}`
    )
  }

  const eventRows = eventRowsFromQuery(events)
  const eventIds = eventRows.map((event) => event.id)
  const deliveriesByEvent = new Map<
    string,
    CustomerNotificationDeliveryReadback[]
  >()

  if (eventIds.length > 0) {
    const { data: deliveries, error: deliveriesError } = await supabase
      .from("notification_deliveries")
      .select(
        "notification_event_id, status, attempt_number, response_status, failure_reason, created_at"
      )
      .eq("customer_id", customerId)
      .in("notification_event_id", eventIds)
      .order("created_at", { ascending: false })

    if (deliveriesError) {
      throw new Error(
        `Unable to load notification deliveries: ${deliveriesError.message}`
      )
    }

    for (const delivery of deliveryRowsFromQuery(deliveries)) {
      const bucket = deliveriesByEvent.get(delivery.notification_event_id) ?? []
      bucket.push(
        shapeCustomerNotificationDeliveryReadback({
          status: delivery.status,
          attemptNumber: delivery.attempt_number,
          responseStatus: delivery.response_status,
          failureReason: delivery.failure_reason,
          createdAt: delivery.created_at,
        })
      )
      deliveriesByEvent.set(delivery.notification_event_id, bucket)
    }
  }

  return eventRows.map((event) => ({
    id: event.id,
    eventType: event.event_type,
    category: event.category,
    status: event.status,
    merchantId: event.merchant_id,
    membershipId: event.membership_id,
    rewardEventId: event.reward_event_id,
    ...readPayload(event.payload),
    dueAt: event.due_at,
    sentAt: event.sent_at,
    cancelledAt: event.cancelled_at,
    createdAt: event.created_at,
    deliveries: deliveriesByEvent.get(event.id) ?? [],
  }))
}

function readPayload(payload: Record<string, unknown> | null) {
  return {
    title: typeof payload?.title === "string" ? payload.title : null,
    body: typeof payload?.body === "string" ? payload.body : null,
    url: typeof payload?.url === "string" ? payload.url : null,
  }
}

function eventRowsFromQuery(value: unknown): readonly EventRow[] {
  const rows: EventRow[] = []
  if (!Array.isArray(value)) return rows

  for (const item of value) {
    const row = eventRowFromQuery(item)
    if (row) rows.push(row)
  }

  return rows
}

function eventRowFromQuery(value: unknown): EventRow | null {
  if (!isRecord(value)) return null

  const id = stringValue(value.id)
  const eventType = stringValue(value.event_type)
  const category = stringValue(value.category)
  const status = stringValue(value.status)
  const createdAt = stringValue(value.created_at)

  if (!id || !eventType || !category || !status || !createdAt) return null

  return {
    id,
    event_type: eventType,
    category,
    status,
    merchant_id: nullableString(value.merchant_id),
    membership_id: nullableString(value.membership_id),
    reward_event_id: nullableString(value.reward_event_id),
    payload: isRecord(value.payload) ? value.payload : null,
    due_at: nullableString(value.due_at),
    sent_at: nullableString(value.sent_at),
    cancelled_at: nullableString(value.cancelled_at),
    created_at: createdAt,
  }
}

function deliveryRowsFromQuery(value: unknown): readonly DeliveryRow[] {
  const rows: DeliveryRow[] = []
  if (!Array.isArray(value)) return rows

  for (const item of value) {
    const row = deliveryRowFromQuery(item)
    if (row) rows.push(row)
  }

  return rows
}

function deliveryRowFromQuery(value: unknown): DeliveryRow | null {
  if (!isRecord(value)) return null

  const eventId = stringValue(value.notification_event_id)
  const status = stringValue(value.status)
  const attemptNumber = numberValue(value.attempt_number)
  const createdAt = stringValue(value.created_at)

  if (!eventId || !status || attemptNumber === null || !createdAt) return null

  return {
    notification_event_id: eventId,
    status,
    attempt_number: attemptNumber,
    response_status: numberValue(value.response_status),
    failure_reason: nullableString(value.failure_reason),
    created_at: createdAt,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown): string {
  return typeof value === "string" && value.length > 0 ? value : ""
}

function nullableString(value: unknown): string | null {
  const result = stringValue(value)
  return result || null
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type CustomerNotificationReadbackItem = {
  id: string
  eventType: string
  category: string
  status: string
  merchantId: string | null
  membershipId: string | null
  rewardEventId: string | null
  title: string | null
  body: string | null
  url: string | null
  dueAt: string | null
  sentAt: string | null
  cancelledAt: string | null
  createdAt: string
  deliveries: CustomerNotificationDeliveryReadback[]
}

export type CustomerNotificationDeliveryReadback = {
  status: string
  attemptNumber: number
  responseStatus: number | null
  failureReason: string | null
  createdAt: string
}

type EventRow = {
  id: string
  event_type: string
  category: string
  status: string
  merchant_id: string | null
  membership_id: string | null
  reward_event_id: string | null
  payload: Record<string, unknown> | null
  due_at: string | null
  sent_at: string | null
  cancelled_at: string | null
  created_at: string
}

type DeliveryRow = {
  event_id: string
  status: string
  attempt_number: number
  response_status: number | null
  failure_reason: string | null
  created_at: string
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
    throw new Error(`Unable to load notification events: ${eventsError.message}`)
  }

  const eventRows = (events ?? []) as EventRow[]
  const eventIds = eventRows.map((event) => event.id)
  const deliveriesByEvent = new Map<
    string,
    CustomerNotificationDeliveryReadback[]
  >()

  if (eventIds.length > 0) {
    const { data: deliveries, error: deliveriesError } = await supabase
      .from("notification_deliveries")
      .select(
        "event_id, status, attempt_number, response_status, failure_reason, created_at"
      )
      .eq("customer_id", customerId)
      .in("event_id", eventIds)
      .order("created_at", { ascending: false })

    if (deliveriesError) {
      throw new Error(
        `Unable to load notification deliveries: ${deliveriesError.message}`
      )
    }

    for (const delivery of (deliveries ?? []) as DeliveryRow[]) {
      const bucket = deliveriesByEvent.get(delivery.event_id) ?? []
      bucket.push({
        status: delivery.status,
        attemptNumber: delivery.attempt_number,
        responseStatus: delivery.response_status,
        failureReason: delivery.failure_reason,
        createdAt: delivery.created_at,
      })
      deliveriesByEvent.set(delivery.event_id, bucket)
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

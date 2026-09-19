import "server-only"

import type { CustomerMessageChannel } from "@/lib/notifications/channel-plan-core"
import type {
  NotificationCategory,
  PhoneMessageCopy,
} from "@/lib/notifications/catalog"
import type { CustomerPhoneRecipient } from "@/lib/notifications/customer-messaging-address"
import { sendCustomerMessage } from "@/lib/notifications/twilio-messaging"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

type ServiceClient = ReturnType<typeof createSupabaseServiceRoleClient>

type PhoneDeliveryInput = {
  readonly supabase: ServiceClient
  readonly event: {
    readonly id: string
    readonly event_type: string
    readonly customer_id: string
    readonly merchant_id: string | null
    readonly payload: Readonly<Record<string, unknown>>
  }
  readonly channel: CustomerMessageChannel
  readonly recipient: CustomerPhoneRecipient
  readonly category: NotificationCategory
  readonly copy: PhoneMessageCopy
  readonly dryRun: boolean
}

export type PhoneDeliveryOutcome =
  | { readonly status: "accepted" }
  | { readonly status: "continue"; readonly failed: boolean }
  | { readonly status: "push"; readonly failed: boolean }
  | { readonly status: "defer"; readonly dueAt: Date }
  | { readonly status: "failed" }

export async function deliverCustomerPhoneChannel(
  input: PhoneDeliveryInput
): Promise<PhoneDeliveryOutcome> {
  if (input.dryRun) {
    await recordDryRun(input)
    return { status: "continue", failed: false }
  }

  const admitted = await admitBudget(input)
  if (!admitted) {
    return { status: "defer", dueAt: new Date(Date.now() + 60 * 60_000) }
  }

  const deliveryId = await beginDelivery(input)
  if (!deliveryId) {
    return { status: "defer", dueAt: new Date(Date.now() + 5 * 60_000) }
  }

  const result = await sendCustomerMessage({
    channel: input.channel,
    recipient: input.recipient.e164,
    deliveryId,
    eventType: input.event.event_type,
    body: input.copy.smsBody,
    variables: input.copy.whatsappVariables,
  })

  if (result.status === "accepted") {
    await finishDelivery(input.supabase, {
      deliveryId,
      status: "sent",
      providerMessageSid: result.providerMessageSid,
      providerStatus: result.providerStatus,
      providerErrorCode: null,
      failureReason: null,
    })
    return { status: "accepted" }
  }

  if (result.status === "skipped") {
    await finishDelivery(input.supabase, {
      deliveryId,
      status: "permanent_failure",
      providerMessageSid: null,
      providerStatus: null,
      providerErrorCode: null,
      failureReason: result.reason,
    })
    return { status: "continue", failed: false }
  }

  if (result.status === "ambiguous") {
    await finishDelivery(input.supabase, {
      deliveryId,
      status: "permanent_failure",
      providerMessageSid: null,
      providerStatus: null,
      providerErrorCode: null,
      failureReason: result.reason,
    })
    return { status: "failed" }
  }

  const retryable = [
    "rate_limited",
    "provider_unavailable",
    "circuit_open",
  ].includes(result.reason)
  await finishDelivery(input.supabase, {
    deliveryId,
    status: retryable ? "retryable_failure" : "permanent_failure",
    providerMessageSid: null,
    providerStatus: null,
    providerErrorCode: result.errorCode,
    failureReason: result.reason,
  })
  if (result.fallbackAllowed) return { status: "continue", failed: true }
  if (retryable) {
    return { status: "defer", dueAt: new Date(Date.now() + 60 * 60_000) }
  }
  return { status: "push", failed: true }
}

async function admitBudget(input: PhoneDeliveryInput) {
  if (!input.event.merchant_id) return false
  const { data, error } = await input.supabase.rpc(
    "admit_customer_message_dispatch",
    {
      p_merchant_id: input.event.merchant_id,
      p_category: input.category,
    }
  )
  if (error) {
    throw new Error(
      `Unable to admit customer message dispatch: ${error.message}`
    )
  }
  return data === true
}

async function beginDelivery(input: PhoneDeliveryInput) {
  const attemptNumber = await nextPhoneAttemptNumber(input)
  const { data, error } = await input.supabase.rpc(
    "begin_notification_message_delivery",
    {
      p_notification_event_id: input.event.id,
      p_customer_id: input.event.customer_id,
      p_channel: input.channel,
      p_attempt_number: attemptNumber,
      p_recipient_last4: input.recipient.last4,
    }
  )
  if (error?.code === "NBM01") return null
  if (error) {
    throw new Error(
      `Unable to begin customer message delivery: ${error.message}`
    )
  }
  if (typeof data !== "string") {
    throw new Error("Customer message delivery did not return an identifier.")
  }
  return data
}

async function nextPhoneAttemptNumber(input: PhoneDeliveryInput) {
  const { data, error } = await input.supabase
    .from("notification_deliveries")
    .select("attempt_number")
    .eq("notification_event_id", input.event.id)
    .eq("channel", input.channel)
    .order("attempt_number", { ascending: false })
    .limit(1)
  if (error) {
    throw new Error(`Unable to load phone delivery attempts: ${error.message}`)
  }
  const latest = Array.isArray(data) ? data[0]?.attempt_number : null
  return typeof latest === "number" && Number.isSafeInteger(latest)
    ? latest + 1
    : 1
}

async function recordDryRun(input: PhoneDeliveryInput) {
  const { error } = await input.supabase.rpc("record_notification_delivery", {
    p_notification_event_id: input.event.id,
    p_push_subscription_id: null,
    p_customer_id: input.event.customer_id,
    p_status: "skipped",
    p_attempt_number: 1,
    p_response_status: null,
    p_failure_reason: "channel_disabled",
    p_metadata: { planned_channel: input.channel },
    p_channel: input.channel,
    p_recipient_last4: input.recipient.last4,
  })
  if (error) {
    throw new Error(`Unable to record messaging dry run: ${error.message}`)
  }
}

async function finishDelivery(
  supabase: ServiceClient,
  input: {
    readonly deliveryId: string
    readonly status: "sent" | "retryable_failure" | "permanent_failure"
    readonly providerMessageSid: string | null
    readonly providerStatus: string | null
    readonly providerErrorCode: string | null
    readonly failureReason: string | null
  }
) {
  const { data, error } = await supabase.rpc(
    "finish_notification_message_delivery",
    {
      p_delivery_id: input.deliveryId,
      p_status: input.status,
      p_provider_message_sid: input.providerMessageSid,
      p_provider_status: input.providerStatus,
      p_provider_error_code: input.providerErrorCode,
      p_response_status: null,
      p_failure_reason: input.failureReason,
    }
  )
  if (error || data !== true) {
    throw new Error(
      `Unable to finish customer message delivery: ${error?.message ?? "delivery was no longer pending"}`
    )
  }
}

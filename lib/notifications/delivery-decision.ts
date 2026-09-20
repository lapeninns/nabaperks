import "server-only"

import {
  resolveDeliveryDecision,
  type CustomerMessagingMode,
  type DeliveryDecision,
} from "@/lib/notifications/channel-plan-core"
import type {
  NotificationCategory,
  NotificationEventType,
} from "@/lib/notifications/catalog"
import {
  resolveCustomerPhoneRecipient,
  type CustomerPhoneRecipient,
} from "@/lib/notifications/customer-messaging-address"
import { hasPushMarketingConsent } from "@/lib/notifications/push-marketing-eligibility"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

type ServiceClient = ReturnType<typeof createSupabaseServiceRoleClient>

export type MessagingPreferenceState = {
  readonly transactionalEnabled: boolean
  readonly reminderEnabled: boolean
  readonly marketingEnabled: boolean
  readonly phoneMessagesEnabled: boolean
  readonly preferredPhoneChannel: "whatsapp" | "sms"
  readonly whatsappUnavailableAt: string | null
}

export type DeliveryDecisionResult = DeliveryDecision & {
  readonly recipient: CustomerPhoneRecipient | null
}

export async function resolveNotificationDeliveryDecision(input: {
  readonly supabase: ServiceClient
  readonly eventType: NotificationEventType
  readonly category: NotificationCategory
  readonly customerId: string
  readonly merchantId: string | null
  readonly metadata: Readonly<Record<string, unknown>>
  readonly preferences: MessagingPreferenceState
  readonly pushAvailable: boolean
}): Promise<DeliveryDecisionResult> {
  const messagingMode = customerMessagingMode()
  const merchantMessagingEnabled = await merchantAllowsCustomerMessaging(
    input.supabase,
    input.merchantId
  )
  const recipient =
    messagingMode === "off" || !merchantMessagingEnabled
      ? null
      : await resolveCustomerPhoneRecipient(input.customerId)
  const [phoneMarketingConsent, pushMarketingConsent] = await Promise.all([
    resolvePhoneMarketingConsent(input),
    resolvePushMarketingConsent(input),
  ])

  return {
    ...resolveDeliveryDecision({
      eventType: input.eventType,
      category: input.category,
      messagingMode,
      merchantMessagingEnabled,
      phoneMessagesEnabled: input.preferences.phoneMessagesEnabled,
      phoneCategoryEnabled: phoneCategoryEnabled(
        input.category,
        input.preferences
      ),
      preferredPhoneChannel: input.preferences.preferredPhoneChannel,
      whatsappUnavailable: whatsappUnavailableRecently(
        input.preferences.whatsappUnavailableAt
      ),
      phoneRecipientAvailable: Boolean(recipient),
      pushAvailable: input.pushAvailable,
      pushCategoryEnabled: categoryPreferenceEnabled(
        input.category,
        input.preferences
      ),
      pushMarketingConsent,
      phoneMarketingConsent,
      fallbackFrom:
        input.metadata.fallback_from === "whatsapp" ? "whatsapp" : null,
    }),
    recipient,
  }
}

export function customerMessagingMode(): CustomerMessagingMode {
  const configured = process.env.CUSTOMER_MESSAGING_MODE?.trim()
  return configured === "dry_run" || configured === "live" ? configured : "off"
}

function categoryPreferenceEnabled(
  category: NotificationCategory,
  preferences: MessagingPreferenceState
) {
  if (category === "transactional") return preferences.transactionalEnabled
  if (category === "reminder") return preferences.reminderEnabled
  if (category === "marketing") return preferences.marketingEnabled
  return true
}

function phoneCategoryEnabled(
  category: NotificationCategory,
  preferences: MessagingPreferenceState
) {
  if (category === "transactional") return preferences.transactionalEnabled
  if (category === "reminder") return preferences.reminderEnabled
  return true
}

async function merchantAllowsCustomerMessaging(
  supabase: ServiceClient,
  merchantId: string | null
) {
  if (!merchantId) return false
  const { data, error } = await supabase
    .from("merchants")
    .select("customer_messaging_enabled")
    .eq("id", merchantId)
    .maybeSingle()
  if (error) {
    throw new Error(`Unable to load merchant messaging state: ${error.message}`)
  }
  return data?.customer_messaging_enabled === true
}

async function resolvePhoneMarketingConsent(input: {
  readonly supabase: ServiceClient
  readonly category: NotificationCategory
  readonly customerId: string
  readonly merchantId: string | null
}) {
  if (input.category !== "marketing" || !input.merchantId) {
    return { whatsapp: false, sms: false }
  }
  const { data, error } = await input.supabase.rpc(
    "customer_phone_marketing_consent",
    {
      p_customer_id: input.customerId,
      p_merchant_id: input.merchantId,
    }
  )
  if (error) {
    throw new Error(`Unable to load phone marketing consent: ${error.message}`)
  }
  const rows = Array.isArray(data) ? data : []
  return {
    whatsapp: rows.some(
      (row) => row.channel === "whatsapp" && row.opted_in === true
    ),
    sms: rows.some((row) => row.channel === "sms" && row.opted_in === true),
  }
}

async function resolvePushMarketingConsent(input: {
  readonly supabase: ServiceClient
  readonly category: NotificationCategory
  readonly customerId: string
  readonly merchantId: string | null
}) {
  if (input.category !== "marketing" || !input.merchantId) return false
  return hasPushMarketingConsent(input.supabase, {
    customerId: input.customerId,
    merchantId: input.merchantId,
  })
}

function whatsappUnavailableRecently(value: string | null) {
  if (!value) return false
  const unavailableAt = Date.parse(value)
  return (
    Number.isFinite(unavailableAt) &&
    Date.now() - unavailableAt < 24 * 60 * 60_000
  )
}

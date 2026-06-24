import "server-only"

import { enqueueNotificationEvent } from "@/lib/notifications/events"
import { MARKETING_POLICY_VERSION } from "@/lib/customer/consent"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type PushPermissionState =
  | "prompt"
  | "granted"
  | "denied"
  | "unsupported"
  | "unknown"

export type WebPushSubscriptionInput = {
  endpoint: string
  p256dh: string
  auth: string
}

export type NotificationPreferenceState = {
  transactionalEnabled: boolean
  reminderEnabled: boolean
  marketingEnabled: boolean
  quietHoursStart: string | null
  quietHoursEnd: string | null
  activeSubscriptionCount: number
}

type ValidSubscriptionResult =
  | { ok: true; subscription: WebPushSubscriptionInput }
  | { ok: false; error: "invalid_subscription" }

const permissionStates = new Set<PushPermissionState>([
  "prompt",
  "granted",
  "denied",
  "unsupported",
  "unknown",
])

const allowedPushEndpointHosts = new Set([
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
])

export function getWebPushPublicKey() {
  const key = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim()
  return key || null
}

export function getWebPushServerConfig() {
  const publicKey = getWebPushPublicKey()
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim() || null
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT?.trim() || null

  if (!publicKey || !privateKey || !subject) return null
  return { publicKey, privateKey, subject }
}

export function normalizePermissionState(value: unknown): PushPermissionState {
  if (typeof value !== "string") return "unknown"

  const normalized = value.trim().toLowerCase()
  return permissionStates.has(normalized as PushPermissionState)
    ? (normalized as PushPermissionState)
    : "unknown"
}

export function validatePushSubscriptionInput(
  value: unknown
): ValidSubscriptionResult {
  if (!isRecord(value) || !isRecord(value.keys)) {
    return { ok: false, error: "invalid_subscription" }
  }

  const endpoint = stringValue(value.endpoint).trim()
  const p256dh = stringValue(value.keys.p256dh).trim()
  const auth = stringValue(value.keys.auth).trim()

  if (!isValidEndpoint(endpoint) || p256dh.length < 20 || auth.length < 8) {
    return { ok: false, error: "invalid_subscription" }
  }

  return { ok: true, subscription: { endpoint, p256dh, auth } }
}

export function validatePushEndpoint(value: unknown) {
  const endpoint = stringValue(value).trim()
  return isValidEndpoint(endpoint) ? endpoint : null
}

export async function registerCustomerPushSubscription({
  customerId,
  subscription,
  userAgent,
  permissionState,
}: {
  customerId: string
  subscription: WebPushSubscriptionInput
  userAgent: string | null
  permissionState: PushPermissionState
}) {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc(
    "register_push_subscription_for_customer",
    {
      p_customer_id: customerId,
      p_endpoint: subscription.endpoint,
      p_p256dh: subscription.p256dh,
      p_auth: subscription.auth,
      p_user_agent: userAgent,
      p_permission_state: permissionState,
    }
  )

  if (error) {
    await enqueueSubscriptionEvent("push_subscription_failed", customerId, {
      reason: "register_rpc_failed",
      permission_state: permissionState,
    })
    throw new Error(`Unable to register push subscription: ${error.message}`)
  }

  if (permissionState === "granted") {
    await enqueueSubscriptionEvent("push_permission_granted", customerId, {
      permission_state: permissionState,
    })
  }

  await enqueueSubscriptionEvent("push_subscription_created", customerId, {
    permission_state: permissionState,
  })

  return typeof data === "string" ? data : String(data)
}

export async function disableCustomerPushSubscription({
  customerId,
  endpoint,
  reason = "customer_disabled",
}: {
  customerId: string
  endpoint: string
  reason?: string
}) {
  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase.rpc(
    "disable_push_subscription_for_customer",
    {
      p_customer_id: customerId,
      p_endpoint: endpoint,
      p_reason: reason,
    }
  )

  if (error) {
    throw new Error(`Unable to disable push subscription: ${error.message}`)
  }

  await enqueueSubscriptionEvent("push_subscription_disabled", customerId, {
    reason,
  })
}

export async function getCustomerNotificationPreferences(
  customerId: string
): Promise<NotificationPreferenceState> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc(
    "get_notification_preferences_for_customer",
    {
      p_customer_id: customerId,
    }
  )

  if (error) {
    throw new Error(`Unable to load notification preferences: ${error.message}`)
  }

  return preferenceState(firstRecord(data))
}

export async function updateCustomerNotificationPreferences({
  customerId,
  transactionalEnabled,
  reminderEnabled,
  marketingEnabled,
}: {
  customerId: string
  transactionalEnabled: boolean
  reminderEnabled: boolean
  marketingEnabled: boolean
}) {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc(
    "update_notification_preferences_for_customer",
    {
      p_customer_id: customerId,
      p_transactional_enabled: transactionalEnabled,
      p_reminder_enabled: reminderEnabled,
      p_marketing_enabled: marketingEnabled,
    }
  )

  if (error) {
    throw new Error(
      `Unable to update notification preferences: ${error.message}`
    )
  }

  await recordPushMarketingConsent({
    customerId,
    optedIn: marketingEnabled,
  })

  return preferenceState(firstRecord(data))
}

async function recordPushMarketingConsent({
  customerId,
  optedIn,
}: {
  customerId: string
  optedIn: boolean
}) {
  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase.rpc("record_customer_marketing_consent", {
    p_customer_id: customerId,
    p_channel: "push",
    p_consent_status: optedIn ? "opted_in" : "opted_out",
    p_policy_version: MARKETING_POLICY_VERSION,
  })

  if (error) {
    throw new Error(`Unable to update push marketing consent: ${error.message}`)
  }
}

export async function recordPushPermissionPromptViewed(customerId: string) {
  await enqueueSubscriptionEvent("push_permission_prompt_viewed", customerId, {
    source: "push_settings_card",
  })
}

async function enqueueSubscriptionEvent(
  eventType:
    | "push_permission_prompt_viewed"
    | "push_permission_granted"
    | "push_subscription_created"
    | "push_subscription_disabled"
    | "push_subscription_failed",
  customerId: string,
  metadata: Record<string, unknown>
) {
  try {
    await enqueueNotificationEvent({
      eventType,
      customerId,
      dedupeKey: `${eventType}:${customerId}:${new Date().toISOString()}`,
      metadata: {
        source: "push_subscription_route",
        ...metadata,
      },
    })
  } catch {
    return
  }
}

function preferenceState(
  row: Record<string, unknown> | null
): NotificationPreferenceState {
  return {
    transactionalEnabled: booleanValue(row?.transactional_enabled, true),
    reminderEnabled: booleanValue(row?.reminder_enabled, true),
    marketingEnabled: booleanValue(row?.marketing_enabled, false),
    quietHoursStart: nullableString(row?.quiet_hours_start),
    quietHoursEnd: nullableString(row?.quiet_hours_end),
    activeSubscriptionCount: numberValue(row?.active_subscription_count),
  }
}

export function isAllowedWebPushEndpoint(value: string) {
  try {
    const url = new URL(value)
    return (
      url.protocol === "https:" &&
      value.length >= 20 &&
      value.length <= 2048 &&
      !url.username &&
      !url.password &&
      !url.hash &&
      isAllowedPushEndpointHost(url.hostname)
    )
  } catch {
    return false
  }
}

function isValidEndpoint(value: string) {
  return isAllowedWebPushEndpoint(value)
}

function isAllowedPushEndpointHost(hostname: string) {
  const host = hostname.toLowerCase()
  return (
    allowedPushEndpointHosts.has(host) || host.endsWith(".notify.windows.com")
  )
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

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

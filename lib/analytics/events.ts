import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export const productEventNames = [
  "qr_scanned",
  "join_page_viewed",
  "join_phone_requested",
  "join_otp_verified",
  "join_terms_accepted",
  "customer_joined",
  "customer_card_viewed",
  "stamp_claim_started",
  "stamp_issued",
  "reward_unlocked",
  "reward_redeemed",
  "reward_issued",
  "reward_sent",
  "reward_invite_sent",
  "birthday_reward_enabled",
  "birthday_reward_disabled",
  "merchant_signed_up",
  "loyalty_card_created",
  "qr_created",
  "qr_downloaded",
  "qr_enabled",
  "qr_disabled",
  "reward_pool_item_created",
  "reward_pool_item_updated",
  "reward_pool_item_saved",
  "reward_pool_item_activated",
  "reward_pool_item_deactivated",
  "reward_pool_item_deleted",
  "reward_pool_item_archived",
  "subscription_started",
  "subscription_cancelled",
  "push_notification_enqueued",
  "push_notification_delivered",
  "push_notification_skipped",
  "push_notification_failed",
  "push_subscription_created",
  "push_subscription_disabled",
  "push_subscription_failed",
  "push_delivery_worker_ran",
  "push_venue_announcement_queued",
  "merchant_weekly_digest_sent",
  "dashboard_viewed",
  "loyalty_card_updated",
  "merchant_profile_updated",
] as const

export type ProductEventName = (typeof productEventNames)[number]

export type ProductEventInput = {
  eventName: ProductEventName
  merchantId?: string | null
  customerId?: string | null
  membershipId?: string | null
  qrCodeId?: string | null
  actorType: "merchant" | "customer" | "staff" | "admin" | "system"
  actorId?: string | null
  metadata?: Record<string, unknown>
}

export async function recordProductEvent(input: ProductEventInput) {
  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase.from("product_events").insert({
    event_name: input.eventName,
    merchant_id: input.merchantId ?? null,
    customer_id: input.customerId ?? null,
    membership_id: input.membershipId ?? null,
    qr_code_id: input.qrCodeId ?? null,
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    metadata: sanitizeMetadata(input.metadata ?? {}),
  })

  if (error) {
    throw new Error(`Unable to record product event: ${error.message}`)
  }

  void capturePostHogEvent(input)
}

export async function capturePostHogEvent(input: ProductEventInput) {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim()
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim()

  if (!apiKey || !host) return

  try {
    await fetch(`${host.replace(/\/$/, "")}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        event: input.eventName,
        distinct_id:
          input.actorId ??
          input.merchantId ??
          input.customerId ??
          input.membershipId ??
          "system",
        properties: {
          merchant_id: input.merchantId,
          customer_id: input.customerId,
          membership_id: input.membershipId,
          qr_code_id: input.qrCodeId,
          actor_type: input.actorType,
          ...sanitizeMetadata(input.metadata ?? {}),
        },
      }),
    })
  } catch {
    // PostHog is best-effort; Supabase product_events remain the source of truth.
  }
}

export function sanitizeMetadata(metadata: Record<string, unknown>) {
  const blocked = new Set([
    "auth",
    "email",
    "endpoint",
    "latitude",
    "longitude",
    "phone",
    "p256dh",
    "pin",
    "raw_coordinates",
    "secret",
    "token",
  ])
  return Object.fromEntries(
    Object.entries(metadata).filter(([key]) => !blocked.has(key.toLowerCase()))
  )
}

import "server-only"

import {
  buildPostHogCapturePayload,
  resolvePostHogConfig,
} from "@/lib/analytics/privacy-core"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export const productEventNames = [
  "qr_scanned",
  "join_page_viewed",
  "join_phone_requested",
  "join_otp_verified",
  "join_terms_accepted",
  "join_first_stamp_issued",
  "join_first_stamp_pending",
  "customer_joined",
  "customer_card_viewed",
  "stamp_claim_started",
  "stamp_issued",
  "reward_unlocked",
  "reward_redeemed",
  "reward_issued",
  "reward_sent",
  "reward_invite_sent",
  "referral_link_shared",
  "referral_bonus_awarded",
  "birthday_reward_enabled",
  "birthday_reward_disabled",
  "merchant_marketing_viewed",
  "merchant_signup_clicked",
  "merchant_signup_started",
  "merchant_account_created",
  "merchant_otp_verification_viewed",
  "merchant_otp_resent",
  "merchant_email_verified",
  "merchant_signed_up",
  "merchant_launch_entered",
  "merchant_billing_reached",
  "merchant_billing_checkout_started",
  "merchant_billing_checkout_returned",
  "merchant_billing_activated",
  "loyalty_card_created",
  // Written by SQL, not by recordProductEvent: the stamping wrapper records
  // these directly (20260805100300) so a referral degradation or a visit that
  // could not be stamped leaves a durable, queryable row instead of a server-log
  // warning. Registered here so the product's event vocabulary stays in one list.
  "referral_settlement_failed",
  "referral_bonus_failed",
  "visit_without_stamp",
  "stamp_refused_location",
  "qr_created",
  "qr_downloaded",
  "qr_enabled",
  "qr_disabled",
  "qr_poster_emailed",
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
  "offer_campaign_published",
  "offer_campaign_paused",
  "offer_campaign_resumed",
  "offer_campaign_ended",
  "offer_campaign_token_rotated",
  "offer_campaign_claimed",
  "offer_pass_redeemed",
] as const

export type ProductEventName = (typeof productEventNames)[number]

export type ProductEventInput = {
  awaitExternalMirror?: boolean
  eventId?: string | null
  eventName: ProductEventName
  merchantId?: string | null
  customerId?: string | null
  membershipId?: string | null
  qrCodeId?: string | null
  actorType: "merchant" | "customer" | "staff" | "admin" | "system"
  actorId?: string | null
  analyticsIdentity?: {
    domain:
      | "actor"
      | "customer"
      | "funnel"
      | "merchant"
      | "membership"
      | "qr"
      | "system"
    value: string
  }
  metadata?: Record<string, unknown>
}

export async function recordProductEvent(input: ProductEventInput) {
  const supabase = createSupabaseServiceRoleClient()
  const row = {
    ...(input.eventId ? { id: input.eventId } : {}),
    event_name: input.eventName,
    merchant_id: input.merchantId ?? null,
    customer_id: input.customerId ?? null,
    membership_id: input.membershipId ?? null,
    qr_code_id: input.qrCodeId ?? null,
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    metadata: sanitizeMetadata(input.metadata ?? {}),
  }
  const { error } = input.eventId
    ? await supabase
        .from("product_events")
        .upsert(row, { onConflict: "id", ignoreDuplicates: true })
    : await supabase.from("product_events").insert(row)

  if (error) {
    throw new Error(`Unable to record product event: ${error.message}`)
  }

  if (input.awaitExternalMirror) {
    await capturePostHogEvent(input)
  } else {
    void capturePostHogEvent(input)
  }
}

export async function capturePostHogEvent(input: ProductEventInput) {
  if (process.env.ANALYTICS_EXTERNAL_PROCESSING_MODE !== "pseudonymous") return

  const config = resolvePostHogConfig({
    ANALYTICS_EXTERNAL_PROCESSING_MODE:
      process.env.ANALYTICS_EXTERNAL_PROCESSING_MODE,
    ANALYTICS_PSEUDONYM_SECRET: process.env.ANALYTICS_PSEUDONYM_SECRET,
    POSTHOG_HOST: process.env.POSTHOG_HOST,
    POSTHOG_PROJECT_KEY: process.env.POSTHOG_PROJECT_KEY,
  })
  if (!config) return

  const identity = analyticsIdentity(input)
  const externalMetadata = Object.fromEntries(
    Object.entries(input.metadata ?? {}).filter(([key]) => key !== "funnel_key")
  )
  const payload = buildPostHogCapturePayload(
    {
      eventName: input.eventName,
      identityDomain: identity.domain,
      identityValue: identity.value,
      eventId: input.eventId,
      properties: { actor_type: input.actorType, ...externalMetadata },
    },
    config
  )
  if (!payload) return

  try {
    await fetch(`${config.host.replace(/\/$/, "")}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(2_000),
      body: JSON.stringify(payload),
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

function analyticsIdentity(input: ProductEventInput) {
  if (input.analyticsIdentity) return input.analyticsIdentity
  if (input.merchantId)
    return { domain: "merchant" as const, value: input.merchantId }
  if (input.customerId)
    return { domain: "customer" as const, value: input.customerId }
  if (input.membershipId) {
    return { domain: "membership" as const, value: input.membershipId }
  }
  if (input.actorId) return { domain: "actor" as const, value: input.actorId }
  if (input.qrCodeId) return { domain: "qr" as const, value: input.qrCodeId }
  return { domain: "system" as const, value: input.eventName }
}

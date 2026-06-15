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
  "merchant_signed_up",
  "loyalty_card_created",
  "qr_created",
  "qr_downloaded",
  "qr_enabled",
  "qr_disabled",
  "subscription_started",
  "subscription_cancelled",
] as const

export type ProductEventName = (typeof productEventNames)[number] | string

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
    metadata: input.metadata ?? {},
  })

  if (error) {
    throw new Error(`Unable to record product event: ${error.message}`)
  }

  await capturePostHogEvent(input)
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

function sanitizeMetadata(metadata: Record<string, unknown>) {
  const blocked = new Set(["email", "phone", "pin", "token", "secret"])
  return Object.fromEntries(
    Object.entries(metadata).filter(([key]) => !blocked.has(key.toLowerCase()))
  )
}

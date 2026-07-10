import "server-only"

import { after } from "next/server"

import { capturePostHogEvent } from "@/lib/analytics/events"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export const merchantActivationEventNames = [
  "merchant_launch_entered",
  "qr_poster_emailed",
  "merchant_billing_reached",
  "merchant_billing_checkout_started",
  "merchant_billing_checkout_returned",
  "merchant_billing_activated",
] as const

export type MerchantActivationEventName =
  (typeof merchantActivationEventNames)[number]

export type MerchantActivationEventSource =
  | "merchant_launch"
  | "merchant_qr_action"
  | "merchant_billing"
  | "stripe_checkout"
  | "stripe_webhook"

type MerchantActivationEventInput = {
  merchantId: string
  eventName: MerchantActivationEventName
  idempotencyKey: string
  occurredAt?: string
  source: MerchantActivationEventSource
}

/**
 * Schedule a first-party activation milestone after the response. The product
 * operation is always authoritative: neither Supabase analytics persistence
 * nor the optional PostHog mirror can delay or fail the merchant journey.
 */
export function scheduleMerchantActivationEvent(
  input: MerchantActivationEventInput
): void {
  const occurredAt = input.occurredAt ?? new Date().toISOString()

  try {
    after(async () => {
      try {
        const supabase = createSupabaseServiceRoleClient()
        const { data: eventId, error } = await supabase.rpc(
          "record_merchant_activation_event",
          {
            p_merchant_id: input.merchantId,
            p_event_name: input.eventName,
            p_idempotency_key: input.idempotencyKey,
            p_occurred_at: occurredAt,
            p_metadata: { source: input.source },
          }
        )

        if (error) {
          throw new Error(error.message)
        }
        if (typeof eventId !== "string") {
          throw new Error("Activation recorder returned an invalid event id")
        }

        await capturePostHogEvent({
          eventId,
          eventName: input.eventName,
          merchantId: input.merchantId,
          actorType: "merchant",
          actorId: input.merchantId,
          // Detailed provenance remains first-party. The optional external
          // mirror uses one closed, privacy-reviewed activation category.
          metadata: { source: "merchant_activation" },
        })
      } catch (error) {
        console.error("Merchant activation analytics recording failed", {
          event: input.eventName,
          error: error instanceof Error ? error.message : "unknown error",
        })
      }
    })
  } catch (error) {
    console.error("Merchant activation analytics scheduling failed", {
      event: input.eventName,
      error: error instanceof Error ? error.message : "unknown error",
    })
  }
}

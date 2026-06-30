import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type StripeWebhookEventRecord = {
  id: string
  type: string
  livemode: boolean
  created: number
}

export type StripeWebhookClaimResult =
  | { status: "claimed" }
  | { status: "duplicate" }

type StripeWebhookStoredEvent = {
  processed_at: string | null
  failed_at: string | null
}

export function shouldRetryStripeWebhookEvent(
  event: StripeWebhookStoredEvent | null
): boolean {
  return event !== null && event.processed_at === null && event.failed_at !== null
}

export async function claimStripeWebhookEvent(
  event: StripeWebhookEventRecord
): Promise<StripeWebhookClaimResult> {
  const supabase = createSupabaseServiceRoleClient()
  const stripeCreatedAt = new Date(event.created * 1000).toISOString()
  const { error } = await supabase.from("stripe_webhook_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    livemode: event.livemode,
    stripe_created_at: stripeCreatedAt,
  })

  if (!error) return { status: "claimed" }
  if (error.code === "23505") {
    const { data: existing, error: loadError } = await supabase
      .from("stripe_webhook_events")
      .select("processed_at, failed_at")
      .eq("stripe_event_id", event.id)
      .maybeSingle()

    if (loadError) {
      throw new Error(`Unable to load Stripe webhook claim: ${loadError.message}`)
    }

    if (shouldRetryStripeWebhookEvent(existing)) {
      const { data: retried, error: retryError } = await supabase
        .from("stripe_webhook_events")
        .update({
          failed_at: null,
          last_error: null,
        })
        .eq("stripe_event_id", event.id)
        .is("processed_at", null)
        .not("failed_at", "is", null)
        .select("stripe_event_id")
        .maybeSingle()

      if (retryError) {
        throw new Error(
          `Unable to retry Stripe webhook claim: ${retryError.message}`
        )
      }

      if (retried) return { status: "claimed" }
    }

    return { status: "duplicate" }
  }

  throw new Error(`Unable to claim Stripe webhook: ${error.message}`)
}

export async function markStripeWebhookEventProcessed(
  eventId: string
): Promise<void> {
  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase
    .from("stripe_webhook_events")
    .update({
      processed_at: new Date().toISOString(),
      failed_at: null,
      last_error: null,
    })
    .eq("stripe_event_id", eventId)

  if (error) {
    throw new Error(`Unable to mark Stripe webhook processed: ${error.message}`)
  }
}

export async function markStripeWebhookEventFailed(
  eventId: string,
  errorMessage: string
): Promise<void> {
  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase
    .from("stripe_webhook_events")
    .update({
      failed_at: new Date().toISOString(),
      last_error: errorMessage,
    })
    .eq("stripe_event_id", eventId)

  if (error) {
    throw new Error(`Unable to mark Stripe webhook failed: ${error.message}`)
  }
}

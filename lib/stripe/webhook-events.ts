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
  if (error.code === "23505") return { status: "duplicate" }

  throw new Error(`Unable to claim Stripe webhook: ${error.message}`)
}

export async function markStripeWebhookEventProcessed(
  eventId: string
): Promise<void> {
  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase
    .from("stripe_webhook_events")
    .update({ processed_at: new Date().toISOString(), last_error: null })
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

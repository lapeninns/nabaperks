import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * Replay consumption for the Supabase auth hooks.
 *
 * A signed envelope is authentic, but authenticity is not consumption: the
 * Standard-Webhooks check is a ±300s freshness window, so a captured envelope
 * can be replayed inside it to drive another SMS or another email.
 *
 * Only the request that inserts the claim may call a provider. Replays,
 * concurrent requests, unusable claims, and database errors all fail closed.
 */

export type AuthHookChannel = "email" | "sms"

export type AuthHookClaim = "claimed" | "replay" | "unavailable"

/**
 * Returns "claimed" only when this request uniquely inserted the claim.
 * Every other outcome lacks provider authority.
 */
export async function claimAuthHookDelivery(
  channel: AuthHookChannel,
  webhookId: string
): Promise<AuthHookClaim> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("claim_auth_hook_delivery", {
    p_channel: channel,
    p_webhook_id: webhookId,
  })

  if (error) return "unavailable"
  return data === "replay" || data === "claimed" ? data : "unavailable"
}

/** Record a provider acceptance so a later replay is recognised. */
export async function completeAuthHookDelivery(
  channel: AuthHookChannel,
  webhookId: string
): Promise<void> {
  const supabase = createSupabaseServiceRoleClient()
  await supabase.rpc("complete_auth_hook_delivery", {
    p_channel: channel,
    p_webhook_id: webhookId,
  })
}

/** Record a delivery failure so a genuine retry may send again. */
export async function failAuthHookDelivery(
  channel: AuthHookChannel,
  webhookId: string
): Promise<void> {
  const supabase = createSupabaseServiceRoleClient()
  await supabase.rpc("fail_auth_hook_delivery", {
    p_channel: channel,
    p_webhook_id: webhookId,
  })
}

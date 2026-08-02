import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * Replay consumption for the Supabase auth hooks.
 *
 * A signed envelope is authentic, but authenticity is not consumption: the
 * Standard-Webhooks check is a ±300s freshness window, so a captured envelope
 * can be replayed inside it to drive another SMS or another email.
 *
 * These hooks are synchronous and sit inside an auth flow, where a duplicate
 * OTP is an annoyance but a MISSING OTP is a lockout. So the contract is
 * asymmetric on purpose — fail closed on replay, fail open on everything else,
 * and never surface a new HTTP status to GoTrue.
 */

export type AuthHookChannel = "email" | "sms"

export type AuthHookClaim = "claimed" | "replay" | "concurrent"

/**
 * Returns "replay" only for an already-completed delivery. Any doubt —
 * a concurrent attempt, an unusable id, or a database problem — resolves to
 * "concurrent", which means "send anyway".
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

  if (error) return "concurrent"
  return data === "replay" || data === "claimed" ? data : "concurrent"
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

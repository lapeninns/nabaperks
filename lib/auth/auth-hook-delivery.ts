import "server-only"

import {
  parseAuthHookClaim,
  type AuthHookClaim,
} from "@/lib/auth/auth-hook-delivery-core"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * Replay consumption for the Supabase auth hooks.
 *
 * A signed envelope is authentic, but authenticity is not consumption: the
 * Standard-Webhooks check is a ±300s freshness window, so a captured envelope
 * can be replayed inside it to drive another SMS or another email.
 *
 * Claims are exclusive and finite. Storage uncertainty and processing
 * collisions must not authorise a second external provider side effect.
 */

export type AuthHookChannel = "email" | "sms"

export async function claimAuthHookDelivery(
  channel: AuthHookChannel,
  webhookId: string
): Promise<AuthHookClaim> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("claim_auth_hook_delivery_v2", {
    p_channel: channel,
    p_webhook_id: webhookId,
  })

  const claim = parseAuthHookClaim(data)
  if (error || !claim) {
    throw new Error("Unable to claim auth-hook delivery.")
  }
  return claim
}

/** Record a provider acceptance so a later replay is recognised. */
export async function completeAuthHookDelivery(
  channel: AuthHookChannel,
  webhookId: string,
  leaseId: string
): Promise<void> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("complete_auth_hook_delivery_v2", {
    p_channel: channel,
    p_webhook_id: webhookId,
    p_lease_id: leaseId,
  })
  if (error || data !== true) {
    throw new Error("Unable to complete auth-hook delivery.")
  }
}

/** Fence the lease durably immediately before the provider request begins. */
export async function markAuthHookDeliveryAttempted(
  channel: AuthHookChannel,
  webhookId: string,
  leaseId: string
): Promise<void> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc(
    "mark_auth_hook_delivery_attempted_v2",
    {
      p_channel: channel,
      p_webhook_id: webhookId,
      p_lease_id: leaseId,
    }
  )
  if (error || data !== true) {
    throw new Error("Unable to fence auth-hook provider delivery.")
  }
}

/** Record a delivery failure so a genuine retry may send again. */
export async function failAuthHookDelivery(
  channel: AuthHookChannel,
  webhookId: string,
  leaseId: string
): Promise<void> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("fail_auth_hook_delivery_v2", {
    p_channel: channel,
    p_webhook_id: webhookId,
    p_lease_id: leaseId,
  })
  if (error || data !== true) {
    throw new Error("Unable to release auth-hook delivery.")
  }
}

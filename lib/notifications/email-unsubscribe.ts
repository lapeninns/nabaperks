import "server-only"

import { hashInviteToken } from "@/lib/loyalty-invites/tokens"
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

type UnsubscribeKind = "invite" | "claim"
export type UnsubscribeContext = { params: Promise<{ token: string }> }
const RESPONSE_HEADERS = {
  "cache-control": "no-store, max-age=0",
  "referrer-policy": "no-referrer",
}

/** Token possession authorises only the venue/address resolved by the RPC. */
export async function postEmailUnsubscribe(
  kind: UnsubscribeKind,
  token: string
) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return new Response(null, { status: 400, headers: RESPONSE_HEADERS })
  }
  const tokenHash = hashInviteToken(token)
  try {
    // Per-token limits avoid blocking unrelated subscribers behind a mailbox
    // provider's shared egress IP. Raw bearer tokens never enter rate-limit keys.
    await enforceRateLimit({
      key: `email-unsubscribe:${kind}:${tokenHash}`,
      limit: 20,
      windowMs: 60_000,
    })
    const supabase = createSupabaseServiceRoleClient()
    const rpc =
      kind === "invite"
        ? "suppress_loyalty_invite_email"
        : "suppress_reward_invite_email_by_token"
    const { error } = await supabase.rpc(rpc, {
      p_unsubscribe_token_hash: tokenHash,
    })
    if (error) throw new Error("Unsubscribe write failed")
    // Unknown/scrubbed tokens and repeat requests have the same empty response.
    return new Response(null, { status: 200, headers: RESPONSE_HEADERS })
  } catch (error) {
    return new Response(null, {
      status: error instanceof RateLimitError ? 429 : 503,
      headers: { ...RESPONSE_HEADERS, "retry-after": "60" },
    })
  }
}

export function getEmailUnsubscribe(
  request: Request,
  kind: UnsubscribeKind,
  token: string
) {
  const url = new URL(
    `/${kind}/unsubscribe/${encodeURIComponent(token)}`,
    request.url
  )
  return new Response(null, {
    status: 307,
    headers: { ...RESPONSE_HEADERS, location: url.href },
  })
}

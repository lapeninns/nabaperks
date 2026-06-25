import "server-only"

import { createHash } from "node:crypto"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export class RateLimitError extends Error {
  constructor(message = "Too many attempts. Try again shortly.") {
    super(message)
    this.name = "RateLimitError"
  }
}

export async function enforceRateLimit({
  key,
  limit,
  windowMs,
}: {
  key: string
  limit: number
  windowMs: number
}) {
  const bucketKey = createHash("sha256").update(key).digest("hex")
  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase.rpc("enforce_rate_limit", {
    p_bucket_key: bucketKey,
    p_limit: limit,
    p_window_ms: windowMs,
  })

  if (!error) return

  if (/rate limit exceeded/i.test(error.message)) {
    throw new RateLimitError()
  }

  throw new Error(`Unable to enforce rate limit: ${error.message}`)
}

export function rateLimitIdentityFromHeaders(headers: Headers): string {
  const ip = trustedClientIp(headers)
  const userAgent = headers.get("user-agent")?.trim().slice(0, 160) || "unknown"

  return createHash("sha256")
    .update(`${ip}:${userAgent}`)
    .digest("hex")
    .slice(0, 32)
}

// Resolve the IP the rate-limit bucket is keyed on from sources a client cannot
// forge. A client can set `x-forwarded-for` / `x-real-ip` to anything, so keying
// on the left-most forwarded entry lets an attacker rotate the header to mint a
// fresh bucket per request (evading the per-IP limit) or pin it to a victim's IP
// (poisoning their bucket). We trust only:
//   1. `x-vercel-forwarded-for` — the connecting IP Vercel resolves at the edge
//      and overwrites on every inbound request, so it cannot be spoofed.
//   2. the right-most `x-forwarded-for` hop — the address the nearest trusted
//      proxy actually observed (a client can only prepend on the left) — as a
//      fallback for non-Vercel single-proxy deployments and local development.
// The left-most `x-forwarded-for` and raw `x-real-ip` values are never trusted.
function trustedClientIp(headers: Headers): string {
  const verifiedIp = forwardedSegments(headers.get("x-vercel-forwarded-for"))[0]
  if (verifiedIp) return verifiedIp

  const observedHops = forwardedSegments(headers.get("x-forwarded-for"))
  const nearestHop = observedHops[observedHops.length - 1]
  if (nearestHop) return nearestHop

  return "unknown"
}

function forwardedSegments(value: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean)
}

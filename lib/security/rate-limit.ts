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
  const forwardedFor = firstHeaderValue(headers.get("x-forwarded-for"))
  const realIp = firstHeaderValue(headers.get("x-real-ip"))
  const vercelIp = firstHeaderValue(headers.get("x-vercel-forwarded-for"))
  const userAgent = headers.get("user-agent")?.trim().slice(0, 160) || "unknown"
  const ip = forwardedFor || vercelIp || realIp || "unknown"

  return createHash("sha256")
    .update(`${ip}:${userAgent}`)
    .digest("hex")
    .slice(0, 32)
}

function firstHeaderValue(value: string | null): string | null {
  const first = value?.split(",")[0]?.trim()
  return first || null
}

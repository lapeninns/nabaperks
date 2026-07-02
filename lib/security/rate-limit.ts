import "server-only"

import { createHash } from "node:crypto"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export {
  rateLimitIdentityFromHeaders,
  trustedClientIp,
} from "@/lib/security/rate-limit-core"

export class RateLimitError extends Error {
  constructor(message = "Too many attempts. Try again shortly.") {
    super(message)
    this.name = "RateLimitError"
  }
}

function rateLimitBucketKey(key: string) {
  return createHash("sha256").update(key).digest("hex")
}

export async function peekRateLimit({
  key,
  limit,
  windowMs,
}: {
  key: string
  limit: number
  windowMs: number
}) {
  const bucketKey = rateLimitBucketKey(key)
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("rate_limit_buckets")
    .select("count, reset_at")
    .eq("bucket_key", bucketKey)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to read rate limit bucket: ${error.message}`)
  }

  const now = Date.now()
  const used =
    data && new Date(data.reset_at).getTime() > now
      ? Math.min(Math.max(data.count, 0), limit)
      : 0

  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    windowMs,
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
  const bucketKey = rateLimitBucketKey(key)
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

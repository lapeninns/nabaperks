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

import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

/** How far the webhook-timestamp may drift from now before we reject (replay guard). */
const TOLERANCE_SECONDS = 5 * 60

/**
 * Verify a Supabase Auth hook request using the Standard Webhooks scheme
 * (https://www.standardwebhooks.com). Supabase signs `${id}.${timestamp}.${body}`
 * with the base64 secret (sent as `v1,whsec_<base64>`) and HMAC-SHA256, then
 * sends the result in the space-separated `webhook-signature` header as
 * `v1,<sig>` entries.
 */
export function verifyStandardWebhook({
  secret,
  id,
  timestamp,
  body,
  signatureHeader,
  now = Date.now(),
}: {
  secret: string
  id: string
  timestamp: string
  body: string
  signatureHeader: string
  now?: number
}): boolean {
  if (!secret || !id || !timestamp || !signatureHeader) return false

  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return false
  if (Math.abs(Math.floor(now / 1000) - ts) > TOLERANCE_SECONDS) return false

  const base64Secret = secret.replace(/^v1,/, "").replace(/^whsec_/, "")
  let key: Buffer
  try {
    key = Buffer.from(base64Secret, "base64")
  } catch {
    return false
  }
  if (key.length === 0) return false

  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64")
  const expectedBuf = Buffer.from(expected)

  for (const part of signatureHeader.split(" ")) {
    const sig = part.includes(",") ? part.slice(part.indexOf(",") + 1) : part
    if (!sig) continue
    const candidate = Buffer.from(sig)
    if (
      candidate.length === expectedBuf.length &&
      timingSafeEqual(candidate, expectedBuf)
    ) {
      return true
    }
  }

  return false
}

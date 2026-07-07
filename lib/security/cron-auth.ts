import { createHash, timingSafeEqual } from "node:crypto"

/**
 * Shared bearer gate for the `/api/cron/*` service-role jobs. One
 * implementation so every cron route fails the same way: closed when
 * `CRON_SECRET` is unset, exact `Bearer ` scheme only, and fixed-length
 * SHA-256 digests compared with `timingSafeEqual` so response time never
 * depends on how much of the secret a candidate token shares.
 */
export function isAuthorizedCronRequest(request: Request): boolean {
  return matchesCronSecret(
    request.headers.get("authorization"),
    process.env.CRON_SECRET
  )
}

export function matchesCronSecret(
  authorization: string | null,
  secret: string | undefined
): boolean {
  const expected = secret?.trim()
  if (!expected) return false

  if (!authorization?.startsWith("Bearer ")) return false
  const presented = authorization.slice("Bearer ".length)

  return timingSafeEqual(digest(presented), digest(expected))
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest()
}

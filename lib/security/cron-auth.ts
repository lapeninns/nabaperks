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
  return matchesAnyBearerSecret(authorization, [secret])
}

export function matchesAnyBearerSecret(
  authorization: string | null,
  secrets: readonly (string | undefined)[]
): boolean {
  if (!authorization?.startsWith("Bearer ")) return false
  const presented = authorization.slice("Bearer ".length)
  const presentedDigest = digest(presented)
  let configured = false
  let matched = false

  for (const secret of secrets) {
    const expected = secret?.trim()
    if (!expected) continue

    configured = true
    // Do not short-circuit after a match. During a rotation overlap, both
    // configured candidates follow the same fixed-length digest comparison.
    matched = timingSafeEqual(presentedDigest, digest(expected)) || matched
  }

  return configured && matched
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest()
}

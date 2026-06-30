import { createHash } from "node:crypto"

import type { Sql } from "./admin-live-db"
import type { PublicQrRouterFixture } from "./public-qr-router-live-db"

const QR_SCAN_LIMIT = 60

type PublicQrRateLimitIdentity = {
  readonly ip: string
  readonly userAgent: string
}

export function publicQrRateLimitHeaders(fixture: PublicQrRouterFixture) {
  return {
    "x-vercel-forwarded-for": publicQrRateLimitIp(fixture),
  }
}

export function publicQrRateLimitIdentities(
  fixture: PublicQrRouterFixture,
  userAgent: string
): readonly PublicQrRateLimitIdentity[] {
  const normalizedUserAgent = userAgent.trim().slice(0, 160) || "unknown"

  return [
    { ip: publicQrRateLimitIp(fixture), userAgent: normalizedUserAgent },
    { ip: "unknown", userAgent: normalizedUserAgent },
  ]
}

export function publicQrRateLimitBucketKeys(
  fixture: PublicQrRouterFixture,
  identities: readonly PublicQrRateLimitIdentity[]
): readonly string[] {
  return [fixture.activeQrId, fixture.inactiveQrId].flatMap((qrId) => {
    return identities.map((identity) => {
      return qrScanRateLimitBucketKey(
        qrId,
        rateLimitIdentity(identity.ip, identity.userAgent)
      )
    })
  })
}

export async function seedPublicQrRateLimitBuckets(
  sql: Sql,
  fixture: PublicQrRouterFixture,
  identities: readonly PublicQrRateLimitIdentity[]
): Promise<readonly string[]> {
  const bucketKeys = identities.map((identity) => {
    return qrScanRateLimitBucketKey(
      fixture.activeQrId,
      rateLimitIdentity(identity.ip, identity.userAgent)
    )
  })

  for (const bucketKey of bucketKeys) {
    await sql`
      insert into public.rate_limit_buckets (bucket_key, count, reset_at)
      values (${bucketKey}, ${QR_SCAN_LIMIT}, now() + interval '1 minute')
      on conflict (bucket_key) do update
      set count = excluded.count,
          reset_at = excluded.reset_at`
  }

  return bucketKeys
}

export async function cleanupPublicQrRateLimitBuckets(
  sql: Sql,
  bucketKeys: readonly string[]
): Promise<void> {
  for (const bucketKey of bucketKeys) {
    await sql`
      delete from public.rate_limit_buckets
      where bucket_key = ${bucketKey}`
  }
}

function publicQrRateLimitIp(fixture: PublicQrRouterFixture): string {
  const runId = fixture.activeQrId.replace("e2e-public-", "")

  return `203.0.113.${(Number.parseInt(runId.slice(0, 2), 16) % 200) + 1}`
}

function rateLimitIdentity(ip: string, userAgent: string): string {
  return createHash("sha256")
    .update(`${ip}:${userAgent}`)
    .digest("hex")
    .slice(0, 32)
}

function qrScanRateLimitBucketKey(qrId: string, identity: string): string {
  return createHash("sha256")
    .update(`qr-scan:${qrId}:${identity}`)
    .digest("hex")
}

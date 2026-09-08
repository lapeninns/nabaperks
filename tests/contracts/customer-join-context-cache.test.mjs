import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

function read(...segments) {
  return readFileSync(path.join(root, ...segments), "utf8")
}

test("the join lookup is cached in two stages under the merchant tag, with no side effects inside the cache", () => {
  const lookup = read("lib", "customer", "join-lookup.ts")

  // Nothing request-scoped or effectful may run inside unstable_cache.
  assert.doesNotMatch(lookup, /after\(/)
  assert.doesNotMatch(lookup, /next\/headers/)
  assert.doesNotMatch(lookup, /next\/server/)
  assert.doesNotMatch(lookup, /enforceRateLimit|recordProductEvent/)

  // Stage A holds only immutable identity — never the mutable card pointer or
  // active flag, which a merchant can re-point without touching a qr-keyed tag.
  assert.match(lookup, /\.select\("id, merchant_id"\)/)
  assert.match(lookup, /\["qr-code-identity", qrId\]/)
  assert.match(lookup, /\["merchant-id-by-slug", merchantSlug\]/)

  // Stage B holds every mutable field under the merchant tag that all
  // merchant, admin and Stripe writers already revalidate.
  // Stage B keys carry a shape version so a deploy that changes the row shape
  // never reads an entry the previous deploy wrote.
  assert.match(
    lookup,
    /\["qr-join-context", JOIN_CONTEXT_SHAPE, merchantId, qrCodeId\]/
  )
  assert.match(
    lookup,
    /\["merchant-join-context", JOIN_CONTEXT_SHAPE, merchantId\]/
  )
  assert.match(lookup, /JOIN_CONTEXT_SHAPE = "v\d+"/)
  // The reward-pool embed must name its foreign key: two relationships exist
  // between reward_pool_items and loyalty_cards, and an unhinted embed fails
  // the whole lookup.
  assert.match(
    lookup,
    /reward_pool_items!reward_pool_items_loyalty_card_id_fkey\(reward_name, is_active, display_order\)/
  )
  assert.doesNotMatch(lookup, /[^!]reward_pool_items\(/)
  assert.equal(
    (lookup.match(/\[merchantCacheTag\(merchantId\)\]/g) ?? []).length,
    2
  )
  assert.match(lookup, /JOIN_CONTEXT_CACHE_SECONDS = 60/)
})

test("the scan limiter and scan event stay in front of and behind the cached read, and only the physical scan enables them", () => {
  const join = read("lib", "customer", "join.ts")
  const loadJoin = read("lib", "customer", "experience", "load-join.ts")
  const actions = read("app", "m", "[merchantSlug]", "join", "actions.ts")
  const returning = read("lib", "customer", "returning-qr-redirect.ts")
  const qrPage = read("app", "q", "[qrId]", "page.tsx")

  assert.doesNotMatch(join, /enforceRateLimit\(/)
  assert.ok(
    join.indexOf("enforceQrScanRateLimit(") < join.indexOf("loadQrIdentity("),
    "the limiter must gate the lookup, not follow it"
  )
  assert.ok(
    join.indexOf("loadQrJoinState(") < join.indexOf('eventName: "qr_scanned"'),
    "the scan event must follow the resolved lookup"
  )
  assert.doesNotMatch(
    join,
    /getMerchantJoinContext\([\s\S]*?scanRateLimitIdentity[\s\S]*?\) \{/
  )

  // Only /q/[qrId] passes a scan identity; join renders and actions are reads
  // behind the cache and must not consume the scan budget.
  assert.match(qrPage, /scanRateLimitIdentity:/)
  for (const source of [loadJoin, actions, returning]) {
    assert.doesNotMatch(
      source,
      /getMerchantJoinContext\([^)]*customerRateLimitIdentityFromHeaders/
    )
    assert.doesNotMatch(source, /getMerchantJoinContext\([^)]*requestIdentity/)
  }
  assert.doesNotMatch(returning, /getCurrentCustomer/)
})

test("both merged limiters keep today's bucket keys and limits, and fall back for one release if the RPC is missing", () => {
  const qrLimiter = read("lib", "customer", "qr-rate-limit.ts")
  const otpLimiter = read("lib", "customer", "otp-rate-limit.ts")
  const scanMigration = read(
    "supabase",
    "migrations",
    "20260909100000_admit_qr_scan.sql"
  )
  const verifyMigration = read(
    "supabase",
    "migrations",
    "20260909100100_admit_customer_otp_verify.sql"
  )

  assert.match(qrLimiter, /\.rpc\("admit_qr_scan"/)
  assert.match(qrLimiter, /rateLimitBucketHash\(identityKey\)/)
  assert.match(qrLimiter, /rateLimitBucketHash\(codeKey\)/)
  assert.match(qrLimiter, /qrScanIdentityRateLimitKey\(identity\)/)
  assert.match(qrLimiter, /qrScanCodeRateLimitKey\(qrId, identity\)/)
  assert.match(qrLimiter, /isMissingRpcError\(error\)/)
  assert.match(qrLimiter, /qrScanIdentityRateLimit = 120/)
  assert.match(qrLimiter, /qrScanCodeRateLimit = 60/)
  assert.match(qrLimiter, /qrScanRateLimitWindowMs = 60_000/)

  assert.match(otpLimiter, /\.rpc\("admit_customer_otp_verify"/)
  assert.match(otpLimiter, /isMissingRpcError\(error\)/)

  for (const migration of [scanMigration, verifyMigration]) {
    assert.match(
      migration,
      /revoke all on function public\.admit_[a-z_]+\(text, text\)\s+from public, anon, authenticated, service_role;/
    )
    assert.match(
      migration,
      /grant execute on function public\.admit_[a-z_]+\(text, text\)\s+to service_role;/
    )
    assert.match(migration, /notify pgrst, 'reload schema';/)
    assert.doesNotMatch(
      migration,
      /create or replace function public\.enforce_rate_limit/
    )
  }
  assert.match(
    scanMigration,
    /enforce_rate_limit\(p_identity_bucket, 120, 60000\)/
  )
  assert.match(scanMigration, /enforce_rate_limit\(p_code_bucket, 60, 60000\)/)
  assert.match(
    verifyMigration,
    /enforce_rate_limit\(p_phone_bucket, 5, 900000\)/
  )
  assert.match(
    verifyMigration,
    /enforce_rate_limit\(p_identity_bucket, 5, 900000\)/
  )
})

test("every QR writer without the merchant fan-out now revalidates the merchant tag, and cached public pages stay request-time", () => {
  const admin = read("app", "admin", "actions.ts")
  const billing = read("app", "admin", "billing", "actions.ts")
  const merchantPage = read("app", "m", "[merchantSlug]", "page.tsx")
  const termsPage = read(
    "app",
    "merchant",
    "[merchantSlug]",
    "terms",
    "page.tsx"
  )

  assert.equal(
    (
      admin.match(
        /if \(merchantId\) revalidateMerchantCacheTags\(merchantId\)/g
      ) ?? []
    ).length,
    2,
    "admin QR enable/disable and regenerate must both fan out to the merchant tag"
  )
  assert.match(admin, /\.select\("merchant_id"\)[\s\S]*?\.eq\("id", qrCodeId\)/)
  assert.match(billing, /revalidateMerchantCacheTags\(merchantId\)/)
  assert.match(merchantPage, /export const dynamic = "force-dynamic"/)
  assert.match(termsPage, /export const dynamic = "force-dynamic"/)
})

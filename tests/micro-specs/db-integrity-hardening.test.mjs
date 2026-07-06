import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

// MS-db-integrity-hardening — pins the hardening contract:
//   1. every coherence CHECK is added NOT VALID after a repair pass and then
//      VALIDATED in the same migration (never left as a NOT VALID remnant),
//   2. the constraints are one-way implications (status ⇒ timestamp) — the
//      spec forbids timestamp ⇒ status,
//   3. the purge function is service-role-scoped, and
//   4. the privacy-retention cron actually calls it, non-fatally.
// Behavioral proof: tests/db/integrity-hardening.test.mjs.

const migration = readFileSync(
  "supabase/migrations/20260707094000_integrity_hardening.sql",
  "utf8"
)
const route = readFileSync("app/api/cron/privacy-retention/route.ts", "utf8")

test("all five coherence checks are added and validated", () => {
  for (const name of [
    "reward_events_redeemed_coherent",
    "reward_events_expired_coherent",
    "reward_events_cancelled_coherent",
    "notification_events_sent_coherent",
    "notification_events_cancelled_coherent",
  ]) {
    assert.match(migration, new RegExp(`add constraint ${name}`), `${name} is added`)
    assert.match(
      migration,
      new RegExp(`validate constraint ${name}`),
      `${name} is validated in the same migration`
    )
  }
  assert.match(
    migration,
    /validate constraint push_subscriptions_allowed_endpoint_check/,
    "the pre-existing NOT VALID remnant is validated too"
  )
})

test("the checks are one-way implications, not biconditionals", () => {
  assert.match(
    migration,
    /check \(status <> 'redeemed' or redeemed_at is not null\)/,
    "redeemed ⇒ redeemed_at only"
  )
  assert.doesNotMatch(
    migration.replace(/^--.*$/gm, ""),
    /redeemed_at is null or status/i,
    "no timestamp ⇒ status direction may be constrained"
  )
})

test("the purge function is service-role-scoped", () => {
  assert.match(migration, /create or replace function public\.purge_stale_rate_limit_buckets/)
  assert.match(migration, /interval '24 hours'/, "the 24h grace period is pinned")
  assert.match(
    migration,
    /revoke all on function public\.purge_stale_rate_limit_buckets/,
    "PUBLIC execute is revoked"
  )
  assert.match(
    migration,
    /grant execute on function public\.purge_stale_rate_limit_buckets[\s\S]{0,90}to service_role/,
    "service_role keeps execute"
  )
})

test("the privacy-retention cron calls the purge non-fatally", () => {
  assert.match(route, /purge_stale_rate_limit_buckets/, "the cron invokes the purge")
  assert.match(
    route,
    /privacy_retention_bucket_purge_failed/,
    "purge failures are logged without failing the other retention steps"
  )
  assert.match(
    route,
    /purgedRateLimitBuckets/,
    "the purge count is reported in the cron response"
  )
})

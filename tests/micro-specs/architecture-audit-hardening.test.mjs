import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

test("Given global requests When proxy responds Then all security header families are attached", () => {
  const proxy = readProjectFile("proxy.ts")
  const nextConfig = readProjectFile("next.config.ts")

  assert.match(proxy, /Content-Security-Policy/)
  assert.match(proxy, /Strict-Transport-Security/)
  assert.match(proxy, /X-Frame-Options[^\\n]+DENY/)
  assert.match(proxy, /X-Content-Type-Options[^\\n]+nosniff/)
  assert.match(proxy, /Referrer-Policy[^\\n]+strict-origin-when-cross-origin/)
  assert.match(proxy, /Permissions-Policy/)
  assert.match(proxy, /frame-ancestors 'none'/)
  assert.match(proxy, /const nonce = btoa\(crypto\.randomUUID\(\)\)/)
  assert.match(proxy, /requestHeaders\.set\("x-nonce", nonce\)/)
  assert.match(proxy, /requestHeaders\.set\("Content-Security-Policy", csp\)/)
  assert.match(proxy, /'nonce-\$\{nonce\}'/)
  assert.match(proxy, /'strict-dynamic'/)
  assert.match(
    proxy,
    /script-src-elem 'self' 'nonce-\$\{nonce\}' https:\/\/js\.stripe\.com/
  )
  assert.doesNotMatch(proxy, /script-src[^\n]*unsafe-inline/)
  assert.doesNotMatch(proxy, /script-src-elem[^\n]*unsafe-inline/)
  assert.doesNotMatch(nextConfig, /sri:\s*\{/)
})

test("Given CI runs on branches When workflow is inspected Then lint and tests gate the build", () => {
  const ci = readProjectFile(".github", "workflows", "ci.yml")

  assert.match(ci, /run: pnpm lint/)
  assert.match(ci, /run: pnpm test/)
  assert(
    ci.indexOf("run: pnpm test") < ci.indexOf("run: pnpm build"),
    "tests should run before the production build"
  )
})

test("Given Playwright runs in CI When focused tests are present Then the config rejects them", () => {
  const config = readProjectFile("playwright.config.ts")

  assert.match(config, /forbidOnly:\s*Boolean\(process\.env\.CI\)/)
  assert.match(config, /retries: process\.env\.CI \? 1 : 0/)
  assert.match(config, /workers: process\.env\.CI \? 1 : undefined/)
})

test("Given trust moat regressions need runtime proof When CI is inspected Then DB behavioral tests exercise the core RPCs", () => {
  const ci = readProjectFile(".github", "workflows", "ci.yml")
  const packageJson = readProjectFile("package.json")
  const dbTest = readProjectFile("tests", "db", "architecture-moat.test.mjs")

  assert.match(ci, /name: DB behavioral moat/)
  assert.match(ci, /run: supabase start/)
  assert.match(ci, /run: pnpm test:db/)
  assert.match(ci, /run: supabase stop --no-backup/)
  assert.match(packageJson, /"test:db": "node --test tests\/db\/\*\.test\.mjs"/)
  assert.match(dbTest, /Promise\.allSettled/)
  assert.match(dbTest, /issue_self_service_stamp/)
  assert.match(dbTest, /collect_reward_scan_token/)
  assert.match(dbTest, /Stamp already issued/)
  assert.match(dbTest, /Reward scan token already used/)
  assert.match(dbTest, /not active yet/)
})

test("Given product analytics metadata can cross many call sites When events persist Then PII keys are scrubbed before DB insert", () => {
  const events = readProjectFile("lib", "analytics", "events.ts")

  assert.match(
    events,
    /metadata: sanitizeMetadata\(input\.metadata \?\? \{\}\)/
  )
  assert.match(events, /export function sanitizeMetadata/)
  for (const key of [
    "email",
    "phone",
    "latitude",
    "longitude",
    "raw_coordinates",
    "token",
    "secret",
  ]) {
    assert.match(events, new RegExp(`"${key}"`))
  }
})

test("Given product event names power funnel reporting When emit sites add names Then the canonical list is enforced", () => {
  const events = readProjectFile("lib", "analytics", "events.ts")

  assert.doesNotMatch(
    events,
    /ProductEventName = \(typeof productEventNames\)\[number\] \| string/
  )
  assert.match(events, /"dashboard_viewed"/)
  assert.match(events, /"loyalty_card_updated"/)
  assert.match(events, /"merchant_profile_updated"/)
})

test("Given Stripe retries a processed event When analytics recording had failed Then billing processing is not repeated", () => {
  const webhookRoute = readProjectFile(
    "app",
    "api",
    "stripe",
    "webhook",
    "route.ts"
  )

  assert.match(webhookRoute, /productEvents = await handleStripeEvent/)
  assert.match(
    webhookRoute,
    /await markStripeWebhookEventProcessed\(event\.id\)/
  )
  assert.match(webhookRoute, /await recordStripeProductEvents\(productEvents\)/)
  assert.match(webhookRoute, /stripe_product_event_record_failed/)
  assert.doesNotMatch(
    webhookRoute,
    /await handleStripeEvent\(stripe, event\)[\s\S]*await recordProductEvent[\s\S]*await markStripeWebhookEventProcessed/
  )
})

test("Given customer contact is immutable When profile writes use service role Then auth_user_id is pinned by the trigger", () => {
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260630125000_pin_customer_auth_user_id.sql"
  )

  assert.match(migration, /prevent_verified_customer_contact_change/)
  assert.match(
    migration,
    /new\.auth_user_id is distinct from old\.auth_user_id/
  )
  assert.match(migration, /Customer auth user cannot be changed/)
})

test("Given concurrent first rate-limit calls When a bucket is cold Then SQL uses an insert conflict guard before row locking", () => {
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260630126000_fix_rate_limit_cold_bucket_race.sql"
  )

  assert.match(migration, /on conflict \(bucket_key\) do nothing/)
  assert.match(migration, /returning rate_limit_buckets\.count/)
  assert.match(migration, /for update/)
  assert.doesNotMatch(
    migration,
    /if not found then\s+insert into public\.rate_limit_buckets/
  )
})

test("Given a card threshold is lowered When members already reached the new count Then SQL mints missing rewards instead of dead-stating them", () => {
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260630127000_reconcile_loyalty_threshold_lowering.sql"
  )

  assert.match(migration, /reconcile_loyalty_card_threshold_rewards/)
  assert.match(migration, /p_new_stamps_required >= p_old_stamps_required/)
  assert.match(migration, /current_stamp_count >= p_new_stamps_required/)
  assert.match(
    migration,
    /not exists \([\s\S]*from public\.reward_events[\s\S]*cycle_number = customer_memberships\.active_cycle_number/
  )
  assert.match(
    migration,
    /At least 3 active reward pool items are required before lowering this card threshold\./
  )
  assert.match(migration, /'source', 'loyalty_card_threshold_reconciliation'/)
  assert.match(migration, /threshold_reconciled_rewards/)
})

test("Given merchants can read customer summaries When contact data is loaded Then raw customer PII is withheld by the DB and loaders use the masked view", () => {
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260630128000_mask_customer_contact_backstop.sql"
  )
  const dashboard = readProjectFile("lib", "merchant", "dashboard.ts")
  const activity = readProjectFile("lib", "merchant", "activity.ts")

  assert.match(migration, /create or replace view public\.customers_masked/)
  assert.match(migration, /security_barrier = true/)
  assert.match(
    migration,
    /revoke select on table public\.customers from authenticated/
  )
  assert.match(
    migration,
    /grant select \(id, phone_last4, created_at, updated_at\)[\s\S]*to authenticated/
  )
  assert.match(
    migration,
    /public\.merchant_can_access_customer\(customers\.id\)/
  )
  assert.match(dashboard, /\.from\("customers_masked"\)/)
  assert.match(activity, /\.from\("customers_masked"\)/)
  assert.doesNotMatch(dashboard, /customers\(email, phone/)
  assert.doesNotMatch(activity, /customers\(email, phone/)
})

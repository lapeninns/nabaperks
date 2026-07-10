import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  const file = path.join(projectRoot, ...segments)
  return existsSync(file) ? readFileSync(file, "utf8") : ""
}

function sourceFrom(source, marker) {
  const start = source.indexOf(marker)
  return start === -1 ? "" : source.slice(start)
}

const migration = readProjectFile(
  "supabase",
  "migrations",
  "20260710160000_merchant_activation_ledger.sql"
)
const activationEvents = readProjectFile(
  "lib",
  "analytics",
  "merchant-activation-events.ts"
)
const launchLayout = readProjectFile("app", "app", "launch", "layout.tsx")
const posterActions = readProjectFile("app", "app", "qr", "actions.ts")
const funnels = readProjectFile("lib", "analytics", "funnels.ts")
const adminPage = readProjectFile("app", "admin", "page.tsx")

test("the ledger migration adds replay-safe event time and semantic idempotency", () => {
  assert.match(
    migration,
    /alter table\s+public\.product_events[\s\S]*add column if not exists\s+occurred_at\s+timestamptz/i,
    "product_events must distinguish occurrence time from its receipt timestamp"
  )
  assert.match(
    migration,
    /add column if not exists\s+idempotency_key\s+text/i,
    "activation events need a bounded semantic idempotency key"
  )
  assert.match(
    migration,
    /create unique index[\s\S]*merchant_id[\s\S]*event_name[\s\S]*idempotency_key[\s\S]*where\s+idempotency_key\s+is not null/i,
    "replayed milestones must converge on one first-party event"
  )
  assert.match(
    migration,
    /update\s+public\.product_events[\s\S]*occurred_at\s*=\s*created_at/i,
    "existing event occurrence times must be backfilled without rewriting created_at"
  )
})

test("owner-to-funnel links are forced-RLS and inaccessible outside the service role", () => {
  assert.match(migration, /create table[\s\S]*public\.merchant_funnel_links/i)
  assert.match(
    migration,
    /alter table\s+public\.merchant_funnel_links\s+force row level security/i
  )
  assert.match(
    migration,
    /revoke all on (?:table )?public\.merchant_funnel_links from public,\s*anon,\s*authenticated/i
  )
  assert.match(
    migration,
    /grant [^;]+ on (?:table )?public\.merchant_funnel_links to service_role/i
  )
  assert.match(
    migration,
    /length\([^)]*funnel_key[^)]*\)\s*=\s*64|funnel_key[\s\S]{0,160}\^\[(?:0-9a-f|a-f0-9)\]\{64\}\$/i,
    "the first-party link stores only a UUID owner and lowercase HMAC key"
  )
})

test("the recorder RPC is service-only, closed-vocabulary, and replay-safe", () => {
  assert.match(
    migration,
    /create or replace function\s+public\.record_merchant_activation_event/i
  )
  assert.match(migration, /security definer/i)
  for (const eventName of [
    "merchant_launch_entered",
    "qr_poster_emailed",
    "merchant_billing_reached",
    "merchant_billing_activated",
  ]) {
    assert.match(
      migration,
      new RegExp(`['\"]${eventName}['\"]`),
      `${eventName} must be part of the recorder's closed vocabulary`
    )
  }
  assert.match(
    migration,
    /on conflict[\s\S]{0,500}idempotency_key|idempotency_key[\s\S]{0,500}on conflict/i
  )
  assert.match(
    migration,
    /revoke all on function\s+public\.record_merchant_activation_event\([^;]+from public,\s*anon,\s*authenticated/i
  )
  assert.match(
    migration,
    /grant execute on function\s+public\.record_merchant_activation_event\([^;]+to service_role/i
  )
})

test("the cohort RPC returns one aggregate activation row from authoritative facts", () => {
  assert.match(
    migration,
    /create or replace function\s+public\.get_merchant_activation_cohort_facts/i
  )
  for (const aggregateKey of [
    "account_created",
    "email_verified",
    "onboarding_complete",
    "launch_entered",
    "venue_ready",
    "card_ready",
    "rewards_ready",
    "qr_ready",
    "poster_ready",
    "billing_reached",
    "billing_activated",
    "first_customer_stamped",
    "first_stamp_7d_yes",
    "first_stamp_7d_no",
    "first_stamp_7d_pending",
    "median_signup_to_poster_seconds",
  ]) {
    assert.match(migration, new RegExp(`\\b${aggregateKey}\\b`))
  }
  assert.match(migration, /metadata\s*->>\s*['\"]source['\"]\s*=\s*['\"]self_service_qr['\"]/i)
  assert.match(migration, /event_type\s*=\s*['\"]earned['\"]/i)
  assert.match(migration, /stamps_delta\s*>\s*0/i)
  assert.match(migration, /earned_business_date\s+is not null/i)
  assert.match(migration, /qr_downloaded/)
  assert.match(migration, /qr_poster_emailed/)
})

test("the activation event adapter schedules service-role persistence after the response and fails open", () => {
  assert.match(activationEvents, /import\s+["']server-only["']/)
  assert.match(activationEvents, /from\s+["']next\/server["']/)
  assert.match(activationEvents, /record_merchant_activation_event/)
  assert.match(activationEvents, /createSupabaseServiceRoleClient/)
  assert.match(activationEvents, /after\(\s*(?:async\s*)?\(\)\s*=>/)
  assert.match(activationEvents, /try\s*\{[\s\S]*?\.rpc\([\s\S]*?\}\s*catch/)
  assert.doesNotMatch(
    activationEvents,
    /catch[^\{]*\{[\s\S]{0,240}\bthrow\b/,
    "analytics failure must never escape into the merchant operation"
  )
})

test("first launch entry is scheduled from the nested launch layout without delaying render", () => {
  assert.match(launchLayout, /scheduleMerchantActivationEvent/)
  assert.match(launchLayout, /eventName:\s*["']merchant_launch_entered["']/)
  assert.match(launchLayout, /idempotencyKey:/)
  assert.doesNotMatch(
    launchLayout,
    /await\s+scheduleMerchantActivationEvent/,
    "the launch layout must not await analytics"
  )
  assert.match(launchLayout, /return\s+children|\{children\}/)
})

test("poster email telemetry is scheduled only after provider success", () => {
  const emailAction = sourceFrom(
    posterActions,
    "export async function emailPosterAction"
  )
  const providerSuccess = emailAction.indexOf("await sendTransactionalEmail")
  const milestone = emailAction.indexOf("scheduleMerchantActivationEvent")
  const successResponse = emailAction.indexOf("return { ok: true")

  assert.ok(providerSuccess >= 0, "poster delivery remains authoritative")
  assert.ok(
    milestone > providerSuccess,
    "qr_poster_emailed must be scheduled only after Resend succeeds"
  )
  assert.ok(
    successResponse > milestone,
    "analytics scheduling belongs on the successful poster-email path"
  )
  assert.match(emailAction, /eventName:\s*["']qr_poster_emailed["']/)
  assert.doesNotMatch(emailAction, /await\s+scheduleMerchantActivationEvent/)
  assert.doesNotMatch(
    emailAction,
    /capturePostHogEvent/,
    "the success path must write the first-party ledger, not PostHog alone"
  )
})

test("the admin overview loads the bounded cohort RPC and replaces raw pilot totals", () => {
  assert.match(funnels, /get_merchant_activation_cohort_facts/)
  assert.match(funnels, /buildMerchantActivationCohortWindow/)
  assert.match(funnels, /parseMerchantActivationCohortFacts/)
  assert.match(adminPage, /getMerchantActivationCohortFacts/)
  assert.match(adminPage, /toMerchantActivationFunnelItems/)
  assert.doesNotMatch(adminPage, /getPilotFunnelCounts|toPilotFunnelItems/)
  assert.match(adminPage, /merchant activation/i)
  assert.match(adminPage, /30-day account-created cohort/i)
  assert.match(adminPage, /authoritative/i)
})

import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260710150000_billing_state_durability.sql"
)

test("billing durability is delivered by one replay-safe migration", () => {
  assert.equal(
    existsSync(migrationPath),
    true,
    "the billing durability migration must exist"
  )

  const source = readFileSync(migrationPath, "utf8")

  for (const column of [
    "stripe_subscription_status",
    "stripe_subscription_created_at",
    "stripe_price_id",
    "billing_interval",
    "unit_amount",
    "currency",
    "cancel_at_period_end",
    "cancel_at",
    "stripe_state_event_created_at",
    "stripe_state_event_id",
  ]) {
    assert.match(
      source,
      new RegExp(`add column if not exists ${column}\\b`, "i"),
      `billing_customers.${column} is replay-safe`
    )
  }

  assert.match(
    source,
    /create table if not exists public\.billing_checkout_attempts/i
  )
  assert.match(
    source,
    /alter table public\.billing_checkout_attempts enable row level security/i
  )
  assert.match(
    source,
    /alter table public\.billing_checkout_attempts force row level security/i
  )
  assert.match(
    source,
    /attempt_id[\s\S]*billing_interval[\s\S]*stripe_price_id[\s\S]*success_url[\s\S]*cancel_url[\s\S]*attempt_expires_at/i,
    "the stable attempt persists every idempotent Checkout parameter"
  )
  assert.match(
    source,
    /stripe_checkout_session_id[\s\S]*stripe_checkout_session_url[\s\S]*stripe_checkout_session_expires_at/i,
    "the provider Session tuple is durable"
  )
  assert.match(
    source,
    /interval '5 minutes'/i,
    "worker and webhook leases use the specified five-minute duration"
  )

  for (const fn of [
    "claim_billing_checkout_attempt",
    "bind_billing_checkout_customer",
    "finalize_billing_checkout_session",
    "release_billing_checkout_attempt",
    "rotate_billing_checkout_attempt",
    "claim_stripe_webhook_event",
    "fail_stripe_webhook_event",
    "complete_stripe_webhook_event",
    "apply_stripe_subscription_event",
    "apply_current_stripe_subscription",
  ]) {
    assert.match(
      source,
      new RegExp(`create or replace function public\\.${fn}\\s*\\(`, "i"),
      `${fn} is installed by the migration`
    )
  }

  const definerCount = source.match(/security definer/gi)?.length ?? 0
  const pinnedPathCount =
    source.match(/set search_path = pg_catalog, public/gi)?.length ?? 0
  assert.equal(definerCount, 10, "all ten RPCs are SECURITY DEFINER")
  assert.equal(
    pinnedPathCount,
    10,
    "all ten RPCs pin the same trusted search path"
  )

  assert.match(
    source,
    /revoke all on table public\.billing_checkout_attempts from public, anon, authenticated/i
  )
  assert.match(
    source,
    /grant select, insert, update, delete on table public\.billing_checkout_attempts to service_role/i
  )
  assert.match(
    source,
    /revoke all on table public\.stripe_webhook_events from public, anon, authenticated/i
  )
  assert.match(
    source,
    /grant select, insert, update, delete on table public\.stripe_webhook_events to service_role/i
  )

  const publicFunctionRevokes =
    source.match(/revoke all on function public\.[^(]+\([^;]+ from public, anon, authenticated;/gi)
      ?.length ?? 0
  const serviceFunctionGrants =
    source.match(/grant execute on function public\.[^(]+\([^;]+ to service_role;/gi)
      ?.length ?? 0
  assert.equal(publicFunctionRevokes, 10, "every exact RPC signature is private")
  assert.equal(
    serviceFunctionGrants,
    10,
    "every exact RPC signature is granted only to service_role"
  )

  assert.match(
    source,
    /stripe_subscription_created_at[\s\S]*stripe_state_event_created_at/i,
    "subscription-created and event-created cursors are separate"
  )
  assert.doesNotMatch(
    source,
    /stripe_state_event_id\s*[<>]|[<>]\s*stripe_state_event_id/i,
    "Stripe event ids are never used as ordering keys"
  )
  assert.match(
    source,
    /update public\.stripe_webhook_events[\s\S]*processed_at = v_now[\s\S]*return v_result/i,
    "the versioned apply RPC owns the processed marker in its transaction"
  )
})

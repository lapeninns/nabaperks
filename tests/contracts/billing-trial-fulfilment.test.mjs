import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path) => readFileSync(path, "utf8")

test("Given fulfilment state is sensitive When the ledger is migrated Then RLS, coherence, indexes and minimum privileges are enforced", () => {
  const migration = read(
    "supabase/migrations/20260801120000_delivery_anchored_pilot.sql"
  )

  assert.match(migration, /create table public\.merchant_launch_fulfilments/)
  assert.match(migration, /awaiting_dispatch.*dispatched.*delivered/s)
  assert.match(migration, /pilot_starts_at/)
  assert.match(migration, /base_pilot_ends_at/)
  assert.match(migration, /desired_stripe_trial_end/)
  assert.match(migration, /confirmed_stripe_trial_end/)
  assert.match(migration, /worker_lease_id/)
  assert.match(migration, /next_retry_at/)
  assert.match(migration, /last_error_code/)
  assert.match(migration, /force row level security/)
  assert.match(migration, /merchant_launch_fulfilments_due_sync_idx/)
  assert.match(
    migration,
    /revoke all on table public\.merchant_launch_fulfilments/
  )
})

test("Given admins update fulfilment When actions replay or race Then idempotent audited RPCs own the transition", () => {
  const migration = read(
    "supabase/migrations/20260801120000_delivery_anchored_pilot.sql"
  )

  for (const fn of [
    "admin_mark_merchant_launch_dispatched",
    "admin_confirm_merchant_launch_delivered",
    "claim_merchant_launch_trial_sync",
    "confirm_merchant_launch_trial_sync",
    "fail_merchant_launch_trial_sync",
  ]) {
    assert.match(
      migration,
      new RegExp(`create or replace function public\\.${fn}\\(`)
    )
  }
  assert.match(migration, /insert into public\.audit_logs/)
  assert.match(migration, /for update/)
  assert.match(
    migration,
    /grant execute on function public\.admin_mark_merchant_launch_dispatched[\s\S]*to authenticated/
  )
  assert.match(
    migration,
    /grant execute on function public\.claim_merchant_launch_trial_sync[\s\S]*to service_role/
  )
  for (const fn of [
    "set_billing_checkout_contract_version",
    "sync_merchant_launch_from_billing",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `grant execute on function public\\.${fn}\\(\\)[\\s\\S]*?to service_role`
      )
    )
  }
})

test("Given an undelivered safety claim is in flight When delivery is confirmed Then the desired trial end remains monotonic", () => {
  const migration = read(
    "supabase/migrations/20260801120000_delivery_anchored_pilot.sql"
  )
  const deliveryFunction = migration.match(
    /create or replace function public\.admin_confirm_merchant_launch_delivered\([\s\S]*?\$function\$;/
  )?.[0]

  assert.ok(deliveryFunction)
  assert.equal(
    deliveryFunction.match(
      /coalesce\(fulfilments\.desired_stripe_trial_end, '-infinity'::timestamptz\)/g
    )?.length,
    3,
    "the assigned target and both pending checks must preserve the existing desired end"
  )
})

test("Given billing trials need delivery anchoring When scheduled work runs Then the route is protected and registered", () => {
  const route = read("app/api/cron/billing-trial-sync/route.ts")
  const vercel = JSON.parse(read("vercel.json"))

  assert.match(route, /isAuthorizedCronRequest/)
  assert.match(route, /runBillingTrialSync/)
  assert.ok(
    vercel.crons.some(
      (cron) =>
        cron.path === "/api/cron/billing-trial-sync" &&
        cron.schedule === "*\/15 * * * *"
    )
  )
})

test("Given the commercial promise When shared facts render Then delivery starts the 28-day platform pilot", () => {
  const facts = read("lib/marketing/facts.ts")
  const legal = read("lib/legal/content.ts")

  assert.match(facts, /Allow up to 14 calendar days for print and delivery\./)
  assert.match(
    facts,
    /Your 28-day platform pilot begins when your posters are delivered\./
  )
  assert.match(
    legal,
    /28-day platform pilot begins when the posters are delivered/
  )
  assert.doesNotMatch(facts, /annual launch fee waiver/i)
})

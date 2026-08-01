import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path) => readFileSync(path, "utf8")

test("Checkout charges launch now and provisions fulfilment plus the platform pilot", () => {
  const checkout = read("lib/stripe/checkout.ts")
  const checkoutContracts = read("lib/stripe/checkout-contracts.ts")
  const checkoutReturn = read("lib/stripe/checkout-return.ts")
  const checkoutSession = read("lib/stripe/checkout-session.ts")
  const source = [
    checkout,
    checkoutContracts,
    checkoutReturn,
    checkoutSession,
  ].join("\n")

  assert.match(source, /stripeLaunchPriceId/)
  assert.match(
    source,
    /line_items:[\s\S]*attempt\.stripePriceId[\s\S]*offer\.stripeLaunchPriceId/
  )
  assert.match(source, /launch_fee_policy: offer\.launchFeePolicy/)
  assert.match(source, /trial_period_days: 42/)
  assert.match(source, /pilot_anchor: "confirmed_delivery"/)
  assert.match(source, /fulfilment_allowance_days: "14"/)
  assert.match(source, /usable_pilot_days: "28"/)
  assert.match(source, /billing_cadence: "28_days"/)
  assert.match(source, /session\?\.payment_status === "paid"/)
  assert.match(source, /annual_included/)
  assert.match(source, /previously_satisfied/)
})

test("annual checkout is explicit while historical policies remain readable", () => {
  const action = read("app/app/billing/actions.ts")
  const checkoutContracts = read("lib/stripe/checkout-contracts.ts")
  const checkoutSession = read("lib/stripe/checkout-session.ts")
  const checkoutSource = `${checkoutContracts}\n${checkoutSession}`
  const form = read("components/merchant/account/billing-checkout-form.tsx")

  assert.match(action, /if \(value === "day"\) return "month"/)
  assert.match(action, /if \(value === "year"\) return "year"/)
  assert.match(action, /STRIPE_GROWTH_ANNUAL_PRICE_ID/)
  assert.match(checkoutSource, /annualPriceId/)
  assert.match(form, /value="day"/)
  assert.match(form, /value="year"/)
  assert.match(checkoutSource, /annual_included/)
})

test("launch-fee decisions and satisfaction are durable and private", () => {
  const originalMigration = read(
    "supabase/migrations/20260731120000_launch_fee_checkout_policy.sql"
  )
  const deliveryAnchoredMigration = read(
    "supabase/migrations/20260801120000_delivery_anchored_pilot.sql"
  )

  for (const column of [
    "launch_fee_status",
    "launch_fee_satisfied_at",
    "launch_fee_subscription_id",
    "checkout_offer_bound",
    "stripe_launch_price_id",
    "launch_fee_policy",
  ]) {
    assert.match(
      originalMigration,
      new RegExp(`add column if not exists ${column}`)
    )
  }

  for (const fn of [
    "bind_billing_checkout_offer",
    "satisfy_merchant_launch_fee",
  ]) {
    assert.match(
      originalMigration,
      new RegExp(`create or replace function public\\.${fn}\\(`)
    )
    assert.match(
      originalMigration,
      new RegExp(
        `revoke all on function public\\.${fn}\\([\\s\\S]*?from public, anon, authenticated`
      )
    )
  }

  assert.match(originalMigration, /launch_fee_status = 'grandfathered'/)
  assert.match(originalMigration, /launch_fee_policy = 'annual_included'/)
  assert.match(
    deliveryAnchoredMigration,
    /launch_fee_policy := 'previously_satisfied'/
  )
  assert.match(
    deliveryAnchoredMigration,
    /billing_interval in \('day', 'month', 'year'\)[\s\S]*launch_fee_policy := 'charged'/
  )
  assert.doesNotMatch(deliveryAnchoredMigration, /annual_included/)
})

test("the provider contract pins the approved 28-day and annual prices", () => {
  const env = read("config/env-contract.json")
  const readiness = read("scripts/provider-readiness/checks.mjs")

  assert.match(env, /STRIPE_LAUNCH_PRICE_ID/)
  assert.match(env, /STRIPE_GROWTH_ANNUAL_PRICE_ID/)
  assert.match(readiness, /unit_amount === 29999/)
  assert.match(readiness, /unit_amount === 6999/)
  assert.match(readiness, /unit_amount === 69990/)
  assert.match(readiness, /recurring\?\.interval === "day"/)
  assert.match(readiness, /recurring\?\.interval_count === 28/)
  assert.match(readiness, /recurring\?\.interval === "year"/)
  assert.match(readiness, /recurring\?\.interval_count === 1/)
})

test("authoritative billing state accepts exact daily provider snapshots", () => {
  const migration = read(
    "supabase/migrations/20260731130000_28_day_billing.sql"
  )

  assert.match(migration, /billing_interval in \('day', 'month', 'year'\)/)
  assert.match(
    migration,
    /p_billing_interval not in \('day', 'month', 'year'\)/
  )
})

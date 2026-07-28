import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path) => readFileSync(path, "utf8")

test("Stripe SDK and API version stay on the supported June 2026 stable contract", () => {
  const packageJson = JSON.parse(read("package.json"))
  const stripeServer = read("lib/stripe/server.ts")

  assert.equal(packageJson.dependencies.stripe, "^22.3.1")
  assert.match(stripeServer, /apiVersion:\s*["']2026-06-24\.dahlia["']/)
})

test("annual Growth price is documented and production-required", () => {
  const envExample = read(".env.example")
  const envKeys = read("scripts/env-keys.mjs")
  const envCheck = read("scripts/check-env.mjs")

  assert.match(envExample, /Stripe is test-mode only/)
  assert.match(envExample, /STRIPE_GROWTH_ANNUAL_PRICE_ID=price_replace_me/)
  assert.match(envKeys, /STRIPE_GROWTH_ANNUAL_PRICE_ID=<price_/)
  assert.match(envKeys, /STRIPE_SECRET_KEY=<sk_test_/)
  assert.match(
    envKeys,
    /Production Stripe configuration must use pk_test_ and sk_test_/
  )
  assert.match(
    envCheck,
    /productionRequiredEnvNames[\s\S]*"STRIPE_GROWTH_ANNUAL_PRICE_ID"/
  )
})

test("provider readiness checks both exact Growth recurring prices without writes", () => {
  const checks = read("scripts/provider-readiness/checks.mjs")

  assert.match(checks, /startsWith\("sk_test_"\)/)
  assert.match(checks, /startsWith\("pk_test_"\)/)
  assert.match(checks, /STRIPE_GROWTH_ANNUAL_PRICE_ID/)
  assert.match(checks, /body\.livemode === false/)
  assert.match(checks, /unit_amount === 4900/)
  assert.match(checks, /recurring\?\.interval === "month"/)
  assert.match(checks, /unit_amount === 49000/)
  assert.match(checks, /recurring\?\.interval === "year"/)
  assert.match(checks, /Growth monthly price is active GBP 49\/month/)
  assert.match(checks, /Growth annual price is active GBP 490\/year/)
  assert.doesNotMatch(checks, /method:\s*["']POST["']/)
})

test("Stripe webhook handling rejects live mode before durable processing", () => {
  const webhookEvents = read("lib/stripe/webhook-events.ts")

  assert.match(webhookEvents, /event\.livemode !== false/)
  assert.match(webhookEvents, /live_mode_rejected/)
  assert.ok(
    webhookEvents.indexOf("event.livemode !== false") <
      webhookEvents.indexOf("dependencies.claimEvent(event)")
  )
})

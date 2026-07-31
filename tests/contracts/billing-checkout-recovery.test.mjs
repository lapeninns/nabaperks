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

test("launch and 28-day Growth prices are documented and production-ready", () => {
  const envExample = read(".env.example")
  const envKeys = read("scripts/env-keys.mjs")

  assert.match(envExample, /STRIPE_LAUNCH_PRICE_ID=price_replace_me/)
  assert.match(envExample, /STRIPE_GROWTH_PRICE_ID=price_replace_me/)
  assert.doesNotMatch(envExample, /STRIPE_GROWTH_ANNUAL_PRICE_ID/)
  assert.match(envKeys, /STRIPE_LAUNCH_PRICE_ID=<price_/)
  assert.match(envKeys, /STRIPE_GROWTH_PRICE_ID=<price_/)
})

test("provider readiness checks the launch and 28-day Price without writes", () => {
  const checks = read("scripts/provider-readiness/checks.mjs")

  assert.match(checks, /STRIPE_LAUNCH_PRICE_ID/)
  assert.doesNotMatch(checks, /STRIPE_GROWTH_ANNUAL_PRICE_ID/)
  assert.match(checks, /unit_amount === 29999/)
  assert.match(checks, /body\.recurring == null/)
  assert.match(checks, /unit_amount === 6999/)
  assert.match(checks, /recurring\?\.interval === "day"/)
  assert.match(checks, /recurring\?\.interval_count === 28/)
  assert.match(checks, /Launch price is active one-time GBP 299\.99/)
  assert.match(checks, /Growth price is active GBP 69\.99 every 28 days/)
  assert.doesNotMatch(checks, /method:\s*["']POST["']/)
})

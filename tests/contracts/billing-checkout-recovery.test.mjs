import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path) => readFileSync(path, "utf8")

test("Stripe SDK and API version stay on the supported July 2026 stable contract", () => {
  const packageJson = JSON.parse(read("package.json"))
  const stripeServer = read("lib/stripe/server.ts")

  assert.equal(packageJson.dependencies.stripe, "^22.4.0")
  assert.match(stripeServer, /apiVersion:\s*["']2026-07-29\.dahlia["']/)
})

test("launch, 28-day and annual Growth prices are documented", () => {
  const envExample = read(".env.example")
  const envKeys = read("scripts/env-keys.mjs")

  assert.match(envExample, /STRIPE_LAUNCH_PRICE_ID=price_replace_me/)
  assert.match(envExample, /STRIPE_GROWTH_PRICE_ID=price_replace_me/)
  assert.match(envExample, /STRIPE_GROWTH_ANNUAL_PRICE_ID=price_replace_me/)
  assert.match(envKeys, /STRIPE_LAUNCH_PRICE_ID=<price_/)
  assert.match(envKeys, /STRIPE_GROWTH_PRICE_ID=<price_/)
  assert.match(envKeys, /STRIPE_GROWTH_ANNUAL_PRICE_ID=<price_/)
})

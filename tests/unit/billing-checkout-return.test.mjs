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

test("launch page verifies the exact returned Session before assembling readiness", () => {
  const launchPage = readProjectFile("app", "app", "launch", "page.tsx")

  const syncIndex = launchPage.indexOf("completeBillingCheckoutReturn")
  const modelIndex = launchPage.indexOf("getLaunchPageModel")

  assert.notEqual(syncIndex, -1)
  assert.notEqual(modelIndex, -1)
  assert.ok(
    syncIndex < modelIndex,
    "exact billing checkout verification must run before getLaunchPageModel"
  )
  assert.match(
    launchPage,
    /completeBillingCheckoutReturn\(merchant\.id, params\.session_id\)/
  )
})

test("billing panel bypasses cached billing read after checkout success", () => {
  const billingPanel = readProjectFile(
    "components",
    "merchant",
    "account",
    "billing-panel.tsx"
  )

  assert.match(billingPanel, /getMerchantBillingFresh/)
  assert.match(billingPanel, /completeBillingCheckoutReturn/)
  assert.match(billingPanel, /completeBillingPortalReturn/)
})

test("billing action delegates one posted interval to fenced orchestration", () => {
  const actions = readProjectFile("app", "app", "billing", "actions.ts")

  assert.match(actions, /submittedInterval\(formData\.get\("interval"\)\)/)
  assert.match(actions, /prepareBillingCheckout/)
  assert.match(actions, /createBillingCheckoutDependencies/)
  assert.doesNotMatch(actions, /checkout\.sessions\.create/)
  assert.doesNotMatch(actions, /startCheckoutAction\.bind/)
})

test("compatibility billing route preserves exact return and safe error identifiers", () => {
  const billingPage = readProjectFile("app", "app", "billing", "page.tsx")

  assert.match(billingPage, /params\.session_id/)
  assert.match(billingPage, /query\.set\("session_id", params\.session_id\)/)
  assert.match(billingPage, /params\.billing_error/)
  assert.match(
    billingPage,
    /query\.set\("billing_error", params\.billing_error\)/
  )
})

test("billing outcome cleanup removes only one-shot keys without an RSC navigation", () => {
  const cleanup = readProjectFile(
    "components",
    "merchant",
    "account",
    "billing-outcome-query-cleanup.tsx"
  )

  for (const key of ["checkout", "portal", "session_id", "billing_error"]) {
    assert.match(cleanup, new RegExp(`searchParams\\.delete\\("${key}"\\)`))
  }

  assert.match(cleanup, /window\.history\.replaceState/)
  assert.doesNotMatch(cleanup, /router\.replace/)
})

test("merchant billing readback carries exact provider terms and cancellation state", () => {
  const billing = readProjectFile("lib", "merchant", "billing.ts")

  for (const field of [
    "stripe_subscription_status",
    "stripe_subscription_created_at",
    "stripe_price_id",
    "billing_interval",
    "unit_amount",
    "currency",
    "cancel_at_period_end",
    "cancel_at",
  ]) {
    assert.match(billing, new RegExp(field))
  }
})

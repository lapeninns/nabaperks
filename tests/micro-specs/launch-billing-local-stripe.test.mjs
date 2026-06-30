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

test("Given local Stripe checkout success When billing copy is reviewed Then webhook-based sync is explicit", () => {
  // Given
  const billingPanel = readProjectFile(
    "components",
    "merchant",
    "account",
    "billing-panel.tsx"
  )
  const webhookRoute = readProjectFile(
    "app",
    "api",
    "stripe",
    "webhook",
    "route.ts"
  )

  // When / Then
  assert.match(webhookRoute, /checkout\.session\.completed/)
  assert.match(webhookRoute, /syncStripeSubscription/)
  assert.match(billingPanel, /Stripe webhook/)
  assert.match(billingPanel, /\/api\/stripe\/webhook/)
  assert.doesNotMatch(billingPanel, /will update here in a moment/)
})

test("Given a failed Stripe webhook event When Stripe retries Then the ledger claim is recoverable", () => {
  // Given
  const webhookEvents = readProjectFile("lib", "stripe", "webhook-events.ts")
  const webhookRoute = readProjectFile(
    "app",
    "api",
    "stripe",
    "webhook",
    "route.ts"
  )

  // When / Then
  assert.match(webhookEvents, /shouldRetryStripeWebhookEvent/)
  assert.match(
    webhookEvents,
    /event\.processed_at === null && event\.failed_at !== null/
  )
  assert.match(webhookEvents, /\.not\("failed_at", "is", null\)/)
  assert.match(webhookEvents, /failed_at: null/)
  assert.match(webhookRoute, /if \(claim\.status === "duplicate"\)/)
})

test("Given the launch QR panel When billing activation is checked Then it does not reference an undefined banner", () => {
  // Given
  const qrPanel = readProjectFile(
    "components",
    "merchant",
    "launch",
    "qr-panel.tsx"
  )
  const launchPage = readProjectFile("app", "app", "launch", "page.tsx")
  const launchBillingCta = readProjectFile(
    "components",
    "merchant",
    "launch",
    "launch-billing-cta.tsx"
  )

  // When / Then
  assert.doesNotMatch(qrPanel, /LaunchBillingActivationBanner/)
  assert.match(qrPanel, /LaunchSaveNextAction/)
  assert.match(launchPage, /import \{ LaunchBillingActivationBanner \}/)
  assert.match(launchBillingCta, /export function LaunchBillingActivationBanner/)
})

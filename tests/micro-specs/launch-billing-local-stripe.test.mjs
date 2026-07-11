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

test("Given local Stripe checkout success When billing sync is reviewed Then exact Session and Subscription proof is explicit", () => {
  // Given
  const checkoutReturn = readProjectFile(
    "lib",
    "merchant",
    "billing-checkout-return.ts"
  )
  const webhookEvents = readProjectFile("lib", "stripe", "webhook-events.ts")

  // When / Then
  assert.match(webhookEvents, /case "checkout\.session\.completed"/)
  assert.match(webhookEvents, /retrieveSubscription/)
  assert.match(webhookEvents, /applySubscriptionEvent/)
  assert.match(checkoutReturn, /confirmBillingCheckoutReturn/)
  assert.doesNotMatch(checkoutReturn, /syncMerchantBillingFromStripe/)
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
  assert.match(webhookEvents, /claim_stripe_webhook_event/)
  assert.match(webhookEvents, /fail_stripe_webhook_event/)
  assert.match(webhookEvents, /p_lease_id: leaseId/)
  assert.match(webhookEvents, /claim\.status === "busy"/)
  assert.match(webhookEvents, /status: 503/)
  assert.match(webhookEvents, /"Retry-After": "5"/)
  assert.match(webhookEvents, /claim\.status === "processed"/)
  assert.match(webhookRoute, /failEvent: failStripeWebhookEvent/)
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
  assert.doesNotMatch(qrPanel, /LaunchSaveNextAction/)
  assert.match(launchPage, /variant="full"/)
  assert.match(launchPage, /LaunchFlowFooter/)
  assert.match(
    launchBillingCta,
    /export function LaunchBillingActivationBanner/
  )
})

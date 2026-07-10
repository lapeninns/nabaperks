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
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

const telemetryPath = path.join(
  projectRoot,
  "lib",
  "analytics",
  "merchant-billing-events.ts"
)
const telemetryCorePath = path.join(
  projectRoot,
  "lib",
  "analytics",
  "merchant-billing-events-core.ts"
)
const telemetryExists =
  existsSync(telemetryPath) && existsSync(telemetryCorePath)
const telemetryAdapter = telemetryExists
  ? readFileSync(telemetryPath, "utf8")
  : ""
const telemetryCore = telemetryExists
  ? readFileSync(telemetryCorePath, "utf8")
  : ""
const telemetry = `${telemetryCore}\n${telemetryAdapter}`
const requiresTelemetry = telemetryExists
  ? {}
  : { skip: "merchant billing telemetry adapter is the next Green step" }

test("the server-only merchant billing telemetry adapter exists", () => {
  assert.equal(
    telemetryExists,
    true,
    "expected the pure billing milestone contract and server-only adapter"
  )
})

test(
  "the adapter owns three fixed semantic milestones without provider metadata",
  requiresTelemetry,
  () => {
    assert.match(telemetryAdapter, /import\s+["']server-only["']/)

    for (const [eventName, idempotencyKey, source] of [
      ["merchant_billing_reached", "first-entry", "merchant_billing"],
      [
        "merchant_billing_checkout_started",
        "first-session-ready",
        "stripe_checkout",
      ],
      [
        "merchant_billing_checkout_returned",
        "first-verified-return",
        "stripe_checkout",
      ],
    ]) {
      assert.match(
        telemetry,
        new RegExp(
          `eventName:\\s*["']${eventName}["'][\\s\\S]{0,180}` +
            `idempotencyKey:\\s*["']${idempotencyKey}["'][\\s\\S]{0,180}` +
            `source:\\s*["']${source}["']`
        )
      )
    }

    assert.doesNotMatch(
      telemetry,
      /session_?id|customer_?id|subscription_?id|checkout_?url|email|phone/i
    )
    assert.doesNotMatch(telemetry, /product_events|recordProductEvent/)
  }
)

test(
  "launch reach is scheduled only after the authoritative model resolves the billing gate",
  requiresTelemetry,
  () => {
    const launchPage = readProjectFile("app", "app", "launch", "page.tsx")
    const modelIndex = launchPage.indexOf("await getLaunchPageModel")
    const scheduleIndex = launchPage.indexOf(
      "scheduleMerchantBillingReached(",
      modelIndex
    )

    assert.notEqual(modelIndex, -1)
    assert.ok(scheduleIndex > modelIndex)
    assert.match(
      launchPage,
      /if\s*\(activeTab\s*===\s*["']billing["']\s*&&\s*needsBilling\)\s*\{[\s\S]{0,160}scheduleMerchantBillingReached\(merchant\.id\)/
    )
  }
)

test(
  "checkout start is scheduled only in the validated redirect branch",
  requiresTelemetry,
  () => {
    const actions = readProjectFile("app", "app", "billing", "actions.ts")
    const prepareIndex = actions.indexOf("await prepareBillingCheckout")
    const errorBranchIndex = actions.indexOf('result.status === "error"')
    const scheduleIndex = actions.indexOf(
      "scheduleMerchantBillingCheckoutStarted(",
      errorBranchIndex
    )
    const redirectIndex = actions.lastIndexOf("redirect(checkoutUrl)")

    assert.notEqual(prepareIndex, -1)
    assert.ok(errorBranchIndex > prepareIndex)
    assert.ok(scheduleIndex > errorBranchIndex)
    assert.ok(redirectIndex > scheduleIndex)
    assert.match(
      actions,
      /scheduleMerchantBillingCheckoutStarted\(merchant\.id\)/
    )
  }
)

test(
  "exact Checkout return observes only the verified seam before apply and leaves Portal untouched",
  requiresTelemetry,
  () => {
    const checkout = readProjectFile("lib", "stripe", "checkout.ts")
    const checkoutReturn = readProjectFile(
      "lib",
      "merchant",
      "billing-checkout-return.ts"
    )
    const snapshotIndex = checkout.indexOf(
      "mapProviderSubscriptionSnapshot(subscription)"
    )
    const observerIndex = checkout.indexOf("onVerifiedReturn", snapshotIndex)
    const applyIndex = checkout.indexOf(
      "deps.applyCurrentSubscription",
      observerIndex
    )

    assert.notEqual(snapshotIndex, -1)
    assert.ok(observerIndex > snapshotIndex)
    assert.ok(applyIndex > observerIndex)
    assert.match(
      checkout,
      /try\s*\{[\s\S]{0,180}onVerifiedReturn[\s\S]{0,180}\}\s*catch\s*\{/
    )
    assert.match(
      checkoutReturn,
      /confirmBillingCheckoutReturn\([\s\S]{0,260}onVerifiedReturn:[\s\S]{0,180}scheduleMerchantBillingCheckoutReturned/
    )

    const portalCall = checkoutReturn.slice(
      checkoutReturn.indexOf(
        "export async function completeBillingPortalReturn"
      )
    )
    assert.doesNotMatch(portalCall, /onVerifiedReturn/)
  }
)

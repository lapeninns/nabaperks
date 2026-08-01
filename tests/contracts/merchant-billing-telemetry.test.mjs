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
  "launch reach delegates both authoritative facts to the executable seam",
  requiresTelemetry,
  () => {
    const launchPage = readProjectFile("app", "app", "launch", "page.tsx")
    const modelIndex = launchPage.indexOf("await getLaunchPageModel")
    const scheduleIndex = launchPage.indexOf(
      "scheduleMerchantBillingReachedForLaunch(",
      modelIndex
    )

    assert.notEqual(modelIndex, -1)
    assert.ok(scheduleIndex > modelIndex)
    assert.match(launchPage, /merchantId:\s*merchant\.id/)
    assert.match(launchPage, /activeTab,\s*needsBilling/)
    assert.doesNotMatch(
      launchPage,
      /if\s*\(activeTab\s*===\s*["']billing["']\s*&&\s*needsBilling\)/
    )
  }
)

test(
  "checkout preparation delegates its exact result to the executable seam after early guards",
  requiresTelemetry,
  () => {
    const actions = readProjectFile("app", "app", "billing", "actions.ts")
    const observerIndex = actions.indexOf(
      "observeMerchantBillingCheckoutPreparation("
    )
    const prepareIndex = actions.indexOf(
      "prepareBillingCheckout",
      observerIndex
    )
    const errorBranchIndex = actions.indexOf(
      'result.status === "error"',
      prepareIndex
    )
    const redirectIndex = actions.lastIndexOf("redirect(checkoutUrl)")
    const authGuardIndex = actions.indexOf("if (!merchant)")
    const intervalGuardIndex = actions.indexOf("if (!interval)")

    assert.ok(observerIndex > intervalGuardIndex)
    assert.ok(intervalGuardIndex > authGuardIndex)
    assert.notEqual(prepareIndex, -1)
    assert.ok(errorBranchIndex > prepareIndex)
    assert.ok(redirectIndex > errorBranchIndex)
    assert.match(actions, /merchant\.id,\s*async\s*\(\)\s*=>/)
    assert.doesNotMatch(actions, /scheduleMerchantBillingCheckoutStarted\(/)
  }
)

test(
  "exact Checkout return observes only the verified seam before apply and leaves Portal untouched",
  requiresTelemetry,
  () => {
    const checkout = readProjectFile("lib", "stripe", "checkout-return.ts")
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

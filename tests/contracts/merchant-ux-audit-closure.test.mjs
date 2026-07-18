import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function source(relativePath) {
  const absolutePath = path.join(projectRoot, relativePath)
  return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : ""
}

const facts = source("lib/marketing/facts.ts")
const signup = source("app/(auth)/signup/page.tsx")
const activationCard = source(
  "components/merchant/account/billing-activation-card.tsx"
)
const billingPanel = source(
  "components/merchant/account/billing-panel-view.tsx"
)
const onboardingOrientation = source(
  "components/merchant/onboarding-journey-orientation.tsx"
)
const launchPage = source("app/app/launch/page.tsx")
const launchHarness = source("app/dev/app-harness/launch/page.tsx")
const onboardingPage = source("app/app/onboarding/page.tsx")
const onboardingHarness = source("app/dev/app-harness/onboarding/page.tsx")

test("the Growth Plan name is single-sourced across activation and account billing", () => {
  assert.match(facts, /planName:\s*["']Growth Plan["']/)
  assert.match(activationCard, /PRODUCT\.planName/)
  assert.match(activationCard, /<BillingCheckoutForm[\s\S]*?stacked/)
  assert.match(billingPanel, /PRODUCT\.planName/)
})

test("kept merchant flows consistently place billing before venue QR", () => {
  assert.match(facts, /activate billing, then set up your venue QR/)
  assert.match(
    signup,
    /venue, card and rewards, then activate billing to unlock your QR/
  )
})

test("launch billing no longer promises a built QR before activation", () => {
  assert.match(launchPage, /completeBillingCheckoutReturn/)
  assert.doesNotMatch(launchHarness, /BillingActivationAssetPreview/)
  assert.match(launchHarness, /<QrPanel/)
})

test("production and harness onboarding share summary and roadmap components", () => {
  assert.notEqual(
    onboardingOrientation,
    "",
    "shared onboarding orientation component exists"
  )
  assert.match(onboardingOrientation, /variant:\s*["']summary["']/)
  assert.match(onboardingOrientation, /variant:\s*["']roadmap["']/)
  assert.match(onboardingOrientation, /card, rewards,\s*billing and QR/)
  assert.match(onboardingPage, /OnboardingJourneyOrientation/)
  assert.match(onboardingHarness, /OnboardingJourneyOrientation/)
})

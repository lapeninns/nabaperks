import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { test } from "node:test"

const read = (path) => (existsSync(path) ? readFileSync(path, "utf8") : "")

const dashboard = read("app/app/page.tsx")
const dashboardHarness = read("app/dev/app-harness/dashboard/page.tsx")
const launchHarness = read("app/dev/app-harness/launch/page.tsx")
const dashboardActions = read(
  "components/merchant/dashboard-header-actions.tsx"
)
const readinessPanel = read("components/merchant/launch-readiness-panel.tsx")
const qrPanel = read("components/merchant/launch/qr-panel-live.tsx")
const emailPosterButton = read(
  "components/merchant/launch/email-poster-button.tsx"
)
const cardForm = read("components/merchant/loyalty-card-form.tsx")
const rewardsPanel = read("components/merchant/launch/rewards-panel.tsx")
const billingActivation = read(
  "components/merchant/account/billing-activation-card.tsx"
)
const billingPanel = read("components/merchant/account/billing-panel-view.tsx")

test("dashboard production and harness share one readiness-driven header action", () => {
  assert.match(dashboard, /MerchantDashboardHeaderActions/)
  assert.match(dashboardHarness, /MerchantDashboardHeaderActions/)
  assert.match(dashboardActions, /isVenueOperational\(readiness\)/)
  assert.match(dashboardActions, /Finish setup/)
  assert.match(dashboardActions, /Scan reward/)
  assert.match(dashboardHarness, /requiresBilling:\s*true/)
})

test("launch rails identify themselves as navigation and expose honest step states", () => {
  assert.match(readinessPanel, /<nav[^>]+aria-label="Merchant setup steps"/)
  assert.match(readinessPanel, /Choose a setup step/)
  assert.match(readinessPanel, /focus-ring/)
  assert.match(readinessPanel, /isNext\s*\?\s*"next up"/)
  assert.match(readinessPanel, /min-h-11/)
})

test("poster follow-through consumes the live promo and names the attached PDFs honestly", () => {
  assert.match(qrPanel, /getActivePromo/)
  assert.match(qrPanel, /promo\.perk/)
  assert.match(qrPanel, /promo\.claim/)
  assert.doesNotMatch(qrPanel, /on its way/i)
  assert.match(emailPosterButton, /Email poster PDFs/)
  assert.match(emailPosterButton, /Emailing PDFs…/)
  assert.match(emailPosterButton, /Could not send poster PDFs/)
  assert.doesNotMatch(emailPosterButton, /Email poster link/)
})

test("the launch rail owns global progress while QR keeps its local task order", () => {
  assert.doesNotMatch(cardForm, /step="Step 2"/)
  assert.doesNotMatch(rewardsPanel, /Step 3 · Rewards/)
  assert.doesNotMatch(billingActivation, /Step 5 of 5/)
  assert.doesNotMatch(billingPanel, /Step 5 of 5/)
  assert.match(qrPanel, /step="01"/)
  assert.match(qrPanel, /step="02"/)
})

test("launch harness QR state is derived from readiness", () => {
  assert.match(launchHarness, /isActive=\{readiness\.tabs\.qr\}/)
  assert.match(launchHarness, /scansAvailable=\{readiness\.launchReady\}/)
})

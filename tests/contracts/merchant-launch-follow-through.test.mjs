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
const qrWorkspace = read("components/merchant/launch/qr-redesign-concept.tsx")
const emailPosterButton = read(
  "components/merchant/launch/email-poster-button.tsx"
)
const posterActions = read("app/app/qr/actions.ts")
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
  assert.match(dashboardActions, /Scan code/)
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
  assert.match(emailPosterButton, /Email print kit PDFs/)
  assert.match(emailPosterButton, /Emailing PDFs…/)
  assert.match(emailPosterButton, /Could not send print kit PDFs/)
  assert.doesNotMatch(emailPosterButton, /Email poster link/)
  assert.match(posterActions, /enforceRateLimit/)
  assert.match(posterActions, /poster-email:\$\{merchant\.id\}/)
  assert.match(posterActions, /up to 3 times an hour/)
  assert.match(posterActions, /buildNfcCardPdfAttachments/)
  assert.match(posterActions, /buildNfcSquarePdfAttachments/)
  assert.match(qrWorkspace, /NfcCardLinks/)
  assert.match(qrWorkspace, /NfcSquareLinks/)
  assert.match(qrPanel, /productionNfcHref/)
  assert.match(qrPanel, /productionNfcSquareHref/)
  assert.doesNotMatch(posterActions, /emailing the poster[."']/)
  assert.doesNotMatch(posterActions, /Could not email the poster just now/)
})

test("the launch rail owns global progress while QR uses distribution choices", () => {
  assert.doesNotMatch(cardForm, /step="Step 2"/)
  assert.doesNotMatch(rewardsPanel, /Step 3 · Rewards/)
  assert.doesNotMatch(billingActivation, /Step 5 of 5/)
  assert.doesNotMatch(billingPanel, /Step 5 of 5/)
  assert.match(qrPanel, /QrWorkspace/)
  assert.match(qrWorkspace, /Print for the till/)
  assert.match(qrWorkspace, /Share digitally/)
  assert.doesNotMatch(qrWorkspace, /step="01"/)
  assert.doesNotMatch(qrWorkspace, /step="02"/)
})

test("launch harness exposes billing-locked, lapsed, paused, QR-ready, and live states", () => {
  for (const state of ["billing", "lapsed", "paused", "qr", "live"]) {
    assert.match(launchHarness, new RegExp(`value === ["']${state}["']`))
  }
  assert.match(launchHarness, /<QrPanel/)
  assert.match(launchHarness, /billingHref=\{billingHref\}/)
})

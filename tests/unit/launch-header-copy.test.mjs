import assert from "node:assert/strict"
import { test } from "node:test"

import { LAUNCH_MIN_ACTIVE_REWARDS } from "@/lib/merchant/launch-readiness-contract"
import { buildLaunchReadiness } from "@/lib/merchant/launch-readiness-core"
import { resolveLaunchHeaderModel } from "@/lib/merchant/launch-header-copy"

// --- fixtures --------------------------------------------------------------

const activeCard = {
  id: "card_1",
  card_name: "Card",
  reward_name: "Reward",
  stamps_required: 8,
}

function venue(overrides = {}) {
  return {
    id: "loc_1",
    name: "Venue",
    address: "1 High St",
    latitude: 51.5,
    longitude: -0.1,
    geofence_radius_meters: 100,
    require_geofence: false,
    geocoded_at: null,
    ...overrides,
  }
}

function joinQr(is_active) {
  return { id: "qr_1", qr_id: "q", destination_type: "join", is_active }
}

/** venue+card+rewards ready, QR not live, billing pending → nextStep = qr. */
const midSetup = buildLaunchReadiness({
  activeCard,
  activeRewardPoolItemCount: LAUNCH_MIN_ACTIVE_REWARDS,
  qrCode: joinQr(false),
  location: venue(),
  billing: { requiresBilling: true, status: null },
})

/** venue+card+rewards+QR ready, billing the only pending step → needsBilling. */
const needsBilling = buildLaunchReadiness({
  activeCard,
  activeRewardPoolItemCount: LAUNCH_MIN_ACTIVE_REWARDS,
  qrCode: joinQr(true),
  location: venue(),
  billing: { requiresBilling: true, status: null },
})

/** Everything ready, billing not required → launchReady. */
const live = buildLaunchReadiness({
  activeCard,
  activeRewardPoolItemCount: LAUNCH_MIN_ACTIVE_REWARDS,
  qrCode: joinQr(true),
  location: venue(),
  billing: { requiresBilling: false, status: null },
})

// --- mid-setup -------------------------------------------------------------

test("mid-setup: next-step heading + progress context, no header CTA", () => {
  const header = resolveLaunchHeaderModel(midSetup, "card")

  assert.equal(header.heading, "Bring your venue to life")
  assert.match(header.mobileContext, /steps done\. Next: /)
  // No jump-CTA until the flow is either live or blocked on billing.
  assert.equal(header.actionTab, null)
})

// --- needsBilling: information hierarchy ------------------------------------

test("needsBilling: heading states the progress, context states what's LEFT", () => {
  const header = resolveLaunchHeaderModel(needsBilling, "venue")

  assert.equal(header.heading, "One step from live")
  assert.equal(header.mobileContext, "The last step before your venue goes live.")
  // The context and description must not repeat the heading text (the redundant
  // triple this pass removed).
  assert.doesNotMatch(header.mobileContext, /account is created/i)
  assert.doesNotMatch(header.description, /account is created/i)
})

// --- needsBilling: interaction hierarchy (CTA never competes) ---------------

test("needsBilling: header CTA jumps to billing from any non-billing tab", () => {
  for (const tab of ["venue", "card", "rewards", "qr"]) {
    assert.equal(
      resolveLaunchHeaderModel(needsBilling, tab).actionTab,
      "billing",
      `expected a billing jump-CTA on tab=${tab}`
    )
  }
})

test("needsBilling: header CTA is SUPPRESSED on the billing tab", () => {
  // On the billing tab the activation card carries the real Stripe checkout, so
  // a header "Proceed to billing" would be a no-op competing with it.
  assert.equal(resolveLaunchHeaderModel(needsBilling, "billing").actionTab, null)
})

// --- launchReady: information + interaction hierarchy -----------------------

test("launchReady: heading is live, description does not repeat the panel banner", () => {
  const header = resolveLaunchHeaderModel(live, "venue")

  assert.equal(header.heading, "You're live")
  // The readiness panel banner already prints "Customers can scan…"; the header
  // must stay additive and not duplicate that sentence.
  assert.doesNotMatch(header.description, /Customers can scan/i)
})

test("launchReady: header CTA jumps to the QR from any non-qr tab", () => {
  for (const tab of ["venue", "card", "rewards", "billing"]) {
    assert.equal(
      resolveLaunchHeaderModel(live, tab).actionTab,
      "qr",
      `expected a QR jump-CTA on tab=${tab}`
    )
  }
})

test("launchReady: header CTA is SUPPRESSED on the qr tab", () => {
  assert.equal(resolveLaunchHeaderModel(live, "qr").actionTab, null)
})

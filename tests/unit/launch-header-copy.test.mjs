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

/** venue+card+rewards ready, billing pending, QR not live → billing first. */
const needsBilling = buildLaunchReadiness({
  activeCard,
  activeRewardPoolItemCount: LAUNCH_MIN_ACTIVE_REWARDS,
  qrCode: joinQr(false),
  location: venue(),
  billing: { requiresBilling: true, status: null },
})

/** venue+card+rewards+billing ready, QR not live → QR is the final step. */
const needsQr = buildLaunchReadiness({
  activeCard,
  activeRewardPoolItemCount: LAUNCH_MIN_ACTIVE_REWARDS,
  qrCode: joinQr(false),
  location: venue(),
  billing: { requiresBilling: true, status: "active" },
})

/** Everything ready, billing not required → launchReady. */
const live = buildLaunchReadiness({
  activeCard,
  activeRewardPoolItemCount: LAUNCH_MIN_ACTIVE_REWARDS,
  qrCode: joinQr(true),
  location: venue(),
  billing: { requiresBilling: false, status: null },
})

// --- needsBilling: information hierarchy ------------------------------------

test("needsBilling: activation truthfully unlocks the QR", () => {
  const header = resolveLaunchHeaderModel(needsBilling, "venue")

  assert.equal(header.heading, "Activate to unlock your QR")
  assert.equal(
    header.mobileContext,
    "Start your free trial, then create your venue QR."
  )
  assert.match(header.description, /free trial/i)
  assert.match(header.description, /venue QR/i)
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
  assert.equal(
    resolveLaunchHeaderModel(needsBilling, "billing").actionTab,
    null
  )
})

// --- needsQr: information + interaction hierarchy --------------------------

test("needsQr: the QR is the final step after billing", () => {
  const header = resolveLaunchHeaderModel(needsQr, "venue")

  assert.equal(header.heading, "One step from live")
  assert.equal(
    header.mobileContext,
    "Create your venue QR to start accepting scans."
  )
  assert.equal(header.actionTab, "qr")
})

test("needsQr: header CTA is suppressed on the QR tab", () => {
  assert.equal(resolveLaunchHeaderModel(needsQr, "qr").actionTab, null)
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

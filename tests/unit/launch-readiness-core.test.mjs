import assert from "node:assert/strict"
import { test } from "node:test"

import { LAUNCH_MIN_ACTIVE_REWARDS } from "@/lib/merchant/launch-readiness-contract"
import {
  buildLaunchReadiness,
  isJoinQrProvisionEligible,
  isLaunchBillingReady,
  isLaunchSetupCompleteWithoutQr,
  needsLaunchBillingActivation,
  resolveLaunchActiveTab,
  resolveLaunchBillingHref,
  resolveRewardsContinueHref,
  rewardsContinueLabel,
} from "@/lib/merchant/launch-readiness-core"
import { QR_LAUNCH_TAB_PATH, QR_POSTER_PATH } from "@/lib/merchant/qr-nav"

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

function activeQr(is_active = true) {
  return { id: "qr_1", qr_id: "q", destination_type: "join", is_active }
}

/** A fully-ready, billing-not-required setup. */
function readyInput(overrides = {}) {
  return {
    activeCard,
    activeRewardPoolItemCount: LAUNCH_MIN_ACTIVE_REWARDS,
    qrCode: activeQr(true),
    location: venue(),
    ...overrides,
  }
}

// --- buildLaunchReadiness: per-step gating ---------------------------------

test("empty setup: nothing ready, first incomplete step is venue", () => {
  const r = buildLaunchReadiness({
    activeCard: null,
    activeRewardPoolItemCount: 0,
    qrCode: null,
    location: null,
  })

  assert.deepEqual(r.tabs, {
    venue: false,
    card: false,
    rewards: false,
    qr: false,
  })
  assert.equal(r.launchReady, false)
  assert.equal(r.completed, 0)
  assert.equal(r.total, 4) // venue, card, rewards, qr (no billing item without billing arg)
  assert.equal(r.nextStep?.id, "venue")
})

test("reward gating keys off LAUNCH_MIN_ACTIVE_REWARDS exactly", () => {
  const below = buildLaunchReadiness(
    readyInput({ activeRewardPoolItemCount: LAUNCH_MIN_ACTIVE_REWARDS - 1 })
  )
  const atThreshold = buildLaunchReadiness(
    readyInput({ activeRewardPoolItemCount: LAUNCH_MIN_ACTIVE_REWARDS })
  )

  assert.equal(below.tabs.rewards, false)
  assert.equal(atThreshold.tabs.rewards, true)
})

test("venue readiness: address required, coords only when geofenced", () => {
  const noAddress = buildLaunchReadiness(
    readyInput({ location: venue({ address: null }) })
  )
  const noGeofence = buildLaunchReadiness(
    readyInput({
      location: venue({ require_geofence: false, latitude: null, longitude: null }),
    })
  )
  const geofencedNoCoords = buildLaunchReadiness(
    readyInput({
      location: venue({ require_geofence: true, latitude: null, longitude: null }),
    })
  )
  const geofencedWithCoords = buildLaunchReadiness(
    readyInput({ location: venue({ require_geofence: true }) })
  )

  assert.equal(noAddress.tabs.venue, false)
  assert.equal(noGeofence.tabs.venue, true)
  assert.equal(geofencedNoCoords.tabs.venue, false)
  assert.equal(geofencedWithCoords.tabs.venue, true)
})

test("qr readiness requires an active QR", () => {
  assert.equal(buildLaunchReadiness(readyInput({ qrCode: null })).tabs.qr, false)
  assert.equal(
    buildLaunchReadiness(readyInput({ qrCode: activeQr(false) })).tabs.qr,
    false
  )
  assert.equal(
    buildLaunchReadiness(readyInput({ qrCode: activeQr(true) })).tabs.qr,
    true
  )
})

test("qr step href flips to the poster path once active", () => {
  const inactive = buildLaunchReadiness(readyInput({ qrCode: null }))
  const active = buildLaunchReadiness(readyInput())
  const qrStep = (r) => r.steps.find((s) => s.id === "qr")

  assert.equal(qrStep(inactive).href, QR_LAUNCH_TAB_PATH)
  assert.equal(qrStep(active).href, QR_POSTER_PATH)
})

// --- buildLaunchReadiness: billing gate ------------------------------------

test("billing checklist item only appears when billing is provided", () => {
  const withoutBilling = buildLaunchReadiness(readyInput())
  const withBilling = buildLaunchReadiness(
    readyInput({ billing: { requiresBilling: true, status: "active" } })
  )

  assert.equal(withoutBilling.total, 4)
  assert.equal(withBilling.total, 5)
  assert.ok(withBilling.checklist.some((s) => s.id === "billing"))
})

test("billing gate fails closed on null/unknown status, opens on active/trial", () => {
  const cases = [
    [{ requiresBilling: true, status: null }, false],
    [{ requiresBilling: true, status: "past_due" }, false],
    [{ requiresBilling: true, status: "cancelled" }, false],
    [{ requiresBilling: true, status: "incomplete" }, false],
    [{ requiresBilling: true, status: "active" }, true],
    [{ requiresBilling: true, status: "trialing" }, true],
    [{ requiresBilling: true, status: "trial" }, true], // normalized
    [{ requiresBilling: false, status: null }, true], // billing not required
  ]

  for (const [billing, expected] of cases) {
    assert.equal(
      isLaunchBillingReady(billing),
      expected,
      `status=${billing.status} requires=${billing.requiresBilling}`
    )
    const r = buildLaunchReadiness(readyInput({ billing }))
    assert.equal(
      r.launchReady,
      expected,
      `launchReady for status=${billing.status}`
    )
  }
})

test("billing-gated setup: everything else ready, billing is the next step", () => {
  const r = buildLaunchReadiness(
    readyInput({ billing: { requiresBilling: true, status: null } })
  )

  assert.equal(r.launchReady, false)
  assert.equal(r.nextStep?.id, "billing")
  assert.equal(needsLaunchBillingActivation(r), true)
  assert.equal(resolveLaunchBillingHref(r), "/app/launch?tab=billing")
})

test("isLaunchSetupCompleteWithoutQr: true only when the QR is the lone gap", () => {
  const onlyQrMissing = buildLaunchReadiness(readyInput({ qrCode: null }))
  const billingPending = buildLaunchReadiness(
    readyInput({ billing: { requiresBilling: true, status: null } })
  )

  assert.equal(isLaunchSetupCompleteWithoutQr(onlyQrMissing.checklist), true)
  // Billing is a non-QR step, so a pending billing gate makes this false.
  assert.equal(isLaunchSetupCompleteWithoutQr(billingPending.checklist), false)
})

test("fully ready (billing active) launches with no next step", () => {
  const r = buildLaunchReadiness(
    readyInput({ billing: { requiresBilling: true, status: "active" } })
  )

  assert.equal(r.launchReady, true)
  assert.equal(r.completed, r.total)
  assert.equal(r.nextStep, null)
  assert.equal(needsLaunchBillingActivation(r), false)
  assert.equal(resolveLaunchBillingHref(r), null)
})

// --- QR provisioning eligibility -------------------------------------------

test("isJoinQrProvisionEligible: all gates required, QR not already active", () => {
  const base = {
    merchantId: "m1",
    activeCard: { id: "card_1" },
    activeRewardPoolItemCount: LAUNCH_MIN_ACTIVE_REWARDS,
    venueReady: true,
    qrCode: null,
  }

  assert.equal(isJoinQrProvisionEligible(base), true)
  assert.equal(isJoinQrProvisionEligible({ ...base, activeCard: null }), false)
  assert.equal(
    isJoinQrProvisionEligible({
      ...base,
      activeRewardPoolItemCount: LAUNCH_MIN_ACTIVE_REWARDS - 1,
    }),
    false
  )
  assert.equal(isJoinQrProvisionEligible({ ...base, venueReady: false }), false)
  assert.equal(
    isJoinQrProvisionEligible({ ...base, qrCode: { id: "q", is_active: true } }),
    false,
    "already-active QR is not eligible"
  )
  assert.equal(
    isJoinQrProvisionEligible({ ...base, qrCode: { id: "q", is_active: false } }),
    true,
    "inactive QR is eligible (re-enable)"
  )
})

// --- view derivations ------------------------------------------------------

test("resolveLaunchActiveTab: valid request wins, else next step, else qr", () => {
  const incomplete = buildLaunchReadiness({
    activeCard: null,
    activeRewardPoolItemCount: 0,
    qrCode: null,
    location: null,
  })
  const ready = buildLaunchReadiness(readyInput())

  assert.equal(resolveLaunchActiveTab("billing", incomplete), "billing")
  assert.equal(resolveLaunchActiveTab(undefined, incomplete), "venue")
  assert.equal(resolveLaunchActiveTab("bogus", incomplete), "venue")
  assert.equal(resolveLaunchActiveTab(undefined, ready), "qr")
})

test("resolveRewardsContinueHref: null until pool ready, then routes onward", () => {
  const poolShort = buildLaunchReadiness(
    readyInput({ activeRewardPoolItemCount: 0, qrCode: null })
  )
  const needsQr = buildLaunchReadiness(readyInput({ qrCode: null }))
  // QR active but billing pending -> billing is the immediate next step.
  const needsBilling = buildLaunchReadiness(
    readyInput({ billing: { requiresBilling: true, status: null } })
  )

  assert.equal(resolveRewardsContinueHref(poolShort), null)
  // QR not live yet takes precedence over a not-yet-due billing step.
  assert.equal(resolveRewardsContinueHref(needsQr), QR_LAUNCH_TAB_PATH)
  assert.equal(resolveRewardsContinueHref(needsBilling), "/app/launch?tab=billing")
})

test("rewardsContinueLabel maps hrefs to copy", () => {
  assert.equal(rewardsContinueLabel(null), "the next step")
  assert.equal(rewardsContinueLabel("/app/launch?tab=billing"), "billing")
  assert.equal(rewardsContinueLabel(QR_LAUNCH_TAB_PATH), "your venue QR")
})

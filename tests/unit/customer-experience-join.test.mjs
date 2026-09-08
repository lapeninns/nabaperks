import assert from "node:assert/strict"
import { test } from "node:test"

import { deriveCustomerExperience } from "@/lib/customer/experience/derive"
import {
  getCustomerExperienceViewModel,
  joinCompletionHint,
} from "@/lib/customer/experience/copy"

const merchant = {
  name: "The Old Crown",
  slug: "old-crown",
  termsUrl: "/terms",
}
const card = {
  name: "Regulars Card",
  stampsRequired: 5,
  rewardTerms: "House terms",
}
const location = { requireGeofence: false, geofenceRadiusMeters: 150 }

function context(overrides = {}) {
  return {
    merchant,
    card,
    hasSession: false,
    pendingOtp: false,
    membership: null,
    location,
    ...overrides,
  }
}

test("a QR welcome leads with value and keeps progress linked to the number", () => {
  const experience = deriveCustomerExperience({
    entry: "join",
    context: context({ qrId: "venue-qr" }),
  })
  const viewModel = getCustomerExperienceViewModel(experience)

  assert.equal(experience.kind, "join_welcome")
  assert.equal(viewModel.headline, "Your first stamp is ready")
  assert.match(viewModel.supportLine, /^Save it to your number/)
  assert.match(viewModel.supportLine, /No app, no password/)
  assert.equal(viewModel.primaryAction?.label, "Claim my first stamp")
})

test("join completion copy keeps the promise without overstating QR proof or leaking policy", () => {
  assert.match(joinCompletionHint({ hasQr: true }), /stamp and card stay saved/)
  assert.match(
    joinCompletionHint({ hasQr: false }),
    /ready for your first visit/
  )
  for (const hasQr of [true, false]) {
    assert.doesNotMatch(joinCompletionHint({ hasQr }), /location|business day/i)
  }
})

test("a direct verified join uses honest save-card copy", () => {
  const experience = deriveCustomerExperience({
    entry: "join",
    context: context({ hasSession: true }),
  })
  assert.equal(experience.kind, "join_terms")
  assert.equal(
    getCustomerExperienceViewModel(experience).headline,
    "Save your loyalty card"
  )
})

test("a QR verified join keeps first-stamp copy", () => {
  const experience = deriveCustomerExperience({
    entry: "join",
    context: context({ hasSession: true, qrId: "venue-qr" }),
  })
  assert.equal(experience.kind, "join_terms")
  assert.equal(
    getCustomerExperienceViewModel(experience).headline,
    "Collect your first stamp"
  )
})

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
  assert.match(
    viewModel.supportLine,
    /^New here\? Your first stamp is waiting\./
  )
  assert.match(viewModel.supportLine, /progress linked to your number/)
  assert.equal(viewModel.primaryAction?.label, "Get today's stamp")
})

test("join completion copy preserves progress without overstating QR proof", () => {
  assert.match(
    joinCompletionHint({ hasQr: true, requireGeofence: false }),
    /collect today's stamp/
  )
  assert.match(
    joinCompletionHint({ hasQr: true, requireGeofence: true }),
    /Location checks begin on later qualifying visits/
  )
  assert.match(
    joinCompletionHint({ hasQr: false, requireGeofence: false }),
    /ready for your first venue scan/
  )
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

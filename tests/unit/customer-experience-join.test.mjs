import assert from "node:assert/strict"
import { test } from "node:test"

import { deriveCustomerExperience } from "@/lib/customer/experience/derive"
import { getCustomerExperienceViewModel } from "@/lib/customer/experience/copy"

const merchant = { name: "The Old Crown", slug: "old-crown", termsUrl: "/terms" }
const card = { name: "Regulars Card", stampsRequired: 5, rewardTerms: "House terms" }
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

test("a direct verified join uses honest save-card copy", () => {
  const experience = deriveCustomerExperience({
    entry: "join",
    context: context({ hasSession: true }),
  })
  assert.equal(experience.kind, "join_terms")
  assert.equal(getCustomerExperienceViewModel(experience).headline, "Save your loyalty card")
})

test("a QR verified join keeps first-stamp copy", () => {
  const experience = deriveCustomerExperience({
    entry: "join",
    context: context({ hasSession: true, qrId: "venue-qr" }),
  })
  assert.equal(experience.kind, "join_terms")
  assert.equal(getCustomerExperienceViewModel(experience).headline, "Collect your first stamp")
})

import assert from "node:assert/strict"
import { test } from "node:test"

import { parseVenueLocationSubmission } from "../../lib/merchant/venue-location-submission.ts"

test("Given a forged venueName When launch parses the form Then the canonical merchant name wins", () => {
  const formData = new FormData()
  formData.set("venueName", "Forged branch name")

  const submission = parseVenueLocationSubmission(formData, {
    canonicalVenueName: "Old Crown Girton",
  })

  assert.equal(submission.venueName, "Old Crown Girton")
})

test("Given a forged locationName When onboarding parses the form Then the canonical venue name wins", () => {
  const formData = new FormData()
  formData.set("locationName", "Forged location name")

  const submission = parseVenueLocationSubmission(formData, {
    canonicalVenueName: "Old Crown Girton",
  })

  assert.equal(submission.venueName, "Old Crown Girton")
})

test("Given an empty canonical name When a forged name is submitted Then required-name validation stays reachable", () => {
  const formData = new FormData()
  formData.set("venueName", "Forged fallback")

  const submission = parseVenueLocationSubmission(formData, {
    canonicalVenueName: "",
  })

  assert.equal(submission.venueName, "")
})

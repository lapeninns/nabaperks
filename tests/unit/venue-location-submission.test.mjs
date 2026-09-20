import assert from "node:assert/strict"
import { test } from "node:test"

import {
  isValidTradingDayStart,
  parseVenueLocationSubmission,
} from "../../lib/merchant/venue-location-submission.ts"

test("venue trading-day rollover accepts midnight through midday only", () => {
  for (const value of ["00:00", "04:59", "05:00", "11:45", "12:00"]) {
    assert.equal(isValidTradingDayStart(value), true, value)
  }
  for (const value of ["", "5:00", "12:01", "23:00", "00:60"]) {
    assert.equal(isValidTradingDayStart(value), false, value)
  }
})

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

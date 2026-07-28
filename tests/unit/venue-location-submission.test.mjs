import assert from "node:assert/strict"
import { test } from "node:test"

import {
  parseVenueLocationSubmission,
  resolveVenueLocationPersistencePayload,
} from "../../lib/merchant/venue-location-submission.ts"

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

test("manual onboarding remains saveable when the geocoder is unavailable", async () => {
  const result = await resolveVenueLocationPersistencePayload(
    manualSubmission({ requireGeofence: false }),
    {
      radius: 150,
      manualPin: null,
      geocodeAddress: async () => null,
    }
  )

  assert.ok("payload" in result)
  assert.equal(result.payload.latitude, null)
  assert.equal(result.payload.longitude, null)
  assert.equal(result.payload.geofence_pin_source, "unresolved")
})

test("unresolved coordinates fail closed when GPS anomaly checks are enabled", async () => {
  const result = await resolveVenueLocationPersistencePayload(
    manualSubmission({ requireGeofence: true }),
    {
      radius: 150,
      manualPin: null,
      geocodeAddress: async () => null,
    }
  )

  assert.ok("errors" in result)
  assert.match(result.errors.form, /verified place|map pin/i)
})

function manualSubmission({ requireGeofence }) {
  return {
    venueName: "Old Crown Girton",
    addressFields: {
      addressLine1: "89 High Street",
      addressLine2: "",
      addressCity: "Cambridge",
      addressPostcode: "CB3 0QD",
    },
    geofenceRadiusMeters: "150",
    requireGeofence,
    softGeofenceTriggerStamp: "3",
    geofencePinSource: "unresolved",
    venueLatitude: "",
    venueLongitude: "",
    addressSource: "manual_entry",
    addressProvider: "",
    addressProviderId: "",
    providerLatitude: "",
    providerLongitude: "",
  }
}

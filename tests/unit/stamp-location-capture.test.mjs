import assert from "node:assert/strict"
import { afterEach, test } from "node:test"

import {
  addLocationCapture,
  resolveStampLocation,
  shouldAttemptStampLocation,
  SOFT_GPS_CAPTURE_TIMEOUT_MS,
} from "@/lib/customer/stamp-location-capture"

const PERMISSION_DENIED = 1
const POSITION_UNAVAILABLE = 2
const TIMEOUT = 3

test("location capture follows the lifetime visit threshold", () => {
  assert.equal(shouldAttemptStampLocation(false, 9, 3), false)
  assert.equal(shouldAttemptStampLocation(true, 2, 3), false)
  assert.equal(shouldAttemptStampLocation(true, 3, 3), true)
  assert.equal(shouldAttemptStampLocation(true, 7, 3), true)
  assert.equal(shouldAttemptStampLocation(true, 4, 5), false)
  assert.equal(shouldAttemptStampLocation(true, 5, 5), true)
})

test("soft GPS waits long enough for an indoor fix", () => {
  assert.equal(SOFT_GPS_CAPTURE_TIMEOUT_MS, 10_000)
})

afterEach(() => {
  Reflect.deleteProperty(globalThis, "navigator")
})

test("a late GPS fix inside the wait is granted instead of timed out", async () => {
  installGeolocation((success, _error, options) => {
    assert.equal(options?.timeout, 80)
    assert.equal(options?.maximumAge, 0)
    assert.equal(options?.enableHighAccuracy, true)
    setTimeout(() => {
      success({
        coords: { latitude: 52.208, longitude: 0.091, accuracy: 18 },
      })
    }, 40)
  })

  const capture = await resolveStampLocation(true, 80)
  assert.equal(capture?.locationStatus, "granted")
  assert.equal(capture?.latitude, 52.208)
  assert.equal(capture?.longitude, 0.091)
})

test("a hung geolocation request times out after the wait", async () => {
  installGeolocation(() => {})
  const capture = await resolveStampLocation(true, 20)
  assert.equal(capture?.locationStatus, "timeout")
  assert.equal(capture?.latitude, null)
})

test("a browser timeout is recorded as timeout", async () => {
  installGeolocation((_success, error) => {
    error(geoError(TIMEOUT))
  })
  const capture = await resolveStampLocation(true, 80)
  assert.equal(capture?.locationStatus, "timeout")
})

test("a blocked permission skips GPS because the OS will not prompt again", async () => {
  let called = 0
  installGeolocation(() => {
    called += 1
  }, "denied")
  const capture = await resolveStampLocation(true, 80)
  assert.equal(capture?.locationStatus, "denied_remembered")
  assert.equal(called, 0)
})

test("a later Allow is captured even after a previous denial", async () => {
  installGeolocation((_success, error) => {
    error(geoError(PERMISSION_DENIED))
  })
  const denied = await resolveStampLocation(true, 80)
  assert.equal(denied?.locationStatus, "denied")

  installGeolocation((success) => {
    success({
      coords: { latitude: 52.208, longitude: 0.091, accuracy: 18 },
    })
  }, "granted")
  const capture = await resolveStampLocation(true, 80)
  assert.equal(capture?.locationStatus, "granted")
  assert.equal(capture?.latitude, 52.208)
})

test("prompt permission still asks the browser so the dialog can return", async () => {
  let called = 0
  installGeolocation((success) => {
    called += 1
    success({
      coords: { latitude: 52.208, longitude: 0.091, accuracy: 18 },
    })
  }, "prompt")
  const capture = await resolveStampLocation(true, 80)
  assert.equal(called, 1)
  assert.equal(capture?.locationStatus, "granted")
})

test("location capture is attached to the stamp form", () => {
  const formData = new FormData()
  addLocationCapture(formData, {
    latitude: 52.2,
    longitude: 0.1,
    accuracyMeters: 12,
    locationStatus: "granted",
    captureElapsedMs: 2400,
  })
  assert.equal(formData.get("location_status"), "granted")
  assert.equal(formData.get("capture_elapsed_ms"), "2400")
  assert.equal(formData.get("latitude"), "52.2")
})

function installGeolocation(impl, permission) {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      geolocation: { getCurrentPosition: impl },
      ...(permission
        ? {
            permissions: {
              query: async () => ({ state: permission }),
            },
          }
        : {}),
    },
  })
}

function geoError(code) {
  return {
    code,
    PERMISSION_DENIED,
    POSITION_UNAVAILABLE,
    TIMEOUT,
    message: "geo",
  }
}

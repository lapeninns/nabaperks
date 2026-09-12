import assert from "node:assert/strict"
import { afterEach, test } from "node:test"

import {
  addLocationCapture,
  decideCaptureSubmission,
  geolocationPermissionState,
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
  Reflect.deleteProperty(globalThis, "localStorage")
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

test("a request the browser has not answered stays open until the caller abandons it", async () => {
  // The browser's own timeout does not start until permission is granted, so
  // a customer reading the permission sheet must not be timed out from here.
  installGeolocation(() => {})
  const controller = new AbortController()
  let settled = false
  const pending = resolveStampLocation(true, 20, controller.signal).then(
    (capture) => {
      settled = true
      return capture
    }
  )
  await new Promise((resolve) => setTimeout(resolve, 60))
  assert.equal(settled, false, "no self-imposed deadline fired")

  controller.abort()
  const capture = await pending
  assert.equal(capture?.locationStatus, "cancelled")
  assert.equal(capture?.latitude, null)
})

test("a fix that arrives after the caller abandoned the wait is ignored", async () => {
  let deliver
  installGeolocation((success) => {
    deliver = success
  })
  const controller = new AbortController()
  const pending = resolveStampLocation(true, 80, controller.signal)
  controller.abort()
  const capture = await pending
  assert.equal(capture?.locationStatus, "cancelled")

  // The late success must not resurface as anything.
  deliver({ coords: { latitude: 52.208, longitude: 0.091, accuracy: 18 } })
  assert.equal((await pending)?.locationStatus, "cancelled")
})

test("an already-abandoned wait never asks the browser", async () => {
  let called = 0
  installGeolocation(() => {
    called += 1
  })
  const controller = new AbortController()
  controller.abort()
  const capture = await resolveStampLocation(true, 80, controller.signal)
  assert.equal(capture?.locationStatus, "cancelled")
  assert.equal(called, 0)
})

test("a browser timeout is recorded as timeout", async () => {
  installGeolocation((_success, error) => {
    error(geoError(TIMEOUT))
  })
  const capture = await resolveStampLocation(true, 80)
  assert.equal(capture?.locationStatus, "timeout")
})

test("a blocked permission still asks the browser, because that is the only ground truth", async () => {
  // Script cannot re-open a blocked prompt, but asking costs nothing (the
  // browser answers PERMISSION_DENIED at once) and is the only way to notice
  // that the customer has since allowed location in site settings.
  let called = 0
  installGeolocation((_success, error) => {
    called += 1
    error(geoError(PERMISSION_DENIED))
  }, "denied")
  const capture = await resolveStampLocation(true, 80)
  assert.equal(called, 1)
  assert.equal(capture?.locationStatus, "denied")
  assert.notEqual(
    capture?.locationStatus,
    "denied_remembered",
    "nothing is remembered on the client any more"
  )
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

test("the permission state is copy only: a missing or throwing API is unknown", async () => {
  installGeolocation(() => {})
  assert.equal(await geolocationPermissionState(), "unknown")

  installGeolocation(() => {}, "denied")
  assert.equal(await geolocationPermissionState(), "denied")

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      geolocation: { getCurrentPosition() {} },
      permissions: {
        query: async () => {
          throw new Error("not on this browser")
        },
      },
    },
  })
  assert.equal(await geolocationPermissionState(), "unknown")
})

test("the legacy denial flag is cleared on sight and storage failure does not block capture", async () => {
  const removed = []
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      removeItem(key) {
        removed.push(key)
      },
    },
  })
  installGeolocation((success) => {
    success({ coords: { latitude: 52.208, longitude: 0.091, accuracy: 18 } })
  })
  const capture = await resolveStampLocation(true, 80)
  assert.equal(capture?.locationStatus, "granted")
  assert.deepEqual(removed, ["nabaperks:soft-gps-denied:v1"])

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      removeItem() {
        throw new Error("private mode")
      },
    },
  })
  const again = await resolveStampLocation(true, 80)
  assert.equal(again?.locationStatus, "granted")
})

test("an unsupported browser is reported without asking", async () => {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {},
  })
  const capture = await resolveStampLocation(true, 80)
  assert.equal(capture?.locationStatus, "unsupported")
})

test("location capture is attached to the stamp form", () => {
  const formData = new FormData()
  addLocationCapture(formData, {
    latitude: 52.2,
    longitude: 0.1,
    accuracyMeters: 12,
    locationStatus: "granted",
    captureElapsedMs: 900,
  })
  assert.equal(formData.get("location_status"), "granted")
  assert.equal(formData.get("capture_elapsed_ms"), "900")
  assert.equal(formData.get("latitude"), "52.2")
})

const granted = {
  latitude: 52.2,
  longitude: 0.1,
  accuracyMeters: 12,
  locationStatus: "granted",
  captureElapsedMs: 900,
}
const noFix = (locationStatus) => ({
  latitude: null,
  longitude: null,
  accuracyMeters: null,
  locationStatus,
  captureElapsedMs: 0,
})

test("a fix is always submitted, and a visit with no location asked is too", () => {
  for (const input of [
    { unverifiedGraceRemaining: 0, refusedWithoutFix: true },
    { unverifiedGraceRemaining: undefined, refusedWithoutFix: false },
  ]) {
    assert.deepEqual(decideCaptureSubmission(granted, input), {
      action: "submit",
    })
    assert.deepEqual(decideCaptureSubmission(null, input), {
      action: "submit",
    })
  }
})

test("a no-fix capture requires an explicit choice and known remaining grace", () => {
  const denied = noFix("denied")
  assert.deepEqual(
    decideCaptureSubmission(denied, {
      unverifiedGraceRemaining: 1,
      refusedWithoutFix: false,
      useUnverifiedGrace: true,
    }),
    { action: "submit" },
    "grace left: the courtesy stamp is the server's to commit"
  )
  for (const remaining of [undefined, 0, 1, 2]) {
    assert.equal(
      decideCaptureSubmission(denied, {
        unverifiedGraceRemaining: remaining,
        refusedWithoutFix: false,
      }).action,
      "refuse",
      "GPS retries never consume grace"
    )
  }
  assert.equal(
    decideCaptureSubmission(denied, {
      unverifiedGraceRemaining: undefined,
      refusedWithoutFix: false,
      useUnverifiedGrace: true,
    }).action,
    "refuse",
    "unknown grace cannot spend an attempt"
  )
  assert.equal(
    decideCaptureSubmission(denied, {
      unverifiedGraceRemaining: undefined,
      refusedWithoutFix: true,
    }).action,
    "refuse",
    "…and once the server has said location_required, no more are spent"
  )
  assert.equal(
    decideCaptureSubmission(denied, {
      unverifiedGraceRemaining: 0,
      refusedWithoutFix: false,
    }).action,
    "refuse",
    "grace spent: nothing is sent, so the attempt bucket is untouched"
  )
  assert.equal(
    decideCaptureSubmission(denied, {
      unverifiedGraceRemaining: 2,
      refusedWithoutFix: true,
      useUnverifiedGrace: true,
    }).action,
    "refuse",
    "the server's answer outranks a stale payload"
  )
})

test("the refusal distinguishes each browser failure", () => {
  const spent = { unverifiedGraceRemaining: 0, refusedWithoutFix: false }
  const messages = Object.fromEntries(
    ["denied", "unsupported", "timeout", "unavailable"].map((status) => [
      status,
      decideCaptureSubmission(noFix(status), spent).message,
    ])
  )
  assert.match(messages.denied, /hasn't allowed location/)
  assert.match(messages.unsupported, /Safari or Chrome/)
  assert.match(messages.timeout, /window or the entrance/)
  assert.match(messages.unavailable, /Location Services and connection/)
  assert.notEqual(messages.unavailable, messages.timeout)
})

test("an abandoned wait is neither submitted nor a refusal", () => {
  assert.deepEqual(
    decideCaptureSubmission(noFix("cancelled"), {
      unverifiedGraceRemaining: 0,
      refusedWithoutFix: false,
    }),
    { action: "ignore" }
  )
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
  }
}

test("a browser throwing synchronously is unavailable and can retry", async () => {
  installGeolocation(() => {
    throw new Error("browser failure")
  })
  assert.equal(
    (await resolveStampLocation(true))?.locationStatus,
    "unavailable"
  )
  installGeolocation((success) =>
    success({ coords: { latitude: 52.2, longitude: 0.1, accuracy: 12 } })
  )
  assert.equal((await resolveStampLocation(true))?.locationStatus, "granted")
})

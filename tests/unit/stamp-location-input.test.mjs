import assert from "node:assert/strict"
import { test } from "node:test"

import {
  MAX_CAPTURE_ELAPSED_MS,
  parseStampLocationForm,
} from "@/lib/customer/stamp-location-input"

function form(fields) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

const GOOD_FIX = {
  qrId: "qr-1",
  latitude: "51.5072",
  longitude: "-0.1276",
  accuracy_meters: "18",
  location_status: "granted",
  capture_elapsed_ms: "840",
}

test("an in-range fix is forwarded unchanged", () => {
  assert.deepEqual(parseStampLocationForm(form(GOOD_FIX)), {
    qrId: "qr-1",
    latitude: 51.5072,
    longitude: -0.1276,
    accuracyMeters: 18,
    locationStatus: "granted",
    captureElapsedMs: 840,
  })
})

test("boundary coordinates and zero accuracy are valid", () => {
  const parsed = parseStampLocationForm(
    form({
      ...GOOD_FIX,
      latitude: "-90",
      longitude: "180",
      accuracy_meters: "0",
    })
  )
  assert.equal(parsed?.latitude, -90)
  assert.equal(parsed?.longitude, 180)
  assert.equal(parsed?.accuracyMeters, 0)
})

for (const [label, overrides] of [
  ["latitude above 90", { latitude: "90.0001" }],
  ["latitude below -90", { latitude: "-91" }],
  ["longitude above 180", { longitude: "180.5" }],
  ["longitude below -180", { longitude: "-181" }],
  ["negative accuracy", { accuracy_meters: "-1" }],
  ["non-numeric latitude", { latitude: "north" }],
  ["infinite longitude", { longitude: "Infinity" }],
  ["a latitude without a longitude", { longitude: "" }],
]) {
  test(`${label} drops the whole fix, as if none was captured`, () => {
    const parsed = parseStampLocationForm(form({ ...GOOD_FIX, ...overrides }))
    assert.equal(parsed?.latitude, null)
    assert.equal(parsed?.longitude, null)
    assert.equal(parsed?.accuracyMeters, null)
    // The rest of the capture still reaches the server.
    assert.equal(parsed?.qrId, "qr-1")
    assert.equal(parsed?.locationStatus, "granted")
    assert.equal(parsed?.captureElapsedMs, 840)
  })
}

test("a fix without an accuracy keeps its coordinates", () => {
  const parsed = parseStampLocationForm(
    form({ ...GOOD_FIX, accuracy_meters: "" })
  )
  assert.equal(parsed?.latitude, 51.5072)
  assert.equal(parsed?.longitude, -0.1276)
  assert.equal(parsed?.accuracyMeters, null)
})

for (const [label, raw] of [
  ["negative", "-5"],
  ["fractional", "12.5"],
  ["beyond the integer column", String(MAX_CAPTURE_ELAPSED_MS + 1)],
  ["non-numeric", "soon"],
]) {
  test(`a ${label} capture time is dropped without touching the fix`, () => {
    const parsed = parseStampLocationForm(
      form({ ...GOOD_FIX, capture_elapsed_ms: raw })
    )
    assert.equal(parsed?.captureElapsedMs, null)
    assert.equal(parsed?.latitude, 51.5072)
  })
}

test("the integer ceiling itself is still a valid capture time", () => {
  const parsed = parseStampLocationForm(
    form({ ...GOOD_FIX, capture_elapsed_ms: String(MAX_CAPTURE_ELAPSED_MS) })
  )
  assert.equal(parsed?.captureElapsedMs, MAX_CAPTURE_ELAPSED_MS)
})

test("a form with nothing location-related yields no coordinates", () => {
  assert.equal(parseStampLocationForm(form({})), undefined)
  assert.equal(
    parseStampLocationForm(form({ latitude: "400", longitude: "0" })),
    undefined,
    "an invalid-only fix counts as nothing"
  )
})

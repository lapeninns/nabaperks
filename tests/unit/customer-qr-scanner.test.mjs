import assert from "node:assert/strict"
import { test } from "node:test"

import { normalizeScannedQrDestination } from "@/lib/customer/qr-scanner"
import { scannerGuidance } from "@/lib/customer/scanner-guidance"

const ORIGIN = "https://app.nabaperks.test"
const QR_ID = "old-crown-girton_table-7"

test("customer QR scanner accepts same-origin venue QR URLs", () => {
  const cases = [
    [`${ORIGIN}/q/${QR_ID}`, `/q/${QR_ID}`],
    [`/q/${QR_ID}`, `/q/${QR_ID}`],
    [`  /q/${QR_ID}  `, `/q/${QR_ID}`],
    [`${ORIGIN}/q/${QR_ID}?utm=ignored#section`, `/q/${QR_ID}`],
  ]

  for (const [value, href] of cases) {
    assert.deepEqual(normalizeScannedQrDestination(value, ORIGIN), {
      kind: "valid",
      href,
    })
  }
})

test("customer QR scanner rejects non-venue and cross-origin payloads", () => {
  const invalidPayloads = [
    "",
    "not a url",
    "https://evil.example/q/old-crown-girton",
    `${ORIGIN}/r/123e4567-e89b-12d3-a456-426614174000`,
    `${ORIGIN}/q/has space`,
    `${ORIGIN}/q/${QR_ID}/extra`,
  ]

  for (const value of invalidPayloads) {
    assert.deepEqual(normalizeScannedQrDestination(value, ORIGIN), {
      kind: "invalid",
    })
  }
})

test("customer scanner guidance exposes retry only for camera errors", () => {
  // The denied state also offers the native-camera path (production-polish
  // CUS-P3-12) — the printed venue QR works with any phone camera app.
  assert.deepEqual(scannerGuidance("camera-error"), {
    detail:
      "We could not open your camera. Allow camera access, then try again. Or scan the venue QR with your phone's camera app.",
    showRetry: true,
  })
  assert.deepEqual(scannerGuidance("invalid"), {
    detail: "Point your camera at the venue QR on the table or counter.",
    showRetry: false,
  })
  assert.deepEqual(scannerGuidance("scanning"), {
    detail: null,
    showRetry: false,
  })
})

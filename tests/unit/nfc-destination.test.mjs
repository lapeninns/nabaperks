import assert from "node:assert/strict"
import { test } from "node:test"

import { resolveNfcDestination } from "@/lib/qr/nfc-destination"

const JOIN_URL = "https://nabaperks.com/q/abc?src=qr"
const REVIEW_URL =
  "https://search.google.com/local/writereview?placeid=ChIJ-example"

test("loyalty NFC designs keep the venue join destination", () => {
  assert.equal(
    resolveNfcDestination({
      designId: "tap",
      joinUrl: JOIN_URL,
      googleReviewUrl: REVIEW_URL,
    }),
    JOIN_URL
  )
})

test("Google Review NFC designs require the validated review destination", () => {
  assert.equal(
    resolveNfcDestination({
      designId: "google-review",
      joinUrl: JOIN_URL,
      googleReviewUrl: REVIEW_URL,
    }),
    REVIEW_URL
  )
  assert.equal(
    resolveNfcDestination({
      designId: "google-review",
      joinUrl: JOIN_URL,
      googleReviewUrl: "https://example.com/review",
    }),
    null
  )
  assert.equal(
    resolveNfcDestination({
      designId: "google-review",
      joinUrl: JOIN_URL,
      googleReviewUrl: null,
    }),
    null
  )
})

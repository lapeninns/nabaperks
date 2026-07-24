import assert from "node:assert/strict"
import test from "node:test"

import {
  normalizeGoogleReviewUrl,
  normalizeVenueLocality,
} from "../../lib/customer/venue-details.ts"

test("venue locality is trimmed and empty values are hidden", () => {
  assert.equal(normalizeVenueLocality("  King's Lynn  "), "King's Lynn")
  assert.equal(normalizeVenueLocality("   "), null)
  assert.equal(normalizeVenueLocality(null), null)
})

test("Google review links require the expected HTTPS destination and place id", () => {
  const reviewUrl =
    "https://search.google.com/local/writereview?placeid=ChIJ-example"

  assert.equal(normalizeGoogleReviewUrl(reviewUrl), reviewUrl)
  assert.equal(
    normalizeGoogleReviewUrl(
      "http://search.google.com/local/writereview?placeid=ChIJ-example"
    ),
    null
  )
  assert.equal(
    normalizeGoogleReviewUrl(
      "https://example.com/local/writereview?placeid=ChIJ-example"
    ),
    null
  )
  assert.equal(
    normalizeGoogleReviewUrl("https://search.google.com/local/writereview"),
    null
  )
  assert.equal(normalizeGoogleReviewUrl("javascript:alert(1)"), null)
})

import assert from "node:assert/strict"
import test from "node:test"

import {
  SEASONAL_OFFER_WINDOWS,
  getActiveSeasonalOffer,
} from "@/lib/marketing/seasonal-offer"

test("seasonal wrappers use explicit non-overlapping campaign windows", () => {
  for (let index = 1; index < SEASONAL_OFFER_WINDOWS.length; index += 1) {
    assert.ok(
      SEASONAL_OFFER_WINDOWS[index - 1].endDateISO <
        SEASONAL_OFFER_WINDOWS[index].startDateISO
    )
  }
})

test("the autumn wrapper carries a fixed deadline and unchanged-terms boundary", () => {
  const offer = getActiveSeasonalOffer(new Date("2026-08-15T12:00:00Z"))
  assert.ok(offer)
  assert.equal(offer.slug, "autumn-2026")
  assert.equal(offer.deadlineLabel, "30 September 2026")
  assert.match(offer.deadlineLine, /30 September 2026/)
  assert.match(
    offer.termsLine,
    /do not change.*deliverables, prices or guarantee/i
  )
})

test("an expired campaign is not silently regenerated", () => {
  assert.equal(getActiveSeasonalOffer(new Date("2027-04-01T12:00:00Z")), null)
})

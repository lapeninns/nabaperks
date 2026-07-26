import assert from "node:assert/strict"
import test from "node:test"

import { chunkVenueAnnouncementCustomerIds } from "../../lib/notifications/venue-announcement-core.ts"

test("keeps announcement preference filters below oversized URL limits", () => {
  const customerIds = Array.from(
    { length: 500 },
    (_, index) => `customer-${index}`
  )

  const batches = chunkVenueAnnouncementCustomerIds(customerIds)

  assert.equal(batches.length, 5)
  assert.ok(batches.every((batch) => batch.length <= 100))
  assert.deepEqual(batches.flat(), customerIds)
})

test("rejects an invalid announcement query batch size", () => {
  assert.throws(
    () => chunkVenueAnnouncementCustomerIds(["customer-1"], 0),
    /batch size must be positive/
  )
})

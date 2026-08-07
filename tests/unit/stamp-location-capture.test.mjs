import assert from "node:assert/strict"
import { test } from "node:test"

import { shouldAttemptStampLocation } from "@/lib/customer/stamp-location-capture"

test("location capture follows the lifetime visit threshold", () => {
  assert.equal(shouldAttemptStampLocation(false, 9, 3), false)
  assert.equal(shouldAttemptStampLocation(true, 2, 3), false)
  assert.equal(shouldAttemptStampLocation(true, 3, 3), true)
  assert.equal(shouldAttemptStampLocation(true, 7, 3), true)
  assert.equal(shouldAttemptStampLocation(true, 4, 5), false)
  assert.equal(shouldAttemptStampLocation(true, 5, 5), true)
})

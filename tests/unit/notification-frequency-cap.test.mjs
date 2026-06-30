import assert from "node:assert/strict"
import { test } from "node:test"

import {
  CUSTOMER_DAILY_NOTIFICATION_CAP,
  NOTIFICATION_CAP_RETRY_MS,
  isFrequencyCappedCategory,
  nextNotificationFrequencyWindow,
} from "@/lib/notifications/frequency-cap-core"

/**
 * MS-notifications — frequency-cap policy (unit tier).
 *
 * Real execution of the pure cap policy. The rolling-window count query is IO
 * and stays in frequency-cap.ts (live-DB territory); the classifier, the cap
 * constant, and the retry window are deterministic and proven here.
 */

test("the daily cap is 6", () => {
  assert.equal(CUSTOMER_DAILY_NOTIFICATION_CAP, 6)
})

test("only operational notifications bypass the cap", () => {
  assert.equal(isFrequencyCappedCategory("operational"), false, "operational is exempt")
  for (const category of ["transactional", "reminder", "marketing"]) {
    assert.equal(isFrequencyCappedCategory(category), true, `${category} is capped`)
  }
})

test("a capped event retries one hour out", () => {
  assert.equal(NOTIFICATION_CAP_RETRY_MS, 60 * 60 * 1000)
  const now = new Date("2026-06-30T12:00:00Z")
  assert.equal(
    nextNotificationFrequencyWindow(now).toISOString(),
    "2026-06-30T13:00:00.000Z",
    "the next window is exactly +1h"
  )
})

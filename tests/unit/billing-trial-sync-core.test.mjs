import assert from "node:assert/strict"
import { test } from "node:test"

import {
  calculateDeliveryAnchoredTrial,
  calculateUndeliveredTrialExtension,
  isTrialSynchronisable,
} from "@/lib/stripe/trial-sync-core"

test("Given an early confirmed delivery When the target is calculated Then the merchant receives 28 usable pilot days", () => {
  const result = calculateDeliveryAnchoredTrial({
    deliveredAt: "2026-08-01T10:00:00.000Z",
    approvedExtensionEnd: null,
    now: "2026-08-02T10:00:00.000Z",
  })

  assert.deepEqual(result, {
    pilotStartsAt: "2026-08-01T10:00:00.000Z",
    basePilotEndsAt: "2026-08-29T10:00:00.000Z",
    desiredTrialEndsAt: "2026-08-29T10:00:00.000Z",
  })
})

test("Given support approved a longer extension When the target is calculated Then that later date wins", () => {
  const result = calculateDeliveryAnchoredTrial({
    deliveredAt: "2026-08-01T10:00:00.000Z",
    approvedExtensionEnd: "2026-09-05T10:00:00.000Z",
    now: "2026-08-02T10:00:00.000Z",
  })

  assert.equal(result.desiredTrialEndsAt, "2026-09-05T10:00:00.000Z")
})

test("Given delivery is confirmed late When the base pilot already passed Then seven days notice is preserved", () => {
  const result = calculateDeliveryAnchoredTrial({
    deliveredAt: "2026-06-01T10:00:00.000Z",
    approvedExtensionEnd: null,
    now: "2026-07-10T10:00:00.000Z",
  })

  assert.equal(result.basePilotEndsAt, "2026-06-29T10:00:00.000Z")
  assert.equal(result.desiredTrialEndsAt, "2026-07-17T10:00:00.000Z")
})

test("Given posters remain undelivered near the provisional end When safety extends the trial Then fourteen days are added from now", () => {
  assert.equal(
    calculateUndeliveredTrialExtension("2026-08-10T10:00:00.000Z"),
    "2026-08-24T10:00:00.000Z"
  )
})

test("Given subscription states When selecting sync work Then only live trials can be rewritten automatically", () => {
  assert.equal(isTrialSynchronisable("trialing"), true)
  for (const status of [
    "active",
    "past_due",
    "canceled",
    "paused",
    "incomplete_expired",
  ]) {
    assert.equal(isTrialSynchronisable(status), false)
  }
})

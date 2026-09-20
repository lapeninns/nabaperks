import assert from "node:assert/strict"
import { test } from "node:test"

import { rewardQrAvailability } from "@/lib/customer/reward-qr-eligibility"
import { profileCompletionFrom } from "@/lib/customer/profile-completion"

const ready = {
  collectionState: "ready",
  collectionReason: null,
  availableFrom: "2026-09-05T05:00:00Z",
}

test("an otherwise eligible unverified adult can display a QR for ID review", () => {
  const profile = profileCompletionFrom({
    fullName: "Test Customer",
    dateOfBirth: "1990-01-01",
    dateOfBirthVerifiedAt: null,
    email: "test@example.test",
    emailVerifiedAt: "2026-09-01T12:00:00Z",
  })
  assert.equal(profile.complete, true)
  assert.equal(profile.dateOfBirthVerified, false)
  assert.equal(rewardQrAvailability(ready).status, "ready")
})

test("the QR refuses an expired reward from the server predicate", () => {
  assert.deepEqual(
    rewardQrAvailability({ ...ready, collectionState: "expired" }),
    {
      status: "blocked",
      reason: "This reward has expired.",
    }
  )
})

test("waiting stays waiting even after the browser clock passes available_from", () => {
  assert.equal(
    rewardQrAvailability({
      ...ready,
      collectionState: "waiting",
      availableFrom: "2020-01-01T05:00:00Z",
    }).status,
    "waiting"
  )
})

test("blocked and terminal predicate states never show a QR", () => {
  for (const collectionState of ["redeemed", "cancelled", "expired"]) {
    assert.equal(
      rewardQrAvailability({ ...ready, collectionState }).status,
      "blocked"
    )
  }
  assert.deepEqual(
    rewardQrAvailability({
      ...ready,
      collectionState: "blocked",
      collectionReason: "venue_paused",
    }),
    {
      status: "blocked",
      reason: "This venue has paused reward collection.",
    }
  )
})

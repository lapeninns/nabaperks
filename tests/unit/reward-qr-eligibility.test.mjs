import assert from "node:assert/strict"
import { test } from "node:test"

import { rewardQrAvailability } from "@/lib/customer/reward-qr-eligibility"
import { profileCompletionFrom } from "@/lib/customer/profile-completion"

const now = new Date("2026-09-05T12:00:00Z")
const ready = {
  status: "unlocked",
  source: "stamp_cycle",
  redeemableFrom: "2026-09-05",
  expiresAt: "2026-09-05T23:00:00Z",
  currentStampCount: 3,
  stampsRequired: 3,
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
  assert.equal(rewardQrAvailability(ready, now).status, "ready")
})

test("the QR refuses an expired reward even before the expiry job updates its status", () => {
  assert.deepEqual(
    rewardQrAvailability({ ...ready, expiresAt: now.toISOString() }, now),
    {
      status: "blocked",
      reason: "This reward has expired.",
    }
  )
})

test("future reward availability follows the UK business date", () => {
  assert.equal(
    rewardQrAvailability(
      { ...ready, redeemableFrom: "2026-09-06", expiresAt: null },
      now
    ).status,
    "waiting"
  )
  assert.equal(
    rewardQrAvailability(
      { ...ready, redeemableFrom: "2026-09-06", expiresAt: null },
      new Date("2026-09-05T23:00:00Z")
    ).status,
    "ready"
  )
})

test("issued gifts can be presented below the stamp threshold while earned rewards cannot", () => {
  assert.equal(
    rewardQrAvailability({ ...ready, currentStampCount: 1 }, now).status,
    "blocked"
  )
  assert.equal(
    rewardQrAvailability(
      { ...ready, source: "merchant_direct", currentStampCount: 1 },
      now
    ).status,
    "ready"
  )
})

test("unavailable programmes and terminal rewards never show a QR", () => {
  for (const status of ["redeemed", "cancelled", "expired"]) {
    assert.equal(
      rewardQrAvailability({ ...ready, status }, now).status,
      "blocked"
    )
  }
  assert.deepEqual(
    rewardQrAvailability(
      { ...ready, unavailableReason: "Programme paused" },
      now
    ),
    {
      status: "blocked",
      reason: "Programme paused",
    }
  )
})

import assert from "node:assert/strict"
import { test } from "node:test"

import { profileCompletionFrom } from "@/lib/customer/profile-completion"

test("Given an existing under-age DOB When profile completion runs Then the profile stays incomplete", () => {
  const completion = profileCompletionFrom({
    fullName: "Young Customer",
    dateOfBirth: "2016-01-01",
    dateOfBirthVerifiedAt: null,
    email: null,
    emailVerifiedAt: null,
  })

  assert.equal(completion.complete, false)
  assert.equal(completion.dateOfBirth, null)
})

test("Given an adult DOB without verified email When profile completion runs Then reward collection stays gated", () => {
  const completion = profileCompletionFrom({
    fullName: "Adult Customer",
    dateOfBirth: "1990-01-01",
    dateOfBirthVerifiedAt: null,
    email: null,
    emailVerifiedAt: null,
  })

  assert.equal(completion.complete, false)
  assert.equal(completion.dateOfBirth, "1990-01-01")
})

test("Given an adult profile and verified email When profile completion runs Then reward collection can proceed", () => {
  const completion = profileCompletionFrom({
    fullName: "Adult Customer",
    dateOfBirth: "1990-01-01",
    dateOfBirthVerifiedAt: "2026-07-10T11:00:00.000Z",
    email: "adult@example.test",
    emailVerifiedAt: "2026-07-10T12:00:00.000Z",
  })

  assert.equal(completion.complete, true)
  assert.equal(completion.dateOfBirthVerified, true)
  assert.equal(completion.emailVerified, true)
  assert.equal(completion.emailLocked, true)
})

test("Given complete self-asserted details When reward readiness runs Then DOB remains unverified", () => {
  const completion = profileCompletionFrom({
    fullName: "Adult Customer",
    dateOfBirth: "1990-01-01",
    dateOfBirthVerifiedAt: null,
    email: "adult@example.test",
    emailVerifiedAt: "2026-07-10T12:00:00.000Z",
  })

  assert.equal(completion.complete, true, "profile editing remains complete")
  assert.equal(completion.dateOfBirthVerified, false)
})

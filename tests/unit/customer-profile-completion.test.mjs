import assert from "node:assert/strict"
import { test } from "node:test"

import { profileCompletionFrom } from "@/lib/customer/profile-completion"
import { collectionSetup } from "@/lib/customer/experience/collection-stage"

test("Given pending phone verification When earlier collection steps are shown Then their progress includes the phone step", () => {
  const savedDetails = {
    fullName: "Email Customer",
    dateOfBirth: "1990-01-01",
    dateOfBirthVerifiedAt: null,
    email: "email@example.test",
    emailVerifiedAt: null,
    phoneVerified: false,
  }
  assert.deepEqual(collectionSetup(profileCompletionFrom(savedDetails)), {
    stage: "email",
    outstanding: true,
    step: 2,
    total: 3,
  })
  assert.deepEqual(
    collectionSetup(
      profileCompletionFrom({
        ...savedDetails,
        fullName: null,
        emailVerifiedAt: "2026-07-10T12:00:00.000Z",
      })
    ),
    {
      stage: "details",
      outstanding: true,
      step: 1,
      total: 2,
    }
  )
})

test("Given verified email and saved details When phone is unverified Then collection requires phone verification", () => {
  const completion = profileCompletionFrom({
    fullName: "Email Customer",
    dateOfBirth: "1990-01-01",
    dateOfBirthVerifiedAt: null,
    email: "email@example.test",
    emailVerifiedAt: "2026-07-10T12:00:00.000Z",
    phoneVerified: false,
  })

  assert.equal(completion.complete, false)
  assert.equal(completion.needsPhoneVerification, true)
  // Details were saved before this step, so the count stays honest: the
  // mobile number is the second of two steps, never "Step 1 of 1".
  assert.deepEqual(collectionSetup(completion), {
    stage: "phone",
    outstanding: true,
    step: 2,
    total: 2,
  })
})

test("Given an existing under-age DOB When profile completion runs Then the profile stays incomplete", () => {
  const completion = profileCompletionFrom({
    fullName: "Young Customer",
    phoneVerified: true,
    dateOfBirth: "2016-01-01",
    dateOfBirthVerifiedAt: null,
    email: null,
    emailVerifiedAt: null,
  })

  assert.equal(completion.complete, false)
  assert.equal(completion.dateOfBirth, null)
})

test("Given an adult DOB without an email When profile completion runs Then reward collection requires an email", () => {
  const completion = profileCompletionFrom({
    fullName: "Adult Customer",
    dateOfBirth: "1990-01-01",
    dateOfBirthVerifiedAt: null,
    email: null,
    emailVerifiedAt: null,
    phoneVerified: true,
  })

  assert.equal(completion.complete, false)
  assert.equal(completion.dateOfBirth, "1990-01-01")
  assert.equal(completion.needsEmailVerification, false)
})

for (const email of [null, "", "   ", "adult@example.test"]) {
  test(`Given email ${JSON.stringify(email)} without verification When profile completion runs Then collection stays blocked`, () => {
    const completion = profileCompletionFrom({
      fullName: "Adult Customer",
      dateOfBirth: "1990-01-01",
      dateOfBirthVerifiedAt: null,
      email,
      emailVerifiedAt: null,
      phoneVerified: true,
    })

    assert.equal(completion.complete, false)
    assert.equal(completion.emailLocked, false)
    assert.equal(completion.needsEmailVerification, Boolean(email?.trim()))
  })
}

test("Given an adult profile and verified email and phone When profile completion runs Then reward collection can proceed", () => {
  const completion = profileCompletionFrom({
    fullName: "Adult Customer",
    dateOfBirth: "1990-01-01",
    dateOfBirthVerifiedAt: "2026-07-10T11:00:00.000Z",
    email: "adult@example.test",
    emailVerifiedAt: "2026-07-10T12:00:00.000Z",
    phoneVerified: true,
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
    phoneVerified: true,
  })

  assert.equal(completion.complete, true, "profile editing remains complete")
  assert.equal(completion.dateOfBirthVerified, false)
})

import assert from "node:assert/strict"
import { test } from "node:test"

import { profileCompletionFrom } from "@/lib/customer/profile-completion"

test("Given an existing under-age DOB When profile completion runs Then the profile stays incomplete", () => {
  const completion = profileCompletionFrom({
    fullName: "Young Customer",
    dateOfBirth: "2016-01-01",
    email: null,
    emailVerifiedAt: null,
  })

  assert.equal(completion.complete, false)
  assert.equal(completion.dateOfBirth, null)
})

test("Given an adult DOB When profile completion runs Then the profile can complete", () => {
  const completion = profileCompletionFrom({
    fullName: "Adult Customer",
    dateOfBirth: "1990-01-01",
    email: null,
    emailVerifiedAt: null,
  })

  assert.equal(completion.complete, true)
  assert.equal(completion.dateOfBirth, "1990-01-01")
})

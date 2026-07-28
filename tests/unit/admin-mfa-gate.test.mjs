import assert from "node:assert/strict"
import { test } from "node:test"

import {
  adminMfaStepUpRequired,
  adminMfaUnenrollmentAllowed,
  isAdminMfaEnrolled,
  resolveAdminMfaState,
} from "@/lib/admin/mfa-gate"

test("an admin with no verified factor must enrol before using the console", () => {
  // Supabase reports nextLevel 'aal1' when there is no verified factor.
  assert.equal(resolveAdminMfaState("aal1", "aal1"), "enrollment-required")
  assert.equal(isAdminMfaEnrolled("enrollment-required"), false)
  assert.equal(adminMfaStepUpRequired("enrollment-required"), false)
})

test("an enrolled admin who has completed the challenge is satisfied", () => {
  assert.equal(resolveAdminMfaState("aal2", "aal2"), "satisfied")
  assert.equal(isAdminMfaEnrolled("satisfied"), true)
  assert.equal(adminMfaStepUpRequired("satisfied"), false)
})

test("an enrolled admin still at aal1 must step up", () => {
  assert.equal(resolveAdminMfaState("aal1", "aal2"), "step-up-required")
  assert.equal(isAdminMfaEnrolled("step-up-required"), true)
  assert.equal(adminMfaStepUpRequired("step-up-required"), true)
})

test("unknown assurance state fails closed", () => {
  // The dangerous mistake would be to treat a bare aal1 session as protected.
  // Only nextLevel === 'aal2' proves a factor exists; without it we never gate.
  assert.equal(resolveAdminMfaState("aal1", undefined), "unavailable")
  assert.equal(resolveAdminMfaState(null, "aal1"), "unavailable")
  assert.equal(resolveAdminMfaState(null, null), "unavailable")
  assert.equal(resolveAdminMfaState("aal1", "aal3"), "unavailable")
  assert.equal(isAdminMfaEnrolled("unavailable"), false)
})

test("MFA removal requires an already satisfied AAL2 session", () => {
  assert.equal(adminMfaUnenrollmentAllowed("satisfied"), true)
  assert.equal(adminMfaUnenrollmentAllowed("step-up-required"), false)
  assert.equal(adminMfaUnenrollmentAllowed("enrollment-required"), false)
  assert.equal(adminMfaUnenrollmentAllowed("unavailable"), false)
})

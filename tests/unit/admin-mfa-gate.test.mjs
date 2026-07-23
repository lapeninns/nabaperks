import assert from "node:assert/strict"
import { test } from "node:test"

import {
  adminMfaStepUpRequired,
  adminMfaUnenrollmentAllowed,
  isAdminMfaEnrolled,
  resolveAdminMfaState,
} from "@/lib/admin/mfa-gate"

test("an admin with no verified factor is allowed at aal1 (nothing to enforce)", () => {
  // Supabase reports nextLevel 'aal1' when there is no verified factor.
  assert.equal(resolveAdminMfaState("aal1", "aal1"), "no-factor")
  assert.equal(resolveAdminMfaState(null, "aal1"), "no-factor")
  assert.equal(resolveAdminMfaState(null, null), "no-factor")
  assert.equal(isAdminMfaEnrolled("no-factor"), false)
  assert.equal(adminMfaStepUpRequired("no-factor"), false)
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

test("enforcement keys off the verified factor (nextLevel), never the session alone", () => {
  // The dangerous mistake would be to treat a bare aal1 session as protected.
  // Only nextLevel === 'aal2' proves a factor exists; without it we never gate.
  assert.equal(resolveAdminMfaState("aal1", undefined), "no-factor")
  // Defensive: an unexpected level string is treated as "no factor", failing
  // OPEN (never locks an admin out) — the app-layer gate is not the DB moat.
  assert.equal(resolveAdminMfaState("aal1", "aal3"), "no-factor")
})

test("MFA removal requires an already satisfied AAL2 session", () => {
  assert.equal(adminMfaUnenrollmentAllowed("satisfied"), true)
  assert.equal(adminMfaUnenrollmentAllowed("step-up-required"), false)
  assert.equal(adminMfaUnenrollmentAllowed("no-factor"), false)
})

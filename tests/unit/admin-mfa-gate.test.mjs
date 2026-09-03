import assert from "node:assert/strict"
import { test } from "node:test"

import {
  adminMfaEnrollmentAllowed,
  adminMfaStepUpRequired,
  adminMfaUnenrollmentAllowed,
  adminStepUpSatisfied,
  isAdminMfaEnrolled,
  resolveAdminMfaState,
  resolveAdminMfaStateFromFacts,
} from "@/lib/admin/mfa-gate"

test("an admin with no verified factor is confined to enrolment", () => {
  // Supabase reports nextLevel 'aal1' when there is no verified factor.
  assert.equal(resolveAdminMfaState("aal1", "aal1"), "no-factor")
  assert.equal(resolveAdminMfaState(null, "aal1"), "no-factor")
  assert.equal(resolveAdminMfaState(null, null), "no-factor")
  assert.equal(isAdminMfaEnrolled("no-factor"), false)
  assert.equal(adminMfaStepUpRequired("no-factor"), true)
  assert.equal(adminStepUpSatisfied("no-factor"), false)
  assert.equal(adminMfaEnrollmentAllowed("no-factor"), true)
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
  assert.equal(adminMfaUnenrollmentAllowed("unknown"), false)
})

test("only a satisfied session can reach privileged surfaces", () => {
  // Gates the RLS-bypassing service-role client, the leaf page guard, admin
  // mutations, and new-factor enrolment. An enrolled admin sitting at aal1 is
  // exactly the compromised-session case, so it must be false there.
  assert.equal(adminStepUpSatisfied("satisfied"), true)
  assert.equal(adminStepUpSatisfied("no-factor"), false)
  assert.equal(adminStepUpSatisfied("step-up-required"), false)
  assert.equal(adminMfaEnrollmentAllowed("satisfied"), false)
  assert.equal(adminMfaEnrollmentAllowed("step-up-required"), false)
  assert.equal(adminMfaEnrollmentAllowed("unknown"), false)
})

test("the gate resolves enrolment from the database, not the session cookie", () => {
  // hasVerifiedFactor comes from viewer_has_verified_mfa_factor(); currentLevel
  // from the signed JWT. A stale cookie can no longer report "no factor".
  assert.equal(resolveAdminMfaStateFromFacts(false, "aal1"), "no-factor")
  assert.equal(resolveAdminMfaStateFromFacts(false, "aal2"), "no-factor")
  assert.equal(resolveAdminMfaStateFromFacts(true, "aal2"), "satisfied")
  assert.equal(resolveAdminMfaStateFromFacts(true, "aal1"), "step-up-required")
})

test("an unreadable assurance fact is unknown, never a permissive default", () => {
  // getAuthenticatorAssuranceLevel returns { data: null, error } instead of
  // throwing, so null must not collapse into "no-factor" (which allows).
  assert.equal(resolveAdminMfaStateFromFacts(null, "aal2"), "unknown")
  assert.equal(resolveAdminMfaStateFromFacts(undefined, "aal1"), "unknown")
  assert.equal(resolveAdminMfaStateFromFacts(true, null), "unknown")
  assert.equal(resolveAdminMfaStateFromFacts(true, undefined), "unknown")
  assert.equal(resolveAdminMfaStateFromFacts(true, "aal3"), "unknown")
})

test("an indeterminate assurance level fails closed", () => {
  // resolveAdminMfaState never returns "unknown"; getAdminAccess does, when
  // Supabase cannot report the assurance level at all. Treating that as
  // "no-factor" (the old behaviour) silently re-opened every privileged
  // surface, so it must deny instead.
  assert.equal(adminStepUpSatisfied("unknown"), false)
  assert.equal(isAdminMfaEnrolled("unknown"), true)
  assert.equal(adminMfaStepUpRequired("unknown"), true)
})

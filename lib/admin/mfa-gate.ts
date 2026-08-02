/**
 * Admin MFA gate policy — "enforce only when enrolled".
 *
 * The DB-level AAL2 requirement in 20260702180000 was reverted because it
 * demanded aal2 unconditionally and locked out every admin: password sign-in is
 * aal1 and there was no in-app way to reach aal2. 20260801120000 puts the gate
 * back at the database boundary, but encoding THIS policy rather than a blanket
 * requirement — an unenrolled admin is still allowed at aal1, so the lockout
 * cannot recur, and the in-app step-up flow now exists either way.
 *
 * The app layer is therefore no longer the only enforcement point, but it still
 * owns the surfaces the database cannot see: the service-role client bypasses
 * RLS entirely, and factor enrolment happens inside Supabase Auth.
 *
 * Supabase `auth.mfa.getAuthenticatorAssuranceLevel()` reports:
 *   - nextLevel === 'aal2'  ⇔ the user has a verified authenticator factor
 *   - currentLevel === 'aal2' ⇔ the current session has completed the challenge
 *
 * Policy:
 *   - no verified factor   → allowed at aal1 (nothing to enforce yet)
 *   - factor + session aal2 → allowed (step-up satisfied)
 *   - factor + session aal1 → step-up required (must complete a TOTP challenge)
 *   - assurance unreadable  → unknown, which denies privileged surfaces
 */

export type AdminMfaState =
  "no-factor" | "satisfied" | "step-up-required" | "unknown"

export function resolveAdminMfaState(
  currentLevel: string | null | undefined,
  nextLevel: string | null | undefined
): AdminMfaState {
  const hasVerifiedFactor = nextLevel === "aal2"
  if (!hasVerifiedFactor) {
    return "no-factor"
  }
  return currentLevel === "aal2" ? "satisfied" : "step-up-required"
}

/**
 * The resolution the gate actually uses.
 *
 * `hasVerifiedFactor` must come from the database, never from
 * `getAuthenticatorAssuranceLevel().nextLevel`: supabase-js derives nextLevel
 * from the cached session cookie's factor list, so a session minted before the
 * factor was enrolled reports "no factor" and would sail through the gate.
 * `currentLevel` is safe to take from supabase-js — it decodes the signed JWT's
 * `aal` claim.
 *
 * A null/absent currentLevel means the assurance level could not be read at
 * all, which is "unknown", not "aal1".
 */
export function resolveAdminMfaStateFromFacts(
  hasVerifiedFactor: boolean | null | undefined,
  currentLevel: string | null | undefined
): AdminMfaState {
  if (hasVerifiedFactor === null || hasVerifiedFactor === undefined) {
    return "unknown"
  }
  if (!hasVerifiedFactor) {
    return "no-factor"
  }
  if (currentLevel !== "aal1" && currentLevel !== "aal2") {
    return "unknown"
  }
  return currentLevel === "aal2" ? "satisfied" : "step-up-required"
}

/** True once the admin has a verified factor (drives shell display + nudges). */
export function isAdminMfaEnrolled(state: AdminMfaState): boolean {
  return state !== "no-factor"
}

/** True when a factor exists and the session has not stepped up — or we cannot tell. */
export function adminMfaStepUpRequired(state: AdminMfaState): boolean {
  return state === "step-up-required" || state === "unknown"
}

/**
 * The gate for every privileged admin surface the database cannot see: the
 * RLS-bypassing service-role client, the leaf page guard, admin mutations, and
 * enrolling a new authenticator.
 *
 * Deliberately NOT applied to `requireAdminRead` itself, because /admin/security
 * has to stay reachable for the admin to complete the very challenge this
 * predicate is waiting for.
 */
export function adminStepUpSatisfied(state: AdminMfaState): boolean {
  return state === "no-factor" || state === "satisfied"
}

/**
 * Removing the factor itself is stricter than ordinary admin mutations: the
 * current session must already have proved possession of that factor.
 */
export function adminMfaUnenrollmentAllowed(state: AdminMfaState): boolean {
  return state === "satisfied"
}

/**
 * Adding an authenticator is a security-state transition, so it needs the same
 * proof as any other privileged action. Without this, an attacker holding a
 * compromised aal1 session on an ALREADY-enrolled admin could enrol their own
 * TOTP factor, verify it, and reach aal2 without ever possessing the original
 * authenticator. First-factor bootstrap ("no-factor") stays open — there is no
 * existing factor to prove.
 */
export function adminMfaEnrollmentAllowed(state: AdminMfaState): boolean {
  return adminStepUpSatisfied(state)
}

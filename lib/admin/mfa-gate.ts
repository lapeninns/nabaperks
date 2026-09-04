/**
 * Admin MFA gate policy.
 *
 * Privileged authority requires a server-verified WebAuthn credential, trusted
 * activation of that exact credential, and a short-lived grant bound to the
 * live signed Auth session. A no-factor session is enrolment-only.
 *
 * Factor activation is checked separately by the caller because Supabase Auth
 * enrolment is reachable directly by an authenticated browser. Possession of a
 * newly enrolled factor alone therefore cannot activate admin authority.
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
 * Both facts come from security-definer database functions. The second fact is
 * true only for a non-expired server-verified grant for the current session.
 */
export function resolveAdminMfaStateFromFacts(
  hasVerifiedFactor: boolean | null | undefined,
  hasCurrentGrant: boolean | null | undefined
): AdminMfaState {
  if (
    hasVerifiedFactor === null ||
    hasVerifiedFactor === undefined ||
    hasCurrentGrant === null ||
    hasCurrentGrant === undefined
  ) {
    return "unknown"
  }
  if (!hasVerifiedFactor) {
    return "no-factor"
  }
  return hasCurrentGrant ? "satisfied" : "step-up-required"
}

/** True once the admin has a verified factor (drives shell display + nudges). */
export function isAdminMfaEnrolled(state: AdminMfaState): boolean {
  return state !== "no-factor"
}

/** True unless the session has proved possession of a verified factor. */
export function adminMfaStepUpRequired(state: AdminMfaState): boolean {
  return state !== "satisfied"
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
  return state === "satisfied"
}

/**
 * Removing the credential itself requires a current session-bound grant.
 */
export function adminMfaUnenrollmentAllowed(state: AdminMfaState): boolean {
  return state === "satisfied"
}

/**
 * First-factor enrolment is the only transition available before activation.
 * It does not itself grant authority; a trusted operator must activate the
 * factor at the database boundary after independently verifying the admin.
 * Additional factors are denied so a stolen aal1 session cannot bind its own.
 */
export function adminMfaEnrollmentAllowed(state: AdminMfaState): boolean {
  return state === "no-factor"
}

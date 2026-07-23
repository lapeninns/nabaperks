/**
 * Admin MFA gate policy — "enforce only when enrolled".
 *
 * Reinstates two-factor protection for the admin console (the DB-level AAL2
 * requirement in 20260702180000 was reverted because it locked out every admin:
 * password sign-in is aal1 and there was no in-app way to reach aal2). We
 * therefore enforce at the APP layer only and never re-add the DB check, so the
 * worst case of a bug here is "MFA not enforced", never a lockout.
 *
 * Supabase `auth.mfa.getAuthenticatorAssuranceLevel()` reports:
 *   - nextLevel === 'aal2'  ⇔ the user has a verified authenticator factor
 *   - currentLevel === 'aal2' ⇔ the current session has completed the challenge
 *
 * Policy:
 *   - no verified factor   → allowed at aal1 (nothing to enforce yet)
 *   - factor + session aal2 → allowed (step-up satisfied)
 *   - factor + session aal1 → step-up required (must complete a TOTP challenge)
 */

export type AdminMfaState = "no-factor" | "satisfied" | "step-up-required"

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

/** True once the admin has a verified factor (drives shell display + nudges). */
export function isAdminMfaEnrolled(state: AdminMfaState): boolean {
  return state !== "no-factor"
}

/** True only when a factor exists AND the current session has not stepped up. */
export function adminMfaStepUpRequired(state: AdminMfaState): boolean {
  return state === "step-up-required"
}

/**
 * Removing the factor itself is stricter than ordinary admin mutations: the
 * current session must already have proved possession of that factor.
 */
export function adminMfaUnenrollmentAllowed(state: AdminMfaState): boolean {
  return state === "satisfied"
}

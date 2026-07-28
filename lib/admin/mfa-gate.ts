/**
 * Mandatory admin MFA gate. Only a verified AAL2 session may use the console.
 * A known AAL1/no-factor state may render the enrolment path only; unknown Auth
 * state fails closed.
 */
export type AdminMfaState =
  | "enrollment-required"
  | "satisfied"
  | "step-up-required"
  | "unavailable"

export function resolveAdminMfaState(
  currentLevel: string | null | undefined,
  nextLevel: string | null | undefined
): AdminMfaState {
  const knownLevels = new Set(["aal1", "aal2"])
  if (
    !currentLevel ||
    !nextLevel ||
    !knownLevels.has(currentLevel) ||
    !knownLevels.has(nextLevel)
  ) {
    return "unavailable"
  }
  if (nextLevel === "aal1") {
    return "enrollment-required"
  }
  return currentLevel === "aal2" ? "satisfied" : "step-up-required"
}

/** True once the admin has a verified factor (drives shell display + nudges). */
export function isAdminMfaEnrolled(state: AdminMfaState): boolean {
  return state === "satisfied" || state === "step-up-required"
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

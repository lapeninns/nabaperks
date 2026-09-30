import type { ProfileGate } from "./types"

/**
 * Where a customer stands in the collection requirements for one reward.
 *
 * The union in `types.ts` says what is true about the profile; this says which
 * single thing the customer must do next, so no screen can tell them to present
 * a QR that is not available to them yet. Pure and shared: the view model
 * phrases the stage, the panels render it, and the harness exercises each one.
 *
 * - `details`  — name, date of birth or an email address is still missing.
 * - `email`    — an address is on file but its emailed code is unconfirmed.
 * - `phone`    — the phone number still needs verification.
 * - `id_check` — everything is saved; the venue still checks photo ID in person.
 * - `ready`    — nothing is outstanding, and the date of birth is verified.
 */
export type CollectionStage =
  "details" | "email" | "phone" | "id_check" | "ready"

export type CollectionSetup = {
  stage: CollectionStage
  /**
   * Something must be completed on the phone before the code can be shown.
   * `id_check` is deliberately false: the code is shown, the venue checks the
   * ID at the counter, and nothing is outstanding for the customer to enter.
   */
  outstanding: boolean
  /** The step this customer is on, and how many their setup actually has. */
  step: number
  total: number
}

/** The one instruction each stage leads with. */
export const COLLECTION_STAGE_INSTRUCTION: Record<CollectionStage, string> = {
  details: "Complete your details",
  email: "Verify your email",
  phone: "Verify your phone number",
  id_check: "Show your reward code",
  ready: "Show your reward code",
}

/**
 * Steps already completed are recognised rather than asked for again, while
 * pending contact verification is included in the remaining setup.
 */
export function collectionSetup(
  gate: ProfileGate,
  requiresAgeCheck = true
): CollectionSetup {
  const detailsSaved = Boolean(gate.fullName?.trim() && gate.dateOfBirth)
  if (detailsSaved && gate.emailLocked && gate.needsPhoneVerification) {
    return { stage: "phone", outstanding: true, step: 1, total: 1 }
  }
  if (!gate.complete && detailsSaved && gate.needsEmailVerification) {
    return {
      stage: "email",
      outstanding: true,
      step: 2,
      total: gate.needsPhoneVerification ? 3 : 2,
    }
  }

  if (!gate.complete) {
    // A verified, locked email is a step this customer will never be asked for.
    const total =
      (gate.emailLocked ? 1 : 2) + (gate.needsPhoneVerification ? 1 : 0)
    return { stage: "details", outstanding: true, step: 1, total }
  }

  const stage: CollectionStage =
    !requiresAgeCheck || gate.dateOfBirthVerified ? "ready" : "id_check"

  return { stage, outstanding: false, step: 1, total: 1 }
}

/**
 * A progress readout earns its place only when the customer has more than one
 * step to move through; "Step 1 of 1" is decoration, not information.
 */
export function collectionProgressVisible(setup: CollectionSetup): boolean {
  return setup.outstanding && setup.total > 1
}

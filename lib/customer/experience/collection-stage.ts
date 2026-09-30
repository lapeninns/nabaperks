import type { ProfileGate } from "./types"

/**
 * Where a customer stands in the collection requirements for one reward.
 *
 * The union in `types.ts` says what is true about the profile; this says which
 * single thing the customer must do next, so no screen can tell them to present
 * a QR that is not available to them yet. Pure and shared: the view model
 * phrases the stage, the panels render it, and the harness exercises each one.
 *
 * - `details`  — name or date of birth is still missing. That screen asks
 *                for those two fields only; the email is its own step.
 * - `email`    — name and date of birth are saved; the email address is
 *                missing, or on file awaiting its emailed code.
 * - `phone`    — the mobile number still needs confirming.
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
  details: "Add your name and date of birth",
  email: "Confirm your email",
  phone: "Confirm your mobile number",
  id_check: "Show your reward code",
  ready: "Show your reward code",
}

/**
 * The next unmet requirement and an honest step count.
 *
 * Order: details, then email, then mobile number. The count is fixed from the
 * first step so it reads 1 of 3, 2 of 3, 3 of 3 as the guest moves through:
 *
 * - details always counts (saved details count as a step already done);
 * - email counts unless it was already confirmed before setup (a guest who
 *   joined through the email fallback);
 * - the mobile number counts whenever it still needs confirming, so it is
 *   included from the very first step.
 *
 * A confirmed contact that is still ahead in the order can only be the one the
 * guest joined with, so it is never counted. The one case this cannot tell
 * apart is a guest with no confirmed contact at all (none can sign in today):
 * once they confirm an email mid-setup it is treated as their joining contact.
 */
export function collectionSetup(
  gate: ProfileGate,
  requiresAgeCheck = true
): CollectionSetup {
  if (gate.complete) {
    const stage: CollectionStage =
      !requiresAgeCheck || gate.dateOfBirthVerified ? "ready" : "id_check"
    return { stage, outstanding: false, step: 1, total: 1 }
  }

  const detailsSaved = Boolean(gate.fullName?.trim() && gate.dateOfBirth)
  const emailSteps = gate.emailLocked ? 0 : 1
  const phoneNeeded = gate.needsPhoneVerification === true
  const total = 1 + emailSteps + (phoneNeeded ? 1 : 0)

  if (!detailsSaved) {
    return { stage: "details", outstanding: true, step: 1, total }
  }
  if (!gate.emailLocked) {
    return { stage: "email", outstanding: true, step: 2, total }
  }
  if (phoneNeeded) {
    return { stage: "phone", outstanding: true, step: total, total }
  }
  // Incomplete for a reason no step here can fix (for example an under-age
  // date of birth, which the profile reads as missing): ask for details again.
  return { stage: "details", outstanding: true, step: 1, total: 1 }
}

/**
 * A progress readout earns its place only when the customer has more than one
 * step to move through; "Step 1 of 1" is decoration, not information.
 */
export function collectionProgressVisible(setup: CollectionSetup): boolean {
  return setup.outstanding && setup.total > 1
}

/**
 * Requirements already met, shown as a compact ticked list beside the next
 * step so nothing done is ever asked for again. Empty once nothing is
 * outstanding (the code screen needs no checklist).
 */
export function collectionDoneChecklist(gate: ProfileGate): string[] {
  if (gate.complete) return []
  const done: string[] = []
  if (gate.fullName?.trim() && gate.dateOfBirth) {
    done.push("Name and date of birth saved")
  }
  if (gate.emailLocked) done.push("Email confirmed")
  if (gate.needsPhoneVerification === false) {
    done.push("Mobile number confirmed")
  }
  return done
}

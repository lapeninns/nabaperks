/**
 * Pure rules and copy for staff redemption of a discount pass. No `server-only`
 * and no Supabase, so the deep-link page, the server action, the client form
 * and the unit tests all share one implementation — and so the branch-heavy
 * status handling stays out of the route's complexity budget.
 *
 * Two attestations, and only two. The no-stacking confirmation is ALWAYS
 * required; the ID confirmation is required if and only if the campaign asked
 * for one. Neither records anything about the customer: no document number, no
 * image, no date of birth, and no bill amount. They are booleans saying a
 * member of staff looked, and redeem_offer_pass enforces the same rule in the
 * database.
 */

/** Every state the staff deep link can render. Mirrors get_offer_pass_scan_context. */
export const OFFER_PASS_SCAN_STATUSES = [
  "ready",
  "redeemed",
  "blocked",
  "expired",
  "unauthorized",
] as const
export type OfferPassScanStatus = (typeof OFFER_PASS_SCAN_STATUSES)[number]

export type OfferPassAttestationInput = {
  readonly requiresIdCheck: boolean
  readonly idChecked: boolean
  readonly noStacking: boolean
}

export type OfferPassAttestationResult =
  | {
      readonly ok: true
      readonly idChecked: boolean
      readonly noStacking: true
    }
  | {
      readonly ok: false
      readonly errors: {
        readonly idCheck?: string
        readonly noStacking?: string
      }
    }

/** Shown beside the no-stacking checkbox and repeated in the review readback. */
export const OFFER_PASS_NO_STACKING_LABEL =
  "I have checked this discount is not being used with another reward or offer."

/** Shown beside the ID checkbox, only when the campaign requires one. */
export const OFFER_PASS_ID_CHECK_LABEL = "I have checked the member's photo ID."

const NO_STACKING_ERROR =
  "Confirm the discount is not being combined with another reward or offer."
const ID_CHECK_ERROR = "This offer needs an ID check before it can be redeemed."

/**
 * Validate the two attestations. `noStacking` is unconditional; `idChecked` is
 * required exactly when `requiresIdCheck` is true and is otherwise recorded as
 * given without being demanded.
 */
export function validateOfferPassAttestations(
  input: OfferPassAttestationInput
): OfferPassAttestationResult {
  const errors: { idCheck?: string; noStacking?: string } = {}

  if (!input.noStacking) errors.noStacking = NO_STACKING_ERROR
  if (input.requiresIdCheck && !input.idChecked) errors.idCheck = ID_CHECK_ERROR

  if (errors.idCheck || errors.noStacking) return { ok: false, errors }

  return { ok: true, idChecked: input.idChecked, noStacking: true }
}

/**
 * The two StatusBanner tones this flow uses, declared here rather than imported
 * so `lib/` keeps its back to `components/`. Both members exist in
 * StatusBannerTone, so the value passes straight through to <StatusBanner>.
 */
export type OfferPassBannerTone = "success" | "warning"

export type OfferPassScanBanner = {
  readonly title: string
  readonly tone: OfferPassBannerTone
  readonly body: string
}

/**
 * Status to banner. Extracted from the page so the route stays a thin shell and
 * the copy can be asserted directly.
 */
export function offerPassScanBanner(
  status: OfferPassScanStatus,
  blockedReason?: string
): OfferPassScanBanner {
  switch (status) {
    case "ready":
      return {
        title: "Ready to redeem",
        tone: "success",
        body: "Check the discount against the order, then confirm below.",
      }
    case "redeemed":
      return {
        title: "Code already used",
        tone: "success",
        body: "This code has been used. The pass itself still works — ask the member to show a fresh code from their pass.",
      }
    case "expired":
      return {
        title: "Code expired",
        tone: "warning",
        body: "This code has expired. Ask the member to show their pass again for a fresh code.",
      }
    case "unauthorized":
      return {
        title: "Pass not matched",
        tone: "warning",
        body: "This pass belongs to another venue.",
      }
    case "blocked":
      return {
        title: "Cannot redeem this pass",
        tone: "warning",
        body: blockedReason ?? "This pass cannot be redeemed right now.",
      }
  }
}

/** Human summary of the discount, e.g. "10% off". */
export function offerPassDiscountLabel(discountPercent: number): string {
  return `${discountPercent}% off`
}

/**
 * "Valid until 12 August 2026" for a snapshotted pass window. Returns null for
 * anything that is not a real calendar date, so the surface omits the line
 * rather than printing "Invalid Date".
 */
export function offerPassValidityLabel(validTo: string | null): string | null {
  if (!validTo) return null

  const parsed = Date.parse(`${validTo}T00:00:00Z`)
  if (Number.isNaN(parsed)) return null

  return `Valid until ${new Date(parsed).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })}`
}

import {
  LOYALTY_INVITE_MAX_RECIPIENTS,
  isLoyaltyInviteLegalBasis,
} from "@/lib/loyalty-invites/constants"
import { parseInviteEmailInput } from "@/lib/loyalty-invites/import-core"

/**
 * Pure validation for the merchant "Invite customers" form (no server-only, no
 * Supabase — unit-tested directly). Mirrors lib/merchant/send-reward-fields.ts.
 */

export const LOYALTY_INVITE_SEND_SUCCESS =
  "Invitations are on their way. We'll send them over the next few minutes."

export type LoyaltyInviteRecipientsResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string }

export function validateInviteRecipients(
  raw: string
): LoyaltyInviteRecipientsResult {
  const parsed = parseInviteEmailInput(raw)
  if (parsed.validCount === 0) {
    return { ok: false, error: "Add at least one valid email address." }
  }
  if (parsed.overLimit) {
    return {
      ok: false,
      error: `You can invite up to ${LOYALTY_INVITE_MAX_RECIPIENTS.toLocaleString(
        "en-GB"
      )} addresses at a time.`,
    }
  }
  return { ok: true }
}

export type LoyaltyInviteConfirmErrors = {
  legalBasis?: string
  attestation?: string
}

export function validateInviteConfirm(
  legalBasis: string,
  attested: boolean
): { ok: boolean; errors: LoyaltyInviteConfirmErrors } {
  const errors: LoyaltyInviteConfirmErrors = {}
  if (!isLoyaltyInviteLegalBasis(legalBasis)) {
    errors.legalBasis = "Select the lawful basis for emailing these customers."
  }
  if (!attested) {
    errors.attestation = "Confirm the lawful basis before sending."
  }
  return { ok: Object.keys(errors).length === 0, errors }
}

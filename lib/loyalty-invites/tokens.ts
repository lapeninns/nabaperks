import "server-only"

import { createHash, createHmac } from "node:crypto"

import { requiredCustomerSessionSecret } from "@/lib/security/customer-session-secret"

/**
 * Claim and unsubscribe tokens for a bulk loyalty invitation.
 *
 * The plan requires two independent 256-bit tokens per recipient of which only
 * the *hashes* are stored, yet the cron that sends the email runs long after the
 * campaign was drafted — so the raw token must be reproducible at send time
 * without being persisted. Both tokens are therefore keyed HMAC-SHA256
 * derivations of the recipient's row id, domain-separated by purpose. They are
 * 256-bit and unforgeable without the server secret, and only `hashInviteToken`
 * output (a plain SHA-256) is ever written to the database.
 */

type InviteTokenPurpose = "claim" | "unsubscribe"

function deriveToken(recipientId: string, purpose: InviteTokenPurpose): string {
  return createHmac("sha256", requiredCustomerSessionSecret())
    .update(`nabaperks:loyalty-invite:v1:${purpose}:${recipientId}`)
    .digest("base64url")
}

export function inviteClaimToken(recipientId: string): string {
  return deriveToken(recipientId, "claim")
}

export function inviteUnsubscribeToken(recipientId: string): string {
  return deriveToken(recipientId, "unsubscribe")
}

/** SHA-256 hex of a token — the only form written to the database. */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export type InviteTokenSet = {
  readonly recipientId: string
  readonly claimToken: string
  readonly unsubscribeToken: string
  readonly claimTokenHash: string
  readonly unsubscribeTokenHash: string
}

export function inviteTokenSet(recipientId: string): InviteTokenSet {
  const claimToken = inviteClaimToken(recipientId)
  const unsubscribeToken = inviteUnsubscribeToken(recipientId)
  return {
    recipientId,
    claimToken,
    unsubscribeToken,
    claimTokenHash: hashInviteToken(claimToken),
    unsubscribeTokenHash: hashInviteToken(unsubscribeToken),
  }
}

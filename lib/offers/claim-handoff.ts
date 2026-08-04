/**
 * The two decisions the venue join form has to make about an offer handoff,
 * kept pure so they can be proved without a request, a cookie or a database.
 *
 * Both are about not destroying something the customer cannot get back: a join
 * happens once, and an offer is only ever for a customer who is not already a
 * member, so anything that creates the membership early or throws the handoff
 * away early costs the customer the benefit permanently.
 */

export type ClaimHandoff = "invite" | "offer"

/**
 * Which claim handoff the join form should try first.
 *
 * A customer can hold both a loyalty-invitation cookie (set by /invite/[token])
 * and an offer cookie (set by /offer/[token]) for the same venue at the same
 * time: each lasts an hour, and neither landing page knows about the other. A
 * fixed order let whichever branch happened to run first win, so an invitation
 * opened fifty minutes ago would create the membership and silently beat an
 * offer the customer started seconds ago — and, being a member from that moment,
 * they could never claim the offer at all.
 *
 * Both cookies carry an absolute expiry stamped from the same one-hour lifetime,
 * so the later expiry is the later start. The most recently started claim goes
 * first, in either direction. Pass `null` for a handoff that is absent or bound
 * to another venue; the order is then immaterial, because the branch that has no
 * cookie does nothing and falls through to the next one.
 *
 * A tie — both started within the same second — keeps the historical order.
 */
export function claimHandoffOrder(expiresAt: {
  readonly invite: number | null
  readonly offer: number | null
}): readonly [ClaimHandoff, ClaimHandoff] {
  const { invite, offer } = expiresAt
  if (invite === null || offer === null) return ["invite", "offer"]
  return offer > invite ? ["offer", "invite"] : ["invite", "offer"]
}

/**
 * The outcomes of `claim_offer_campaign` that will not change if the customer
 * tries again, and which therefore spend the handoff cookie.
 *
 * `claimed`, `already_claimed` and `already_member` are settled facts about a
 * membership. `expired`, `not_started` and `paused` are the campaign's own
 * answer about its window, and `invalid` means the link is unknown, rotated or
 * ended. None of them improves on a retry.
 *
 * Everything else is deliberately absent, and that absence is the point:
 * `unavailable` (the venue switched off, the card unreadable), `card_too_short`,
 * a transport failure and any status a future database build returns that this
 * one does not recognise all leave the cookie in place. Clearing it on those
 * would mean the retry the message invites carries no offer at all — the
 * customer would get an ordinary join, no benefit, and be an existing member
 * from then on.
 */
export const FINAL_OFFER_CLAIM_STATUSES = [
  "claimed",
  "already_claimed",
  "already_member",
  "expired",
  "not_started",
  "paused",
  "invalid",
] as const

export function isFinalOfferClaimOutcome(
  status: string | null | undefined
): boolean {
  if (typeof status !== "string") return false
  return (FINAL_OFFER_CLAIM_STATUSES as readonly string[]).includes(status)
}

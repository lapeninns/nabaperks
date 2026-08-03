/**
 * Pure view helpers for the customer's discount passes.
 *
 * Deliberately free of imports: the loader in `lib/customer/offer-pass.ts` is
 * `server-only` and reaches Supabase and the customer session, so nothing there
 * can be exercised by a unit test. The two decisions worth pinning — which card
 * a pass belongs beside, and what the join flow just decided about an offer —
 * live here instead, where they can be tested directly.
 */

type MembershipScopedPass = { readonly membershipId: string }

/**
 * Buckets a customer's passes by the card they belong to. The home screen holds
 * one tile per membership, and a pass is a promise against one venue, so each
 * tile shows only its own.
 */
export function groupOfferPassesByMembership<T extends MembershipScopedPass>(
  passes: readonly T[]
): ReadonlyMap<string, readonly T[]> {
  const grouped = new Map<string, T[]>()

  for (const pass of passes) {
    const bucket = grouped.get(pass.membershipId)
    if (bucket) {
      bucket.push(pass)
    } else {
      grouped.set(pass.membershipId, [pass])
    }
  }

  return grouped
}

/**
 * What the join flow just decided about an offer, as carried on the redirect
 * back to the card by `app/m/[merchantSlug]/join/actions.ts`.
 *
 * - `claimed` — `?welcome=1&offer=1`, the pass was issued.
 * - `already_claimed` — `?offer=claimed`, a second scan of the same poster.
 * - `already_member` — `?membership=existing`, the welcome is for new members.
 *
 * `?membership=existing` is emitted by the loyalty-invite claim too, so it says
 * only that the customer was already a member — never which welcome was
 * refused. Any other value, or none, is not a claim outcome and says nothing.
 */
export type OfferClaimNotice = "claimed" | "already_claimed" | "already_member"

export function offerClaimNoticeFromParams(params: {
  readonly offer?: string
  readonly membership?: string
}): OfferClaimNotice | null {
  if (params.offer === "1") return "claimed"
  if (params.offer === "claimed") return "already_claimed"
  if (params.membership === "existing") return "already_member"
  return null
}

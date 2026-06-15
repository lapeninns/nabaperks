import type { CustomerExperienceEntry, CustomerExperienceKind } from "./types"

/**
 * Route-aware priority tables.
 *
 * The same backend facts can satisfy several states at once (e.g. a ready reward
 * *and* a valid stamp QR). Each route lists its states from highest to lowest
 * priority so derivation resolves ambiguity deterministically instead of relying
 * on the order of `if` branches. `unavailable` is always first — access and
 * availability problems win everywhere.
 */
export const CARD_PRIORITY = [
  "unavailable",
  "card_collecting",
] as const satisfies readonly CustomerExperienceKind[]

export const STAMP_PRIORITY = [
  "unavailable",
  "reward_ready",
  "reward_waiting",
  "card_stamped_today",
  "stamp_confirm",
] as const satisfies readonly CustomerExperienceKind[]

export const REWARD_PRIORITY = [
  "unavailable",
  "redeemed_proof",
  "reward_qr_pending",
  "reward_ready",
  "reward_waiting",
] as const satisfies readonly CustomerExperienceKind[]

export const JOIN_PRIORITY = [
  "unavailable",
  "join_returning",
  "join_terms",
  "join_otp",
  "join_phone",
  "join_welcome",
] as const satisfies readonly CustomerExperienceKind[]

export const PRIORITY_BY_ENTRY: Record<
  CustomerExperienceEntry,
  readonly CustomerExperienceKind[]
> = {
  qr: CARD_PRIORITY,
  card: CARD_PRIORITY,
  stamp: STAMP_PRIORITY,
  reward: REWARD_PRIORITY,
  join: JOIN_PRIORITY,
}

/**
 * Pick the highest-priority kind for a route from the set of kinds the facts
 * currently satisfy. Returns `undefined` when no candidate is allowed on the
 * route (callers fall back to `unavailable`).
 */
export function pickByPriority(
  entry: CustomerExperienceEntry,
  candidates: readonly CustomerExperienceKind[]
): CustomerExperienceKind | undefined {
  const order = PRIORITY_BY_ENTRY[entry]
  const allowed = new Set(candidates)
  return order.find((kind) => allowed.has(kind))
}

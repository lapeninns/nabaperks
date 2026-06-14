import "server-only"

import { ukTodayIso } from "./uk-calendar"

export { ukTodayIso }

/**
 * Reward `redeemable_from` values are stored as UK business dates, and the
 * customer card view compares them lexically against this string — we mirror
 * that here so the home and reward views agree on what is redeemable.
 */
export function isRedeemableFrom(redeemableFrom: string | null) {
  return !redeemableFrom || redeemableFrom <= ukTodayIso()
}

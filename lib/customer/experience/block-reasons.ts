import type { StampBlockReason } from "./types"

import { LOYALTY_PROGRAMME_UNAVAILABLE } from "@/lib/copy/product-copy"

type CustomerBlockReason = StampBlockReason | "billing_required"

/**
 * Single source of truth for turning a stamp/redeem RPC failure into a typed
 * {@link StampBlockReason}. UI panels never inspect raw strings — they read the
 * typed reason and `blockReasonCopy()` for safe customer-facing wording.
 *
 * PREFER THE SQLSTATE. `20260805100100` gives every stamp refusal a stable
 * `NBS..` code, and {@link stampBlockReasonFromSqlState} maps those. Matching on
 * the English text of an exception was brittle in both directions: the literals
 * live in a different file from the matcher, so a copy edit silently
 * reclassified a refusal, and one arm was already wrong — "A reward is already
 * ready to redeem" fell into the generic `not active` catch-all.
 *
 * The substring table below is retained ONLY as a fallback for refusals raised
 * by functions that have not yet been given codes (redeem_self_service_reward
 * and the reward-scan path). Once those carry SQLSTATEs it can be deleted.
 */

/**
 * Stable refusal codes raised by the stamping path. Mirrors the NBS.. table in
 * supabase/migrations/20260805100100_stamp_refusal_codes_and_location_verification.sql
 * and must move in the same change as that migration.
 */
const STAMP_SQLSTATE_REASONS: Readonly<Record<string, CustomerBlockReason>> = {
  NBS01: "already_stamped_today",
  NBS02: "reward_ready_first",
  NBS03: "pool_unavailable",
  NBS04: "unavailable",
  NBS05: "billing_required",
  NBS06: "unavailable",
  NBS07: "unavailable",
  NBS08: "unavailable",
  NBS10: "location_out_of_range",
  NBS11: "location_required",
}

/**
 * Typed reason for a SQLSTATE, or null when the code is not one of ours so the
 * caller can fall back to the message table.
 */
export function stampBlockReasonFromSqlState(
  code: string | null | undefined
): CustomerBlockReason | null {
  if (!code) return null
  return STAMP_SQLSTATE_REASONS[code.trim().toUpperCase()] ?? null
}
/**
 * Ordered RPC-message → typed-reason rules. First match wins, so the more
 * specific phrases sit above the generic `not active` / `unavailable` catch-all.
 * Notes: `required before unlocking a reward` covers both the stamp RPC ("At
 * least 3 active reward pool items…") and the older redeem-cycle wording ("At
 * least one active reward pool item…"); ownership / not-found come from the RPC
 * tenant guards (normally gated upstream) and map to calm copy for direct calls.
 */
const STAMP_BLOCK_RULES: ReadonlyArray<
  readonly [readonly string[], CustomerBlockReason]
> = [
  [["Stamp already issued for this UK business day"], "already_stamped_today"],
  [["A reward is already ready to redeem"], "reward_ready_first"],
  [["This merchant loyalty programme is not active yet"], "billing_required"],
  [["Rate limit exceeded"], "rate_limited"],
  [["required before unlocking a reward"], "pool_unavailable"],
  [
    [
      "not redeemable until the next UK business day",
      "Reward is not redeemable",
      "Reward already redeemed",
    ],
    "unavailable",
  ],
  [
    ["Authentication required", "Verified customer required"],
    "unauthenticated",
  ],
  [["Complete your profile"], "profile_incomplete"],
  [
    ["ownership required", "Membership not found", "Reward not found"],
    "unavailable",
  ],
  [["not active", "unavailable"], "unavailable"],
]

export function toStampBlockReason(
  message: string,
  code?: string | null
): CustomerBlockReason {
  const coded = stampBlockReasonFromSqlState(code)
  if (coded) return coded

  for (const [needles, reason] of STAMP_BLOCK_RULES) {
    if (needles.some((needle) => message.includes(needle))) return reason
  }
  return "unknown"
}

/** Calm, customer-facing copy for each typed block reason. */
export function blockReasonCopy(reason: CustomerBlockReason): string {
  switch (reason) {
    case "already_stamped_today":
      return "You're already stamped today. Come back on the next UK business day."
    case "reward_ready_first":
      return "Your reward is ready — redeem it before collecting more stamps."
    case "billing_required":
      return "This venue isn't taking stamps yet."
    case "rate_limited":
      return "You're going a little fast. Wait a few minutes, then try again."
    case "pool_unavailable":
      return "Your reward is almost ready. The venue is still finishing its reward setup, so ask a team member."
    case "unauthenticated":
      return "Verify your identity from the venue QR before continuing."
    case "profile_incomplete":
      return "Add your details before collection — a name and date of birth, plus a verified email if you add one."
    case "location_out_of_range":
      // Positive evidence of absence: the device reported a position and it is
      // not the venue. Named plainly, without accusing anyone of anything.
      return "This stamp needs you to be at the venue. Collect it next time you visit."
    case "location_required":
      // The grace budget is spent. The copy has to name the fix, because the
      // customer is standing in the venue and the phone is the problem.
      return "Turn on location for this venue to collect your stamp, then scan again."
    case "unavailable":
      return LOYALTY_PROGRAMME_UNAVAILABLE
    case "unknown":
      return "That didn't go through. Try again or ask the venue team."
  }
}

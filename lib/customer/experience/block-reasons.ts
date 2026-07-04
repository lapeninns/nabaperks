import type { StampBlockReason } from "./types"

import { LOYALTY_PROGRAMME_UNAVAILABLE } from "@/lib/copy/product-copy"

type CustomerBlockReason = StampBlockReason | "billing_required"

/**
 * Single source of truth for turning a raw stamp/redeem RPC error message into a
 * typed {@link StampBlockReason}. UI panels never inspect raw strings — they read
 * the typed reason and `blockReasonCopy()` for safe customer-facing wording.
 *
 * Keep these substrings in sync with the database functions in
 * `supabase/migrations/*` (issue_self_service_stamp / redeem_self_service_reward).
 */
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
  [
    ["This merchant loyalty programme is not active yet"],
    "billing_required",
  ],
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

export function toStampBlockReason(message: string): CustomerBlockReason {
  for (const [needles, reason] of STAMP_BLOCK_RULES) {
    if (needles.some((needle) => message.includes(needle))) return reason
  }
  return "unknown"
}

/** Calm, customer-facing copy for each typed block reason. */
export function blockReasonCopy(reason: CustomerBlockReason): string {
  switch (reason) {
    case "already_stamped_today":
      return "You're already stamped today. Come back tomorrow."
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
    case "unavailable":
      return LOYALTY_PROGRAMME_UNAVAILABLE
    case "unknown":
      return "That didn't go through. Try again or ask the venue team."
  }
}

import type { StampBlockReason } from "./types"

/**
 * Single source of truth for turning a raw stamp/redeem RPC error message into a
 * typed {@link StampBlockReason}. UI panels never inspect raw strings — they read
 * the typed reason and `blockReasonCopy()` for safe customer-facing wording.
 *
 * Keep these substrings in sync with the database functions in
 * `supabase/migrations/*` (issue_self_service_stamp / redeem_self_service_reward).
 */
export function toStampBlockReason(message: string): StampBlockReason {
  if (message.includes("Stamp already issued for this UK business day")) {
    return "already_stamped_today"
  }

  if (message.includes("A reward is already ready to redeem")) {
    return "reward_ready_first"
  }

  if (
    message.includes("not redeemable until the next UK business day") ||
    message.includes("Reward is not redeemable") ||
    message.includes("Reward already redeemed")
  ) {
    return "unavailable"
  }

  if (message.includes("Authentication required")) {
    return "unauthenticated"
  }

  if (message.includes("Complete your profile")) {
    return "profile_incomplete"
  }

  if (message.includes("not active") || message.includes("unavailable")) {
    return "unavailable"
  }

  return "unknown"
}

/** Calm, customer-facing copy for each typed block reason. */
export function blockReasonCopy(reason: StampBlockReason): string {
  switch (reason) {
    case "already_stamped_today":
      return "You're already stamped today. Come back tomorrow."
    case "reward_ready_first":
      return "Your reward is ready - redeem it before collecting more stamps."
    case "invalid_qr":
    case "wrong_merchant":
      return "Scan the venue code to add your stamp."
    case "expired_qr":
      return "Scan the venue code again to add your stamp."
    case "unauthenticated":
      return "Verify your identity from the venue QR before continuing."
    case "profile_incomplete":
      return "Add your details to redeem - a name and date of birth, plus a verified email if you add one."
    case "unavailable":
      return "This loyalty programme is unavailable right now."
    case "unknown":
      return "That didn't go through. Try again or ask the venue team."
  }
}

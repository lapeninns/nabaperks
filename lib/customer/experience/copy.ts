import { OPEN_MY_CARDS_LABEL } from "@/lib/copy/product-copy"
import { formatStampDisplayDateFromIso } from "@/lib/customer/uk-calendar"
import { buildCustomerJoinHref } from "@/lib/navigation/customer-join-intent"

import { assertNever, type CustomerExperience } from "./types"

/**
 * View-model copy for each customer experience. This is the *only* place the
 * journey is phrased — the union in `types.ts` says what is true, this says how
 * it reads. Panels take both: the experience for domain visuals, the view model
 * for headline / support line / primary CTA.
 *
 * `primaryAction` is the screen's single primary call to action when it is a
 * navigation. States whose primary action is a form (stamp, redeem, phone, otp,
 * terms) leave it undefined and the panel renders the form instead.
 */
export type CustomerExperienceViewModel = {
  eyebrow: string
  headline: string
  supportLine?: string
  primaryAction?: { label: string; href: string }
}

type CardCollectingExperience = Extract<
  CustomerExperience,
  { kind: "card_collecting" }
>

type RewardExperience =
  | Extract<CustomerExperience, { kind: "reward_waiting" }>
  | Extract<CustomerExperience, { kind: "reward_ready" }>

type UnavailableExperience = Extract<
  CustomerExperience,
  { kind: "unavailable" }
>

/** QR-scan welcome — mirrors join-with-first-stamp: scan → verify → terms → stamp. */
export const JOIN_WELCOME_HOW_IT_WORKS = [
  "You scanned the venue QR",
  "Confirm your number with one WhatsApp message",
  "Your first stamp lands on your card",
] as const

export const JOIN_WELCOME_HOW_IT_WORKS_LABEL = "How it works" as const

export const JOIN_WELCOME_PHONE_REASSURANCE =
  "Already have a card here? Same number, same card." as const

/** Shown under the phone field on step 2 — sets expectation before the SMS arrives. */
export const JOIN_PHONE_CODE_HINT = "We'll send you a one-time code." as const

/** Join-only number guidance: the promise, not the plumbing. */
export const JOIN_PHONE_RETENTION_HINT =
  "Only used to keep your stamps safe. No spam, ever." as const

/** Returns to the QR welcome card when the customer wants the full preview again. */
export const JOIN_PHONE_BACK_LABEL = "What do I get?" as const

/** The reward hook — keeps *why* in one line on every join step. */
export function joinUnlockingRewardHook(stampsRequired: number): string {
  const stamps = Math.max(stampsRequired, 1)
  return stamps === 1
    ? "Just 1 stamp to a mystery reward"
    : `Just ${stamps} stamps to a mystery reward`
}

/**
 * The line under the final button. Guest-facing: what they keep, not how the
 * system checks it. Operational policy (location checks, the stamp calendar)
 * lives in the venue terms and privacy notice, one tap away on every step.
 */
export function joinCompletionHint({ hasQr }: { hasQr: boolean }): string {
  return hasQr
    ? "Your stamp and card stay saved to this number."
    : "Your card is saved to this number, ready for your first visit."
}

/**
 * Reward overnight-hold timing. `redeemable_from` is the *next UK business date*,
 * which skips weekends and bank holidays — so "tomorrow" is wrong on a Friday.
 * Render the real reopening date when known, else "the next opening day".
 */
export function waitingRewardTiming(redeemableFrom: string | null): string {
  if (redeemableFrom) {
    return `It's yours from ${formatStampDisplayDateFromIso(redeemableFrom)}.`
  }
  return "It's yours from the next opening day."
}

export function getCustomerExperienceViewModel(
  exp: CustomerExperience
): CustomerExperienceViewModel {
  switch (exp.kind) {
    case "join_welcome":
      // Shown to anyone who scans the venue QR while logged out. Returning
      // members verify and route to their card; new members finish terms and
      // earn stamp #1 in the same onboarding call.
      return {
        eyebrow: "Stamp 1 is ready",
        headline: "Your first stamp is ready",
        supportLine:
          "Save it to your number in 20 seconds. No app, no password, and it's there on every visit.",
        primaryAction: {
          label: "Claim my first stamp",
          href: buildCustomerJoinHref(exp.merchant.slug, {
            qrId: exp.qrId,
            step: "phone",
          }),
        },
      }
    case "join_phone":
      return {
        eyebrow: "One message, no password",
        headline: "Save your stamp to your number",
        supportLine: `One WhatsApp message confirms it's you. Your ${exp.merchant.name} card then follows you on every visit.`,
      }
    case "join_otp":
      return {
        eyebrow: "Check your messages",
        headline: "Enter your code",
        supportLine: "It's in the message we just sent you.",
      }
    case "join_terms":
      return exp.qrId
        ? {
            eyebrow: "Last step",
            headline: "Collect your first stamp",
            supportLine: "One tick and stamp 1 is on your card.",
          }
        : {
            eyebrow: "Last step",
            headline: "Save your loyalty card",
            supportLine:
              "One tick and your card is saved for your first visit.",
          }
    case "join_returning":
      return {
        eyebrow: "Welcome back",
        headline: `${exp.current} of ${exp.total} stamps saved`,
        supportLine: `Your ${exp.merchant.name} card is already on this number.`,
        primaryAction: {
          label: exp.qrId ? "Continue to today's stamp" : "Open my card",
          href: exp.qrId
            ? `/card/${exp.membershipId}/stamp?qr=${encodeURIComponent(exp.qrId)}`
            : `/card/${exp.membershipId}`,
        },
      }
    case "stamp_confirm":
      return {
        eyebrow: "Today's stamp",
        headline: "Stamp it here",
        supportLine: exp.merchantName,
      }
    case "card_stamped_today":
      if (exp.reward) {
        return {
          eyebrow: "Reward unlocked",
          headline: "Your reward is unlocked",
          supportLine:
            "Your completed card is safe. Open the reward for the collection date.",
          primaryAction: {
            label: "See your reward",
            href: `/reward/${exp.reward.rewardId}`,
          },
        }
      }
      return {
        eyebrow: "Today's stamp",
        headline: "You're stamped for today",
        supportLine:
          "Come back on the next UK business day to keep building your card.",
        primaryAction: {
          label: "View card",
          href: `/card/${exp.membershipId}`,
        },
      }
    case "card_collecting":
      return cardCollectingViewModel(exp)
    case "reward_waiting":
    case "reward_ready":
      return rewardViewModel(exp)
    case "redeemed_proof":
      return {
        eyebrow: "Reward collected",
        headline: exp.reward.rewardName,
        supportLine: "Your reward has been collected.",
        primaryAction: {
          label: "Back to card",
          href: `/card/${exp.reward.membershipId}`,
        },
      }
    case "unavailable":
      return unavailableViewModel(exp)
    default:
      return assertNever(exp)
  }
}

function cardCollectingViewModel(
  exp: CardCollectingExperience
): CustomerExperienceViewModel {
  return exp.justJoined
    ? {
        eyebrow: exp.merchantName,
        headline: `Welcome to ${exp.merchantName}`,
        supportLine: exp.cardName,
      }
    : {
        eyebrow: exp.merchantName,
        headline: exp.cardName,
      }
}

function rewardViewModel(exp: RewardExperience): CustomerExperienceViewModel {
  // The support line matches the state below it (CUS-P2-09): while the reward
  // waits there is no QR to show, so the line carries the unlock timing
  // instead of inviting a counter visit the banner underneath then cancels.
  return {
    eyebrow: "Reward",
    headline: exp.reward.rewardName,
    supportLine:
      exp.kind === "reward_waiting"
        ? waitingRewardSupportLine(exp.reward.redeemableFrom)
        : `${exp.merchantName} — show this at the counter.`,
  }
}

function waitingRewardSupportLine(redeemableFrom: string | null): string {
  if (redeemableFrom) {
    return `Unlocked — yours from ${formatStampDisplayDateFromIso(redeemableFrom)}.`
  }
  return "Unlocked — yours from the next opening day."
}

function unavailableViewModel(
  exp: UnavailableExperience
): CustomerExperienceViewModel {
  return {
    eyebrow: "Nabaperks loyalty",
    headline: "Card unavailable",
    supportLine: exp.reason,
    primaryAction: exp.recovery
      ? { label: OPEN_MY_CARDS_LABEL, href: exp.recovery.loginHref }
      : undefined,
  }
}

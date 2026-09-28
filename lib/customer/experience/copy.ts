import { OPEN_MY_CARDS_LABEL } from "@/lib/copy/product-copy"
import { formatCollectionAvailability } from "@/lib/customer/reward-collection-state"
import { buildCustomerJoinHref } from "@/lib/navigation/customer-join-intent"

import {
  COLLECTION_STAGE_INSTRUCTION,
  collectionSetup,
} from "./collection-stage"
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
  "Confirm it's you with one code",
  "Your first stamp lands on your card",
] as const

export const JOIN_WELCOME_HOW_IT_WORKS_LABEL = "How it works" as const

/**
 * Under the welcome CTA. The name predates email sign-in; the copy stays true
 * whichever method leads: the wallet is found by the contact it was joined
 * with, so the same phone number or email opens the same card.
 */
export const JOIN_WELCOME_PHONE_REASSURANCE =
  "Already have a card here? Sign in the same way as before." as const

/** Shown under the phone field on step 2 — sets expectation before the SMS arrives. */
export const JOIN_PHONE_CODE_HINT = "We'll send you a one-time code." as const

/** Join-only number guidance: the promise, not the plumbing. */
export const JOIN_PHONE_RETENTION_HINT =
  "Only used to keep your stamps safe. No spam, ever." as const

/** Under the email field: why email helps at a venue with no signal. */
export const JOIN_EMAIL_WIFI_HINT =
  "Works over the venue's Wi-Fi, even with no mobile signal." as const

/** When the email provider failed to take a join code (plan section 7). */
export const JOIN_EMAIL_DELAYED =
  "Email codes are delayed. Try again shortly or use your phone." as const

/** Shown on the email code step once the code has had time to arrive. */
export const JOIN_EMAIL_SPAM_HINT =
  "Not there yet? Check your spam or junk folder." as const

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
export function joinCompletionHint({
  hasQr,
  savedTo = "number",
}: {
  hasQr: boolean
  /** A wallet with no phone number is saved to its email. */
  savedTo?: "number" | "email"
}): string {
  const target = savedTo === "email" ? "your email" : "this number"
  return hasQr
    ? `Your stamp and card stay saved to ${target}.`
    : `Your card is saved to ${target}, ready for your first visit.`
}

export function waitingRewardTiming(
  availableFrom: string | null,
  nextWindow: string | null = null
): string {
  const timing = formatCollectionAvailability(availableFrom ?? nextWindow)
  return timing
    ? `${timing.replace("Ready", "It's yours from")}.`
    : "Check back shortly for the collection time."
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
          exp.contactStep === "email"
            ? "Save it with your email in 20 seconds. No app, no password, and it's there on every visit."
            : "Save it to your number in 20 seconds. No app, no password, and it's there on every visit.",
        primaryAction: {
          label: "Claim my first stamp",
          href: buildCustomerJoinHref(exp.merchant.slug, {
            qrId: exp.qrId,
            step: exp.contactStep,
          }),
        },
      }
    case "join_phone":
      return {
        eyebrow: "One message, no password",
        headline: "Save your stamp to your number",
        supportLine: `One message confirms it's you. Your ${exp.merchant.name} card then follows you on every visit.`,
      }
    case "join_email":
      return {
        eyebrow: "One email, no password",
        headline: "Save your stamp with your email",
        supportLine: `One code by email confirms it's you. Your ${exp.merchant.name} card then follows you on every visit.`,
      }
    case "join_email_choice":
      return exp.canCreate
        ? {
            eyebrow: "Email confirmed",
            headline: "Have you collected stamps with Nabaperks before?",
            supportLine:
              "Your stamps stay on the wallet you first joined with. You can add this email to it once you're signed in.",
          }
        : {
            eyebrow: "Email confirmed",
            headline: "No wallet uses this email yet",
            supportLine:
              "Use the phone number you joined with. You can add this email to your wallet once you're signed in.",
          }
    case "join_otp":
      return exp.contact.method === "email"
        ? {
            eyebrow: "Check your email",
            headline: "Enter your code",
            // A failed send is never described as an email on its way.
            supportLine: exp.contact.deliveryDelayed
              ? "If the email doesn't arrive, send a new code or use your phone."
              : "It's in the email we just sent you.",
          }
        : {
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
        supportLine: `Your ${exp.merchant.name} card is already in your wallet.`,
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
          "Come back on the next venue trading day to keep building your card.",
        primaryAction: {
          label: "View card",
          href: `/card/${exp.membershipId}`,
        },
      }
    case "stamp_unmatched":
      // The shell carries the one headline and a reassurance; the panel's
      // band beneath the card carries the instruction, so the two never
      // repeat each other. No primaryAction: the panel renders the shared
      // recovery pair (scan again / open my cards) itself.
      return exp.problem === "missing"
        ? {
            eyebrow: "Today's stamp",
            headline: "Open this from the venue QR",
            supportLine: `Your ${exp.merchantName} card is safe — nothing has changed.`,
          }
        : {
            eyebrow: "Today's stamp",
            headline: "That QR didn't match this card",
            supportLine: `Your ${exp.merchantName} stamps are safe — nothing has changed.`,
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

/**
 * The headline is the one thing this customer must do *now* (CUS-P2-09). While
 * anything is outstanding it names that step, so no screen asks for a code the
 * customer cannot produce yet; once nothing is outstanding the reward itself is
 * the headline and the instruction sits beside the QR.
 */
function rewardViewModel(exp: RewardExperience): CustomerExperienceViewModel {
  if (exp.kind === "reward_waiting") {
    return exp.preparing
      ? preparingRewardViewModel(exp)
      : {
          eyebrow: "Reward",
          headline: exp.reward.rewardName,
          supportLine: waitingRewardSupportLine(exp.reward.availableFrom),
        }
  }

  const setup = collectionSetup(exp.profileGate, exp.reward.requiresAgeCheck)

  if (setup.outstanding) {
    return {
      eyebrow: "Before you collect",
      headline: COLLECTION_STAGE_INSTRUCTION[setup.stage],
      supportLine: rewardIdentityLine(exp),
    }
  }

  return {
    eyebrow: "Ready to collect",
    headline: exp.reward.rewardName,
    supportLine: exp.merchantName,
  }
}

/**
 * Preparing a waiting reward. The timing line stays out of the headline: this
 * screen is about the outstanding step, and the panel repeats — once — that
 * finishing it does not move the collection date.
 */
function preparingRewardViewModel(
  exp: Extract<CustomerExperience, { kind: "reward_waiting" }>
): CustomerExperienceViewModel {
  const setup = exp.profileGate
    ? collectionSetup(exp.profileGate, exp.reward.requiresAgeCheck)
    : undefined

  return {
    eyebrow: "Before you collect",
    headline:
      setup && setup.outstanding
        ? COLLECTION_STAGE_INSTRUCTION[setup.stage]
        : "You are ready to collect",
    supportLine: rewardIdentityLine(exp),
  }
}

/** Venue and reward identity, kept visible as context beside a setup step. */
function rewardIdentityLine(exp: RewardExperience): string {
  return `${exp.reward.rewardName} at ${exp.merchantName}`
}

function waitingRewardSupportLine(availableFrom: string | null): string {
  if (availableFrom) {
    return `Unlocked — ${formatCollectionAvailability(availableFrom)?.toLocaleLowerCase("en-GB")}.`
  }
  return "Unlocked — collection timing will appear here."
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

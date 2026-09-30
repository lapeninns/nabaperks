import { OPEN_MY_CARDS_LABEL } from "@/lib/copy/product-copy"
import { formatCollectionAvailability } from "@/lib/customer/reward-collection-state"
import { buildCustomerJoinHref } from "@/lib/navigation/customer-join-intent"

import {
  COLLECTION_STAGE_INSTRUCTION,
  collectionSetup,
} from "./collection-stage"
import { stampedTodayLine } from "./next-stamp"
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

/** QR-scan welcome: the three things the guest will actually do. */
export const JOIN_WELCOME_HOW_IT_WORKS = [
  "Enter your mobile number",
  "Type the code we send you",
  "Your first stamp goes on your card",
] as const

export const JOIN_WELCOME_HOW_IT_WORKS_LABEL = "How it works" as const

/**
 * Under the welcome CTA. A card is found by the number it was joined with, so
 * the same mobile number opens the same card. Email is never mentioned here:
 * it is only the code step's fallback.
 */
export const JOIN_WELCOME_PHONE_REASSURANCE =
  "Been here before? Use the same mobile number and your card opens." as const

/**
 * Join phone step: the one quiet line about how the code arrives. WhatsApp
 * first, with text one tap away on the code step.
 */
export function joinPhoneChannelNote(channel: "sms" | "whatsapp"): string {
  return channel === "whatsapp"
    ? "We send codes by WhatsApp. You can switch to text on the next screen."
    : "We send codes by text message."
}

/** The number step after a code step whose pending code had expired. */
export const JOIN_PHONE_CODE_EXPIRED =
  "Your code expired. Send a new one." as const

/** The phone step's back link, to the welcome (QR) or the venue page. */
export const JOIN_PHONE_BACK_LABEL = "Back" as const

/**
 * The phone code step's email fallback, shown once the server allows it
 * (lib/customer/phone-code-email-fallback.ts). Join page and /home/login.
 */
export const PHONE_CODE_EMAIL_FALLBACK_LABEL =
  "No code? Get one by email instead" as const

/** Before the fallback opens: no ticking number, just that there is more. */
export const PHONE_CODE_EMAIL_FALLBACK_PENDING =
  "If nothing arrives, more options appear shortly." as const

/** Beside a failed phone send, which is a genuine delivery failure. */
export const JOIN_PHONE_SEND_FAILED_EMAIL_LABEL =
  "Get a code by email instead" as const

/** Leads the email step, which is only ever reached as that fallback. */
export const JOIN_EMAIL_FALLBACK_HEADLINE = "Get your code by email" as const

/** Why email helps at a venue with no signal. Join and /home/login. */
export const JOIN_EMAIL_WIFI_HINT =
  "Useful when there's no mobile signal. Works on the venue's Wi-Fi." as const

/**
 * Mode `full` only, under the email field: confirming a code for an address
 * no card uses starts a card with it (email-actions.ts). Said before the code
 * is sent, so sending it is the guest's informed choice to start one, as the
 * published terms describe. Conditional wording: it says nothing about
 * whether this address already has a card.
 */
export const JOIN_EMAIL_NEW_CARD_DISCLOSURE =
  "If no Nabaperks card uses this email yet, confirming the code starts one with it." as const

/** When the email provider failed to take a join code (plan section 7). */
export const JOIN_EMAIL_DELAYED =
  "Email is slow right now. Try again shortly, or go back to the text code." as const

/** Shown on the email code step once the code has had time to arrive. */
export const JOIN_EMAIL_SPAM_HINT = "Not there? Check spam or junk." as const

/** The email steps' way back to the phone code, which may still arrive. */
export const JOIN_EMAIL_BACK_TO_PHONE_CODE_LABEL =
  "Back to the text code" as const

/** The email steps' way to the number form when no phone code is pending. */
export const JOIN_USE_MOBILE_NUMBER_LABEL = "Use my mobile number" as const

/** The reward hook — keeps *why* in one line on every join step. */
export function joinUnlockingRewardHook(stampsRequired: number): string {
  const stamps = Math.max(stampsRequired, 1)
  return stamps === 1
    ? "1 stamp to a mystery reward"
    : `${stamps} stamps to a mystery reward`
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
  /** A card joined without a confirmed phone is kept with its email. */
  savedTo?: "number" | "email"
}): string {
  const target = savedTo === "email" ? "your email" : "your mobile number"
  return hasQr
    ? `Your card and stamps stay with ${target}.`
    : `Your card stays with ${target}, ready for your first visit.`
}

/**
 * The one material condition of joining, said once, beside the terms: what
 * collecting a reward needs (lib/customer/profile-completion.ts). Photo ID
 * only when the card data says a reward is age checked.
 */
export function joinRewardRequirementLine({
  mayNeedPhotoId,
}: {
  mayNeedPhotoId: boolean
}): string {
  const line =
    "Collecting a reward needs your name, date of birth and a confirmed phone number and email."
  return mayNeedPhotoId ? `${line} Photo ID may be checked.` : line
}

/**
 * The optional marketing choice, naming only the channels the database would
 * record consent on: WhatsApp and text for a confirmed phone, email for a
 * confirmed email (migration 20261009150100). With neither confirmed a tick
 * would record nothing, so there is no choice to offer: null, and the form
 * leaves the optional section out.
 */
export function joinMarketingOptInLabel(
  merchantName: string,
  channels: { phone: boolean; email: boolean }
): string | null {
  const by =
    channels.phone && channels.email
      ? "by WhatsApp, text or email"
      : channels.phone
        ? "by WhatsApp or text"
        : channels.email
          ? "by email"
          : null
  return by ? `Send me offers from ${merchantName} ${by}` : null
}

/** R4: one quiet line under "Show this at the counter." beside the code. */
export const REWARD_CODE_BRIGHTNESS_HINT =
  "Turn your screen brightness up so staff can scan it." as const

export const JOIN_MARKETING_CHANGE_NOTE =
  "You can change this any time in your profile." as const

/**
 * "Sent by WhatsApp to 07•••• ••123.": the same masked number sign-in shows,
 * so the step reads the same in join and sign-in.
 */
function phoneCodeSentLine(contact: {
  channel: string
  maskedNumber: string
}): string {
  const by = contact.channel === "whatsapp" ? "by WhatsApp" : "by text"
  return contact.maskedNumber
    ? `Sent ${by} to ${contact.maskedNumber}.`
    : `Sent ${by}.`
}

/**
 * R2. "Ready from Wed 1 Oct, 12:00." from the server's opening instant,
 * capitalised as formatted (never lower-cased). Without a time, it says where
 * the time will appear rather than inventing one or promising speed.
 */
export function waitingRewardTiming(
  availableFrom: string | null,
  nextWindow: string | null = null
): string {
  const timing = formatCollectionAvailability(availableFrom ?? nextWindow)
  return timing
    ? `${timing}.`
    : "The collection time will show here once it's set."
}

export function getCustomerExperienceViewModel(
  exp: CustomerExperience
): CustomerExperienceViewModel {
  switch (exp.kind) {
    case "join_welcome":
      // Shown to anyone who scans the venue QR while signed out. Returning
      // members confirm their number and go to today's stamp; new members
      // accept the terms and get stamp 1 in the same call.
      return {
        eyebrow: exp.merchant.name,
        headline: "Get your first stamp",
        supportLine: `A stamp card for ${exp.merchant.name}. Join with your mobile number.`,
        primaryAction: {
          label: "Get my first stamp",
          href: buildCustomerJoinHref(exp.merchant.slug, {
            qrId: exp.qrId,
            step: "phone",
          }),
        },
      }
    case "join_phone":
      return {
        eyebrow: "Your number",
        headline: "Enter your mobile number",
        supportLine: "We'll send you a code to confirm it's you.",
      }
    case "join_email":
      // Reached only from a phone code that has not arrived.
      return {
        eyebrow: "Your email",
        headline: JOIN_EMAIL_FALLBACK_HEADLINE,
        supportLine: JOIN_EMAIL_WIFI_HINT,
      }
    case "join_email_choice":
      return exp.canCreate
        ? {
            // Only a handoff left by the previous build lands here.
            eyebrow: "Your email",
            headline: "Email confirmed",
            supportLine: `Continue to join the card at ${exp.merchant.name}.`,
          }
        : {
            eyebrow: "Your email",
            headline: "No card uses this email",
            supportLine: "Join with your mobile number instead.",
          }
    case "join_otp":
      return exp.contact.method === "email"
        ? {
            eyebrow: "Check your email",
            headline: "Enter your code",
            // A failed send is never described as an email on its way.
            supportLine: exp.contact.deliveryDelayed
              ? `We couldn't email ${exp.contact.maskedEmail} yet. Send a new code, or go back to the text code.`
              : `Sent to ${exp.contact.maskedEmail}.`,
          }
        : {
            eyebrow: "Check your messages",
            headline: "Enter your code",
            supportLine: phoneCodeSentLine(exp.contact),
          }
    case "join_terms":
      return exp.qrId
        ? {
            eyebrow: "Your first stamp",
            headline: `Join the card at ${exp.merchant.name}`,
            supportLine: "Agree to the card terms to add your first stamp.",
          }
        : {
            eyebrow: "Your card",
            headline: `Join the card at ${exp.merchant.name}`,
            supportLine: "Agree to the card terms to save your card.",
          }
    case "join_returning":
      return {
        eyebrow: `${exp.current} of ${exp.total} stamps`,
        headline: "Welcome back",
        supportLine: `Your ${exp.merchant.name} card is ready.`,
        primaryAction: {
          label: exp.qrId ? "Get today's stamp" : "Open my card",
          href: exp.qrId
            ? `/card/${exp.membershipId}/stamp?qr=${encodeURIComponent(exp.qrId)}`
            : `/card/${exp.membershipId}`,
        },
      }
    case "stamp_confirm":
      // S1. Once the stamp lands the screen headline follows the result
      // ("Stamp added."), from stampChoreographyView's outcome.
      return {
        eyebrow: "Your card",
        headline: "Today's stamp",
        supportLine: exp.merchantName,
      }
    case "card_stamped_today":
      return stampedTodayViewModel(exp)
    case "stamp_unmatched":
      // S6. The shell carries the one headline and a reassurance; the panel's
      // band beneath the card carries the instruction, so the two never
      // repeat each other. No primaryAction: the panel renders the shared
      // recovery pair (scan the QR / open my cards) itself.
      return exp.problem === "missing"
        ? {
            eyebrow: "Your card",
            headline: `Scan the QR at ${exp.merchantName}`,
            supportLine: "Your stamps are safe.",
          }
        : {
            eyebrow: "Your card",
            headline: "This QR doesn't match your card",
            supportLine: "Your stamps are safe.",
          }
    case "card_collecting":
      return cardCollectingViewModel(exp)
    case "reward_waiting":
    case "reward_ready":
      return rewardViewModel(exp)
    case "redeemed_proof":
      return {
        eyebrow: "Reward collected",
        headline: "Collected. Enjoy.",
        supportLine: exp.reward.rewardName,
        primaryAction: {
          label: "Back to my card",
          href: `/card/${exp.reward.membershipId}`,
        },
      }
    case "unavailable":
      return unavailableViewModel(exp)
    default:
      return assertNever(exp)
  }
}

/**
 * S5, or the full card held after its reward unlocked (S3 on a reload). The
 * next stamp is named as a concrete London date and time when the server knew
 * the venue's day start, never as "tomorrow" or a "daily reset".
 */
function stampedTodayViewModel(
  exp: Extract<CustomerExperience, { kind: "card_stamped_today" }>
): CustomerExperienceViewModel {
  if (exp.reward) {
    return {
      eyebrow: "Your card",
      headline: "Your card is full.",
      supportLine: "Your reward is unlocked.",
      primaryAction: {
        label: "See my reward",
        href: `/reward/${exp.reward.rewardId}`,
      },
    }
  }
  return {
    eyebrow: "Your card",
    headline: "You've already got today's stamp",
    supportLine: stampedTodayLine(exp.nextStampFrom),
    primaryAction: {
      label: "View my card",
      href: `/card/${exp.membershipId}`,
    },
  }
}

/** "3 more to your reward." while collecting; the reward once it unlocks. */
function cardProgressLine({
  current,
  total,
  reward,
}: {
  current: number
  total: number
  reward: CardCollectingExperience["reward"]
}): string | undefined {
  if (reward !== "none") return "Your reward is unlocked."
  if (total <= 0) return undefined
  const remaining = Math.max(total - current, 0)
  return remaining > 0 ? `${remaining} more to your reward.` : undefined
}

/**
 * C. The card: where the guest is on it. A just-joined guest is welcomed by
 * name of the venue, with no setup asked of them here.
 */
function cardCollectingViewModel(
  exp: CardCollectingExperience
): CustomerExperienceViewModel {
  const progress = cardProgressLine(exp)
  return exp.justJoined
    ? {
        eyebrow: exp.merchantName,
        headline: `Welcome to ${exp.merchantName}`,
        supportLine: progress ?? exp.cardName,
      }
    : {
        eyebrow: exp.merchantName,
        headline: exp.cardName,
        supportLine: progress,
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
          eyebrow: "Your reward",
          headline: exp.reward.rewardName,
          supportLine: waitingRewardTiming(exp.reward.availableFrom),
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
 * screen is about the outstanding step, and the panel states the date once,
 * without implying that finishing setup brings it forward.
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
        : "Nothing else to add",
    supportLine: rewardIdentityLine(exp),
  }
}

/** Venue and reward identity, kept visible as context beside a setup step. */
function rewardIdentityLine(exp: RewardExperience): string {
  return `${exp.reward.rewardName} at ${exp.merchantName}`
}

function unavailableViewModel(
  exp: UnavailableExperience
): CustomerExperienceViewModel {
  if (exp.subject === "reward") {
    // R6: reward-specific wording. Signed out, the one way back is signing in
    // (to this reward). Otherwise the reason says why (expired, paused, not
    // found) and the way out is the guest's cards; not-found and not-yours
    // already read the same, so this reveals nothing about other rewards.
    return exp.recovery
      ? {
          eyebrow: "Your reward",
          headline: "Sign in to see this reward",
          supportLine: "Use the mobile number you collect stamps with.",
          primaryAction: {
            label: OPEN_MY_CARDS_LABEL,
            href: exp.recovery.loginHref,
          },
        }
      : {
          eyebrow: "Your reward",
          headline: "This reward isn't available",
          supportLine: exp.reason,
          primaryAction: { label: OPEN_MY_CARDS_LABEL, href: "/home" },
        }
  }
  return {
    eyebrow: "Nabaperks loyalty",
    headline: "Card unavailable",
    supportLine: exp.reason,
    primaryAction: exp.recovery
      ? { label: OPEN_MY_CARDS_LABEL, href: exp.recovery.loginHref }
      : undefined,
  }
}

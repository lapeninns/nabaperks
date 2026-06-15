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

/** QR-scan welcome — mirrors join-with-first-stamp: scan → verify → terms → stamp. */
export const JOIN_WELCOME_HOW_IT_WORKS = [
  "You scanned the venue QR",
  "Save the card to your number with one text — no app",
  "Accept the terms and your first stamp prints onto the card",
] as const

export const JOIN_WELCOME_HOW_IT_WORKS_LABEL = "How it works" as const

export const JOIN_WELCOME_ALREADY_HAVE_CARD_LABEL =
  "Already have a card? Use your number and we'll find it." as const

/** Shown under the phone field on step 2 — sets expectation before the SMS arrives. */
export const JOIN_PHONE_CODE_HINT =
  "We'll send a one-time code by text." as const

/** Returns to the QR welcome card when the customer wants the full preview again. */
export const JOIN_PHONE_BACK_LABEL = "See how stamps and rewards work" as const

/** Step-2 reward hook — keeps *why* in one line beside the phone field. */
export function joinUnlockingRewardHook(stampsRequired: number): string {
  const stamps = Math.max(stampsRequired, 1)
  return stamps === 1
    ? "1 stamp unlocks a mystery reward"
    : `${stamps} stamps unlock a mystery reward`
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
        eyebrow: "Venue QR scanned",
        headline: "Keep your card on your phone",
        supportLine: `One text saves ${exp.merchant.name}'s card to your number. New here? Your first stamp lands when you accept the terms.`,
        primaryAction: {
          label: "Get today's stamp",
          href: joinHref(exp.merchant.slug, exp.qrId, "phone"),
        },
      }
    case "join_phone":
      return {
        eyebrow: "One text, no password",
        headline: "Save your card to your number",
        supportLine: `Save ${exp.merchant.name}'s card to your number — ${joinUnlockingRewardHook(exp.card.stampsRequired)}.`,
      }
    case "join_otp":
      return {
        eyebrow: "Check your texts",
        headline: "Enter your code",
        supportLine: "We sent a one-time code to your phone.",
      }
    case "join_terms":
      return {
        eyebrow: "Last step",
        headline: "Collect your first stamp",
        supportLine:
          "Accept the loyalty terms and we'll print stamp one onto your card.",
      }
    case "join_returning":
      return {
        eyebrow: "Welcome back",
        headline: "You're already joined",
        supportLine: `${exp.current} of ${exp.total} stamps collected.`,
        primaryAction: {
          label: "Open your stamp card",
          href: exp.qrId
            ? `/card/${exp.membershipId}/stamp?qr=${exp.qrId}`
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
      return {
        eyebrow: "Today's stamp",
        headline: "You're stamped for today",
        supportLine: "Come back tomorrow to keep building your card.",
        primaryAction: {
          label: "View card",
          href: `/card/${exp.membershipId}`,
        },
      }
    case "card_collecting":
      // Identity reads once: the merchant as the mono tag, the card as the
      // headline. On the welcome moment the headline turns to a greeting and the
      // card name moves to the support line so it still shows exactly once.
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
    case "reward_waiting":
      return {
        eyebrow: "Reward",
        headline: exp.reward.rewardName,
        supportLine: `${exp.merchantName} - show this at the counter when ready.`,
      }
    case "reward_ready":
      return {
        eyebrow: "Reward",
        headline: exp.reward.rewardName,
        supportLine: `${exp.merchantName} - show this at the counter when ready.`,
      }
    case "redeemed_proof":
      return {
        eyebrow: "Reward redeemed",
        headline: exp.reward.rewardName,
        supportLine: "Show this screen at the counter.",
        primaryAction: {
          label: "Back to card",
          href: `/card/${exp.reward.membershipId}`,
        },
      }
    case "unavailable":
      return {
        eyebrow: "Nabaperks loyalty",
        headline: "Card unavailable",
        supportLine: exp.reason,
        primaryAction: exp.recovery
          ? { label: "Open my cards", href: exp.recovery.loginHref }
          : undefined,
      }
    default:
      return assertNever(exp)
  }
}

function joinHref(
  slug: string,
  qrId: string | undefined,
  step: string
): string {
  const params = new URLSearchParams()
  if (qrId) params.set("qr", qrId)
  params.set("step", step)
  return `/m/${slug}/join?${params.toString()}`
}

export function joinWelcomeHref(
  slug: string,
  qrId: string | undefined,
  step?: string
): string {
  const params = new URLSearchParams()
  if (qrId) params.set("qr", qrId)
  if (step) params.set("step", step)
  return `/m/${slug}/join?${params.toString()}`
}

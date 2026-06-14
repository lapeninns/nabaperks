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

export function getCustomerExperienceViewModel(
  exp: CustomerExperience
): CustomerExperienceViewModel {
  switch (exp.kind) {
    case "join_welcome":
      // Shown to anyone who scans the venue QR while logged out — we cannot yet
      // tell a first-timer from a returning member, so the copy stays neutral
      // (no "first stamp") and the phone step routes each to the right place.
      return {
        eyebrow: "Scanned at the counter",
        headline: "Save your stamp card",
        supportLine: `Save ${exp.merchant.name}'s card to your number — new or returning, your stamps stay put. No app, no plastic.`,
        primaryAction: {
          label: "Get started",
          href: joinHref(exp.merchant.slug, exp.qrId, "phone"),
        },
      }
    case "join_phone":
      return {
        eyebrow: "One text, no password",
        headline: "Save your card to your number",
        supportLine: "Keep this stamp card safe with your UK mobile number.",
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
      return {
        eyebrow: "Nabaperks loyalty",
        headline: "Your card",
        supportLine: `${exp.merchantName} - ${exp.cardName}`,
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

function joinHref(slug: string, qrId: string | undefined, step: string): string {
  const params = new URLSearchParams()
  if (qrId) params.set("qr", qrId)
  params.set("step", step)
  return `/m/${slug}/join?${params.toString()}`
}

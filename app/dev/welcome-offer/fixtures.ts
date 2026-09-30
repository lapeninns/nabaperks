import type { OfferClaimLandingProps } from "@/components/customer/offer-claim-landing"
import { deriveCustomerExperience } from "@/lib/customer/experience/derive"
import type { JoinEmailMode } from "@/lib/customer/experience/types"
import type { CustomerOfferPass } from "@/lib/customer/offer-pass"
import { phoneCodeEmailFallbackInSeconds } from "@/lib/customer/phone-code-email-fallback"

// Display fixtures only, behind the /dev production gate. No live campaign token.
export const WELCOME_OFFER: OfferClaimLandingProps = {
  venueName: "Old Crown",
  campaignName: "Student & Staff Welcome Pass",
  customerDescription:
    "Two welcome stamps the moment you join, so your first visit completes the card, plus 10% off your own food and drink. For students and staff.",
  bonusStampCount: 2,
  discountPercent: 10,
  stampsRequired: 3,
  rewardName: "Surprise reward",
  requiresIdCheck: true,
  extraTerms:
    "For students and staff. Please show a valid student or staff card each time you use the pass. The 10% applies to your own food and drink, not to a shared or group bill. One pass per person, and it cannot be transferred. Welcome stamps are added once, when you join. The offer runs for a limited time and may close earlier than the date shown.",
  startsOn: "2026-08-04",
  endsOn: "2029-08-07",
}

export const LONG_WELCOME_OFFER: OfferClaimLandingProps = {
  ...WELCOME_OFFER,
  venueName: "The Orchard and Riverside Community Dining Rooms",
  campaignName: "A welcome for new neighbours at our community dining rooms",
  customerDescription:
    "Join our loyalty card and keep a pass for your next visits. The complete terms below explain where and when it can be used.",
  bonusStampCount: 4,
  discountPercent: 25,
  stampsRequired: 9,
  rewardName: "A seasonal surprise from the kitchen",
  startsOn: "2027-12-01",
  endsOn: "2028-02-29",
  requiresIdCheck: false,
  extraTerms:
    "Food ordered from the seasonal menu only.\n\nNot available on event tickets, vouchers or private functions. Ask the team about the current menu before placing an order.\n\nOne pass per person. The named card holder must be present. These terms remain available for you to read each time you use the pass.",
}

export const WELCOME_PASS: CustomerOfferPass = {
  entitlementId: "abcd1234-0000-4000-8000-0000000000e1",
  membershipId: "abcd1234-0000-4000-8000-0000000000b1",
  venueName: "Old Crown",
  venueSlug: "welcome-offer-fixture",
  discountPercent: 10,
  requiresIdCheck: true,
  extraTerms: WELCOME_OFFER.extraTerms,
  validFrom: "2026-08-04",
  validTo: "2029-08-07",
  state: "active",
  unavailableReason: null,
  presentable: true,
}

/**
 * Join surfaces this harness renders. `contact` is the contact step the server
 * picks with no step asked for (always phone). `welcome-email`, `contact`,
 * `code-email` and the `email*` surfaces run in mode `full`; the `-existing`
 * ones in `existing`; the rest with email sign-in off. The `code*` surfaces
 * take `sentAt` (epoch seconds) as the phone code's send time, now by default,
 * and the server works out the wait from it as the join loader does.
 * `email-after-code` is the email step with that phone code still pending,
 * and `email-code-after-code` the email code step with one still pending (the
 * provider never took the email). The `email` surfaces show the step the
 * server opened as the phone code's fallback.
 *
 * `email-no-card-existing` is J7: a verified fallback email no card uses, in
 * mode `existing`. `email-confirmed` is the one-action "Continue" for a
 * confirmed-email handoff left by the previous build (mode `full`); a new
 * fallback email in mode `full` goes straight to the terms step instead.
 * `phone-expired` is the number step after a code expired; `phone-change`
 * the number step from "Wrong number? Change it", prefilled. `terms-email`
 * is the terms step for a card joined by email (no confirmed phone), and
 * `terms-age-check` for a card whose reward may be age checked. `returning`
 * is J8: a guest who already has a card here ("Welcome back").
 *
 * Every surface takes `channel=whatsapp|sms` (text by default, so screenshots
 * stay steady): WhatsApp shows the default channel's number note, "Sent by
 * WhatsApp" and "Text me instead".
 */
export const WELCOME_JOIN_SURFACES = [
  "welcome",
  "welcome-email",
  "phone",
  "phone-expired",
  "phone-change",
  "code",
  "code-email",
  "code-email-existing",
  "terms",
  "terms-email",
  "terms-age-check",
  "contact",
  "contact-existing",
  "email",
  "email-after-code",
  "email-code",
  "email-code-delayed",
  "email-code-after-code",
  "email-confirmed",
  "email-no-card-existing",
  "returning",
] as const

export type WelcomeJoinChannel = "whatsapp" | "sms"

/** `channel=whatsapp` shows the default channel; anything else is text. */
export function welcomeJoinChannel(
  raw: string | undefined
): WelcomeJoinChannel {
  return raw === "whatsapp" ? "whatsapp" : "sms"
}

function joinFixtureEmailMode(step: string): JoinEmailMode {
  if (step.endsWith("-existing")) return "existing"
  const emailSurface =
    step === "welcome-email" ||
    step === "contact" ||
    step === "code-email" ||
    step.startsWith("email")
  return emailSurface ? "full" : "off"
}

const FIXTURE_CARD = {
  name: "Loyalty card",
  stampsRequired: 3,
  rewardTerms:
    "Fixture venue terms. No live consent is collected on this display route.",
}

/** The card, with an age-checked reward on the `terms-age-check` surface. */
function fixtureCard(step: string) {
  return step === "terms-age-check"
    ? {
        ...FIXTURE_CARD,
        rewardPool: [
          {
            rewardName: "House cocktail",
            rewardTerms: "Fixture reward.",
            requiresAgeCheck: true,
          },
        ],
      }
    : FIXTURE_CARD
}

/** `phone-*` surfaces are the number step asked for explicitly. */
function fixtureStep(step: string): string | undefined {
  if (step === "email" || step === "email-after-code") return "email"
  if (step.startsWith("phone-")) return "phone"
  return undefined
}

export function welcomeJoinExperience(
  step: string,
  options: {
    readonly sentAt?: number
    readonly channel?: WelcomeJoinChannel
  } = {}
) {
  const codeSurface = step.startsWith("code")
  const sentAt = options.sentAt ?? Math.floor(Date.now() / 1_000)
  const channel = options.channel ?? "sms"
  return deriveCustomerExperience({
    entry: "join",
    context: {
      merchantId: "abcd1234-0000-4000-8000-000000000001",
      merchant: {
        name: "Old Crown",
        slug: "welcome-offer-fixture",
        termsUrl: "/merchant/welcome-offer-fixture/terms",
      },
      card: fixtureCard(step),
      qrId:
        step.startsWith("welcome") ||
        step.startsWith("code-email") ||
        step.startsWith("terms-")
          ? "welcome-fixture-qr"
          : undefined,
      step: fixtureStep(step),
      notice: step === "phone-expired" ? "code_expired" : undefined,
      emailFallbackOpen: step === "email" || step === "email-after-code",
      phoneCodePending: step.endsWith("after-code"),
      hasSession: step.startsWith("terms"),
      customerChannels:
        step === "terms-email"
          ? { phone: false, email: true }
          : { phone: true, email: false },
      pendingOtp: codeSurface,
      pendingPhoneSentAt: codeSurface ? sentAt : undefined,
      pendingPhoneEmailFallbackInSeconds: codeSurface
        ? phoneCodeEmailFallbackInSeconds(sentAt, Date.now())
        : undefined,
      emailMode: joinFixtureEmailMode(step),
      // A past resend time keeps the resend button steady for screenshots.
      pendingEmail: step.startsWith("email-code")
        ? {
            maskedEmail: "j***@example.com",
            resendAvailableAt: 0,
            deliveryDelayed:
              step === "email-code-delayed" || step === "email-code-after-code",
          }
        : undefined,
      emailHandoff:
        step === "email-confirmed" || step === "email-no-card-existing"
          ? { maskedEmail: "j***@example.com" }
          : undefined,
      // The number of the code pending on this browser (the loader passes it
      // to the number step only for "Wrong number? Change it").
      pendingPhone: step === "phone-expired" ? undefined : "+447700900123",
      pendingChannel: channel,
      primaryChannel: channel,
      // J8: this guest already has a card here.
      membership:
        step === "returning"
          ? { id: WELCOME_PASS.membershipId, current: 2 }
          : null,
      location: { requireGeofence: false, geofenceRadiusMeters: 150 },
    },
  })
}

/**
 * The card page. `justJoined` is C "Just joined" (`surface=card&joined=1`):
 * the card saved with no stamp yet, or with its first stamp
 * (`&stamped=1`).
 */
export function welcomeCardExperience(
  options: {
    readonly justJoined?: boolean
    readonly justStamped?: boolean
  } = {}
) {
  const justJoined = options.justJoined === true
  const justStamped = options.justStamped === true
  const current = justJoined ? (justStamped ? 1 : 0) : 2
  return deriveCustomerExperience({
    entry: "card",
    context: {
      membershipId: WELCOME_PASS.membershipId,
      merchantName: "Old Crown",
      cardName: "Loyalty card",
      current,
      total: 3,
      reward: null,
      rewardTerms:
        "Fixture venue terms. The live card keeps its full venue terms.",
      stampDates: justJoined && justStamped ? ["12 Sep"] : [],
      justStamped,
      justJoined,
      geoFlagged: false,
      justRedeemed: false,
    },
  })
}

export const WELCOME_CARD = welcomeCardExperience()

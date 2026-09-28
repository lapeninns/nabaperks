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
 */
export const WELCOME_JOIN_SURFACES = [
  "welcome",
  "welcome-email",
  "phone",
  "code",
  "code-email",
  "code-email-existing",
  "terms",
  "contact",
  "contact-existing",
  "email",
  "email-after-code",
  "email-code",
  "email-code-delayed",
  "email-code-after-code",
  "email-choice",
  "email-choice-existing",
] as const

function joinFixtureEmailMode(step: string): JoinEmailMode {
  if (step.endsWith("-existing")) return "existing"
  const emailSurface =
    step === "welcome-email" ||
    step === "contact" ||
    step === "code-email" ||
    step.startsWith("email")
  return emailSurface ? "full" : "off"
}

export function welcomeJoinExperience(
  step: string,
  options: { readonly sentAt?: number } = {}
) {
  const codeSurface = step.startsWith("code")
  const sentAt = options.sentAt ?? Math.floor(Date.now() / 1_000)
  return deriveCustomerExperience({
    entry: "join",
    context: {
      merchantId: "abcd1234-0000-4000-8000-000000000001",
      merchant: {
        name: "Old Crown",
        slug: "welcome-offer-fixture",
        termsUrl: "/merchant/welcome-offer-fixture/terms",
      },
      card: {
        name: "Loyalty card",
        stampsRequired: 3,
        rewardTerms:
          "Fixture venue terms. No live consent is collected on this display route.",
      },
      qrId:
        step.startsWith("welcome") || step.startsWith("code-email")
          ? "welcome-fixture-qr"
          : undefined,
      step:
        step === "email" || step === "email-after-code" ? "email" : undefined,
      emailFallbackOpen: step === "email" || step === "email-after-code",
      phoneCodePending: step.endsWith("after-code"),
      hasSession: step === "terms",
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
      emailHandoff: step.startsWith("email-choice")
        ? { maskedEmail: "j***@example.com" }
        : undefined,
      pendingPhone: "+447700900123",
      pendingChannel: "sms",
      primaryChannel: "sms",
      membership: null,
      location: { requireGeofence: false, geofenceRadiusMeters: 150 },
    },
  })
}

export const WELCOME_CARD = deriveCustomerExperience({
  entry: "card",
  context: {
    membershipId: WELCOME_PASS.membershipId,
    merchantName: "Old Crown",
    cardName: "Loyalty card",
    current: 2,
    total: 3,
    reward: null,
    rewardTerms:
      "Fixture venue terms. The live card keeps its full venue terms.",
    stampDates: [],
    justStamped: false,
    justJoined: false,
    geoFlagged: false,
    justRedeemed: false,
  },
})

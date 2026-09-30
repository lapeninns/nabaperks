import type { OtpChannel } from "@/lib/customer/otp-channel-core"
/**
 * Customer experience layer — the union of states a customer can be in across
 * the QR → join → stamp → card → reward journey.
 *
 * The union describes *what is true*, not how it is phrased. Copy lives in
 * `copy.ts`; visuals live in the panels. Derivation (`derive.ts`) is pure and
 * never imports the database — loaders do the impure fetching and hand normalized
 * facts to `deriveCustomerExperience({ entry, context })`.
 */

import type { RewardSource } from "@/lib/customer/issued-reward-display"
import type { ReferralBonusBank } from "@/lib/customer/referral-bonus-bank"
import type { JoinFirstStampRecovery } from "@/lib/customer/join-first-stamp-recovery"

/** Why an "add your email" prompt asks (see lib/customer/email-auth-mode.ts). */
export type EmailPromptReason = "rewards" | "wifi_sign_in"

/**
 * Email sign-in rollout mode as the join page sees it (mirrors
 * `CustomerEmailAuthMode` in lib/customer/email-auth-mode.ts, which is
 * server-only): `off` phone only, `existing` email opens wallets that already
 * hold that verified email, `full` email can also start a wallet.
 */
export type JoinEmailMode = "off" | "existing" | "full"

/** How a customer proves who they are on the join page (D10). */
export type JoinContactMethod = "email" | "phone"

/** Where a pending join code went, in the form the code step may show. */
export type JoinOtpContact =
  | {
      method: "phone"
      last4: string
      /**
       * The number as the guest knows it, masked ("07•••• ••123"), the same
       * form sign-in shows. Empty when the number is not known.
       */
      maskedNumber: string
      /** Where the code went, so the step says "by text" or "on WhatsApp". */
      channel: OtpChannel
      /**
       * Seconds left, by the server's clock, before the step may offer email
       * instead, measured from when the latest code was sent. The step counts
       * it down from when it appears. Absent while email sign-in is off.
       */
      emailFallbackInSeconds?: number
      /**
       * When the server sent that code (epoch seconds). A resend changes it,
       * so the step restarts its wait from the latest code.
       */
      phoneCodeSentAt?: number
    }
  | {
      method: "email"
      /** Already masked on the server ("j***@example.com"). */
      maskedEmail: string
      /** Epoch seconds when a resend is allowed. */
      resendAvailableAt: number
      /** The provider failed to take the latest code, so none is on its way. */
      deliveryDelayed?: boolean
      /**
       * A phone code is still pending, so "Use my phone instead" returns to
       * that code rather than a blank number form.
       */
      phoneCodePending: boolean
    }

/** Contact channels a verified wallet holds, for the marketing-consent line. */
export type JoinContactChannels = {
  phone: boolean
  email: boolean
}

/** Which route the customer entered from. Same facts can mean different UI. */
export type CustomerExperienceEntry =
  "qr" | "join" | "card" | "stamp" | "reward"

/**
 * Access failures the customer presentation layer is allowed to observe.
 *
 * `unauthorized` is deliberately ABSENT. An object that exists but belongs to
 * another customer and an object that does not exist must be externally
 * indistinguishable, or the card/stamp/reward pages become an existence oracle
 * for foreign membership and reward UUIDs. /reward/[rewardId]/status already
 * collapses both to one 404 — this brings the pages into line with it.
 *
 * `unauthenticated` stays distinct: it does not depend on the object at all,
 * and the sign-in recovery CTA rides on it.
 */
export type AccessProblem = "unauthenticated" | "not_found"

/** The raw states the service-role loaders in lib/customer/{card,reward}.ts produce. */
export type InternalAccessProblem = AccessProblem | "unauthorized"

/** Collapse an internal lookup state to what a customer may observe. */
export function externalAccessProblem(
  status: InternalAccessProblem
): AccessProblem {
  return status === "unauthenticated" ? "unauthenticated" : "not_found"
}

/**
 * Typed reasons a stamp can be blocked. Panels never inspect raw RPC strings —
 * `block-reasons.ts` maps messages to these in one tested place.
 */
export type StampBlockReason =
  | "already_stamped_today"
  | "reward_ready_first"
  | "reward_daily_cap"
  | "rate_limited"
  | "pool_unavailable"
  | "unauthenticated"
  | "profile_incomplete"
  | "location_required"
  | "location_out_of_range"
  // Decided on the phone, never by the server: the capture carried no fix
  // and the unverified grace is spent, so a request would only be refused.
  | "location_blocked"
  // Venue-code fallback after a refused location check.
  | "venue_code_rejected"
  | "venue_code_refusal_missing"
  | "venue_code_locked"
  | "venue_code_format"
  // The code path's own throttle (app buckets or consume_venue_code_attempt),
  // kept apart from `rate_limited` so the screen never re-offers a throttled
  // code form.
  | "venue_code_rate_limited"
  | "unavailable"
  | "unknown"

/** Reward sub-status used to drive a card footer without a separate top kind. */
export type CardRewardStatus = "none" | "waiting" | "ready"

/** Optional geolocation gate carried into self-service stamp/redeem forms. */
export type LocationRequirement = {
  requireGeofence: boolean
  geofenceRadiusMeters: number
  firstVerifiedVisit?: number
  nextVisitNumber?: number
  /**
   * Unverified-location stamps this membership can still commit before the
   * server refuses with `location_required`. Undefined when unknown (no
   * membership, or a loader that does not compute it).
   */
  unverifiedGraceRemaining?: number
}

/** Recovery target for unavailable/unauthenticated panels (customer sign-in). */
export type AccessRecovery = {
  /** Pre-validated `next` path (see lib/navigation/safe-next-path). */
  loginHref: string
}

/**
 * Redeem-time profile gate carried onto a ready reward. When `complete` is false
 * the reward panel collects the missing details (Name, DOB, required verified
 * email) before exposing the redeem action. Phone is already verified at sign-up.
 */
export type ProfileGate = {
  complete: boolean
  needsPhoneVerification?: boolean
  /** Verified evidence, separate from customer-entered profile completeness. */
  dateOfBirthVerified: boolean
  /** Email entered but unconfirmed — show the inline "enter your code" step. */
  needsEmailVerification: boolean
  /**
   * A code for the unconfirmed email is pending for this customer, so the
   * email step may ask for it. False offers to send one instead (a failed
   * send, a lapsed code, another browser; QA BUG-036). Omitted: pending.
   */
  emailCodePending?: boolean
  fullName: string | null
  dateOfBirth: string | null
  email: string | null
  emailLocked: boolean
}

/** Merchant + card facts shared by the join wizard screens. */
export type JoinMerchant = {
  name: string
  slug: string
  termsUrl: string
}

export type JoinCard = {
  collectionWindows?: import("@/lib/legal/content").VenueTermsInput["collectionWindows"]
  tradingDayStartsAt?: string
  rewardExpiresAfterDays?: number | null
  minimumSpendPence?: number | null
  oneTransactionPerStamp?: boolean
  rewardPool?: import("@/lib/legal/content").VenueTermsInput["rewardPool"]
  name: string
  stampsRequired: number
  rewardTerms: string
  /** Names from the venue's active reward pool — examples of the draw. */
  rewardExamples?: readonly string[]
}

/** Reward facts shared by waiting/ready/redeemed panels. */
export type RewardView = {
  rewardId: string
  membershipId: string
  rewardName: string
  rewardTerms: string
  redeemableFrom: string | null
  availableFrom: string | null
  expiresAt: string | null
  requiresAgeCheck: boolean
  earningTerms: string | null
  inWindow: boolean
  windowEndsAt: string | null
  upgradeRewardName: string | null
  nextWindowStartsAt: string | null
  nextWindowEndsAt: string | null
  nextWindowUpgradeName: string | null
}

export type RedeemedRewardView = RewardView & {
  redeemedAt: string | null
}

/**
 * An issued reward (birthday / merchant direct) surfaced beside a card as a
 * distinct gift — never the stamp cycle's completion reward. `redeemable` is
 * gated only by its own `redeemableFrom`, not by stamp count.
 */
export type CardGift = {
  rewardId: string
  rewardName: string
  source: RewardSource
  redeemable: boolean
  /** Unlocked but held only by a setup step the guest finishes on the reward
   *  page (details, email or mobile number); it is not a code to show yet. */
  needsSetup?: boolean
  availableFrom: string | null
}

export type CustomerExperience =
  // --- Join wizard (one job per screen) ---
  | {
      kind: "join_welcome"
      merchant: JoinMerchant
      card: JoinCard
      /** The welcome CTA always opens the phone step: email is a fallback. */
      qrId: string
    }
  | {
      kind: "join_phone"
      merchant: JoinMerchant
      card: JoinCard
      qrId?: string
      /** Channel the code will be sent on first. */
      channel: OtpChannel
      /** Email sign-in is on: a failed send offers email beside the error. */
      emailSignIn: boolean
      /**
       * The guest came back from a code step whose pending code had expired,
       * so the form says why they are here.
       */
      notice?: "code_expired"
      /**
       * "Wrong number? Change it": the number of the code still pending on
       * this browser, in UK national form, so the guest edits rather than
       * retypes it. Only ever this browser's own signed pending code.
       */
      prefillPhone?: string
    }
  | {
      kind: "join_email"
      merchant: JoinMerchant
      card: JoinCard
      qrId?: string
      /**
       * Never `off`: this step does not exist while email sign-in is off. It
       * is reached only as a fallback from the phone code step (`step=email`).
       */
      emailMode: Exclude<JoinEmailMode, "off">
      /**
       * A phone code is still pending, so "Use my phone number instead"
       * returns to that code rather than a blank number form.
       */
      phoneCodePending: boolean
    }
  | {
      /**
       * A verified-email handoff with no wallet behind it. Mode `existing`
       * (`canCreate` false): no card uses this email, one way back to the
       * phone. Mode `full` (`canCreate` true): only a handoff left by the
       * previous build, which one "Continue" spends; new fallback emails are
       * turned into a wallet at the code step and never land here.
       */
      kind: "join_email_choice"
      merchant: JoinMerchant
      card: JoinCard
      qrId?: string
      maskedEmail: string
      canCreate: boolean
    }
  | {
      kind: "join_otp"
      merchant: JoinMerchant
      card: JoinCard
      qrId?: string
      contact: JoinOtpContact
      location: LocationRequirement
    }
  | {
      kind: "join_terms"
      merchant: JoinMerchant
      card: JoinCard
      qrId?: string
      location: LocationRequirement
      /** What the wallet can be contacted on, for the marketing line. */
      contactChannels: JoinContactChannels
      /**
       * A reward on this card may be age checked (an active reward-pool item
       * or collection-window upgrade requires it), so joining says photo ID
       * may be checked. False when the card data does not say so.
       */
      rewardMayNeedPhotoId: boolean
    }
  | {
      kind: "join_returning"
      merchant: JoinMerchant
      card: JoinCard
      membershipId: string
      current: number
      total: number
      qrId?: string
    }
  // --- Stamp ---
  | {
      kind: "stamp_confirm"
      membershipId: string
      merchantName: string
      qrId: string
      location: LocationRequirement
      // The stamp screen now shows the live card so the stamp lands in place.
      cardName: string
      current: number
      total: number
      stampDates: string[]
      /** Pre-formatted UK date for the stamp landing now (computed server-side). */
      todayLabel: string
      /**
       * When the stamp after today's opens (ISO instant, from the venue's
       * trading-day start). Null or absent when it could not be worked out,
       * and the screen says "on your next visit" instead.
       */
      nextStampFrom?: string | null
    }
  | {
      kind: "card_stamped_today"
      membershipId: string
      merchantName: string
      qrId: string
      location: LocationRequirement
      cardName: string
      current: number
      total: number
      stampDates: string[]
      todayLabel: string
      /** As on `stamp_confirm`: when the next stamp opens, if known. */
      nextStampFrom?: string | null
      /**
       * Set once the final stamp has unlocked a reward that is not yet
       * redeemable. The completed card holds in place (no swap to the waiting
       * voucher) and offers a tap-through to this reward instead.
       */
      reward?: {
        rewardId: string
        rewardName: string
        redeemableFrom: string | null
      }
    }
  | {
      /**
       * The stamp screen was opened without a QR that matches this card —
       * either no `qr` at all, or one that resolves to a different venue or
       * to nothing. The member's card is still shown (it is theirs and it is
       * the reassuring thing on screen); only the stamp control is withheld,
       * with a recovery path in its place instead of a dead-end sentence.
       */
      kind: "stamp_unmatched"
      problem: "missing" | "unmatched"
      membershipId: string
      merchantName: string
      cardName: string
      current: number
      total: number
      stampDates: string[]
    }
  // --- Card (the card is always shown; reward sub-status drives the footer) ---
  | {
      kind: "card_collecting"
      membershipId: string
      merchantName: string
      locality?: string | null
      googleReviewUrl?: string | null
      cardName: string
      current: number
      total: number
      slamIndex: number
      reward: CardRewardStatus
      /** The unlocked reward waits only on a setup step on its own page. */
      rewardNeedsSetup?: boolean
      rewardId?: string
      rewardName?: string
      rewardTerms: string
      rewardRedeemableFrom: string | null
      walletReward?: RewardView
      /** Issued reward shown as a distinct gift chip, separate from the
       *  stamp-cycle completion reward above. Absent/null when there is none. */
      gift?: CardGift | null
      stampDates: string[]
      justStamped: boolean
      justJoined: boolean
      firstStampRecovery?: JoinFirstStampRecovery | null
      geoFlagged: boolean
      justRedeemed: boolean
      /** Shareable "Bring a Regular" join link carrying this card's opaque
       *  referral_code (never the membership UUID); absent if unshareable. */
      referralShareUrl?: string
      referralBonusBank?: ReferralBonusBank
      /** When the next stamp opens after the one just added, if known. Only
       *  loaded straight after a stamp. */
      nextStampFrom?: string | null
    }
  // --- Reward ---
  | {
      kind: "reward_waiting"
      reward: RewardView
      merchantName: string
      fromCard: boolean
      /**
       * Collection requirements, so the waiting screen can offer the optional
       * "Get ready to collect" step. Preparing changes the profile only — never
       * the reward's timing or its eligibility to be collected.
       */
      profileGate?: ProfileGate
      /** The customer asked to prepare early (`/reward/[id]?prepare=1`). */
      preparing?: boolean
    }
  | {
      kind: "reward_ready"
      reward: RewardView
      merchantName: string
      location: LocationRequirement
      fromCard: boolean
      profileGate: ProfileGate
    }
  | {
      kind: "redeemed_proof"
      reward: RedeemedRewardView
      merchantName: string
      justRedeemed: boolean
    }
  // --- Catch-all ---
  | {
      kind: "unavailable"
      reason: string
      recovery?: AccessRecovery
      /** Set on the reward route, so the copy names the reward, not a card. */
      subject?: "reward"
    }

export type CustomerExperienceKind = CustomerExperience["kind"]

/**
 * Compile-time exhaustiveness guard. Call in the `default` of every switch over
 * `CustomerExperience["kind"]` so a new state cannot be added without handling it.
 */
export function assertNever(value: never): never {
  throw new Error(
    `Unhandled customer experience case: ${JSON.stringify(value)}`
  )
}

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
  | "rate_limited"
  | "pool_unavailable"
  | "unauthenticated"
  | "profile_incomplete"
  | "location_required"
  | "location_out_of_range"
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
}

/** Recovery target for unavailable/unauthenticated panels (customer sign-in). */
export type AccessRecovery = {
  /** Pre-validated `next` path (see lib/navigation/safe-next-path). */
  loginHref: string
}

/**
 * Redeem-time profile gate carried onto a ready reward. When `complete` is false
 * the reward panel collects the missing details (Name, DOB, optional verified
 * email) before exposing the redeem action. Phone is already verified at sign-up.
 */
export type ProfileGate = {
  complete: boolean
  /** Email entered but unconfirmed — show the inline "enter your code" step. */
  needsEmailVerification: boolean
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
  name: string
  stampsRequired: number
  rewardTerms: string
}

/** Reward facts shared by waiting/ready/redeemed panels. */
export type RewardView = {
  rewardId: string
  membershipId: string
  rewardName: string
  rewardTerms: string
  redeemableFrom: string | null
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
  redeemableFrom: string | null
}

export type CustomerExperience =
  // --- Join wizard (one job per screen) ---
  | {
      kind: "join_welcome"
      merchant: JoinMerchant
      card: JoinCard
      qrId: string
    }
  | {
      kind: "join_phone"
      merchant: JoinMerchant
      card: JoinCard
      qrId?: string
    }
  | {
      kind: "join_otp"
      merchant: JoinMerchant
      card: JoinCard
      qrId?: string
      contactLast4: string
      location: LocationRequirement
    }
  | {
      kind: "join_terms"
      merchant: JoinMerchant
      card: JoinCard
      qrId?: string
      location: LocationRequirement
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
      rewardId?: string
      rewardName?: string
      rewardTerms: string
      rewardRedeemableFrom: string | null
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
    }
  // --- Reward ---
  | {
      kind: "reward_waiting"
      reward: RewardView
      merchantName: string
      fromCard: boolean
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
  | { kind: "unavailable"; reason: string; recovery?: AccessRecovery }

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

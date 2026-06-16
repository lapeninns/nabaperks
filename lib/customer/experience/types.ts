/**
 * Customer experience layer — the union of states a customer can be in across
 * the QR → join → stamp → card → reward journey.
 *
 * The union describes *what is true*, not how it is phrased. Copy lives in
 * `copy.ts`; visuals live in the panels. Derivation (`derive.ts`) is pure and
 * never imports the database — loaders do the impure fetching and hand normalized
 * facts to `deriveCustomerExperience({ entry, context })`.
 */

/** Which route the customer entered from. Same facts can mean different UI. */
export type CustomerExperienceEntry =
  | "qr"
  | "join"
  | "card"
  | "stamp"
  | "reward"

/** Identity/access failures that short-circuit every route to a recovery panel. */
export type AccessProblem = "unauthenticated" | "unauthorized" | "not_found"

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
  | "unavailable"
  | "unknown"

/** Reward sub-status used to drive a card footer without a separate top kind. */
export type CardRewardStatus = "none" | "waiting" | "ready"

/** Optional geolocation gate carried into self-service stamp/redeem forms. */
export type LocationRequirement = {
  requireGeofence: boolean
  geofenceRadiusMeters: number
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
  minSpendPence: number | null
  rewardTerms: string
}

/** Reward facts shared by waiting/ready/redeemed panels. */
export type RewardView = {
  rewardId: string
  membershipId: string
  rewardName: string
  rewardTerms: string
  minSpendPence: number | null
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
      contact: string
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
    }
  | { kind: "card_stamped_today"; membershipId: string; merchantName: string }
  // --- Card (the card is always shown; reward sub-status drives the footer) ---
  | {
      kind: "card_collecting"
      membershipId: string
      merchantName: string
      cardName: string
      current: number
      total: number
      slamIndex: number
      reward: CardRewardStatus
      rewardId?: string
      rewardName?: string
      rewardTerms: string
      minSpendPence: number | null
      rewardRedeemableFrom: string | null
      stampDates: string[]
      justStamped: boolean
      justJoined: boolean
      /** Joined via QR but the first stamp was blocked (e.g. pool/billing) — the
       *  welcome card invites collecting it instead of implying it landed. */
      firstStampPending?: boolean
      geoFlagged: boolean
      justRedeemed: boolean
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
  | { kind: "redeemed_proof"; reward: RewardView; merchantName: string }
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

import { pickByPriority } from "./priorities"
import {
  assertNever,
  type AccessProblem,
  type AccessRecovery,
  type CardGift,
  type CustomerExperience,
  type CustomerExperienceKind,
  type JoinCard,
  type JoinMerchant,
  type LocationRequirement,
  type ProfileGate,
  type RewardView,
  externalAccessProblem,
  type InternalAccessProblem,
} from "./types"
import type { ReferralBonusBank } from "@/lib/customer/referral-bonus-bank"
import type { JoinFirstStampRecovery } from "@/lib/customer/join-first-stamp-recovery"

/**
 * Pure derivation: loaded facts in, a single {@link CustomerExperience} out.
 *
 * This module never imports the database or `next/*`. Loaders (`load-*.ts`) do
 * the impure fetching and date maths, then hand normalized facts here. That keeps
 * the decision logic fast to unit-test against fixtures and free of side effects.
 */

// --- Loader → derive contracts (one per entry route) ---

// Loaders pass the RAW lookup state; accessUnavailable collapses it. Keeping
// the wide type here and the narrow one on the rendered experience is what makes
// the compiler flag any new caller that tries to surface "unauthorized".
type AccessFailure = {
  access: InternalAccessProblem
  recovery?: AccessRecovery
}

/** Default gate for callers that don't load one — treat as complete and let the
 *  server/RPC enforce. Loaders that can resolve the customer pass the real gate. */
const COMPLETE_GATE: ProfileGate = {
  complete: true,
  dateOfBirthVerified: true,
  needsEmailVerification: false,
  fullName: null,
  dateOfBirth: null,
  email: null,
  emailLocked: false,
}

/** Recovery copy for the full-card-without-reward data inconsistency (G9). */
const FULL_CARD_NO_REWARD_REASON =
  "We're sorting your reward. Check back shortly, or ask a team member."

export type CardContext =
  | AccessFailure
  | {
      access?: undefined
      unavailableReason?: string
      /** Active-cycle count ≥ required but no unlocked reward row — a data
       *  inconsistency. Surfaces a recovery state instead of inviting a stamp. */
      fullWithoutReward?: boolean
      membershipId: string
      merchantName: string
      locality?: string | null
      googleReviewUrl?: string | null
      cardName: string
      current: number
      total: number
      reward: {
        id: string
        name: string
        terms: string
        redeemableFrom: string | null
        redeemable: boolean
      } | null
      /** Issued reward (birthday/merchant) to show as a distinct gift chip. */
      giftReward?: {
        id: string
        name: string
        source: CardGift["source"]
        redeemableFrom: string | null
        redeemable: boolean
      } | null
      rewardTerms: string
      stampDates: string[]
      justStamped: boolean
      justJoined: boolean
      firstStampRecovery?: JoinFirstStampRecovery | null
      geoFlagged: boolean
      justRedeemed: boolean
      /** Shareable "Bring a Regular" join link (opaque referral_code), or absent. */
      referralShareUrl?: string
      referralBonusBank?: ReferralBonusBank
    }

export type StampContext =
  | AccessFailure
  | {
      access?: undefined
      unavailableReason?: string
      /** Active-cycle count ≥ required but no unlocked reward row — block the
       *  stamp and surface a recovery state instead of a confirm screen. */
      fullWithoutReward?: boolean
      membershipId: string
      merchantName: string
      unlockedReward: (RewardView & { redeemable: boolean }) | null
      alreadyStampedToday: boolean
      qrValid: boolean
      qrMissing: boolean
      qrId?: string
      location: LocationRequirement
      profileGate?: ProfileGate
      // Card progress so the stamp screen can render the live card grid.
      cardName?: string
      current?: number
      total?: number
      stampDates?: string[]
      todayLabel?: string
    }

export type RewardContext =
  | AccessFailure
  | {
      access?: undefined
      unavailableReason?: string
      reward: RewardView
      merchantName: string
      status: string
      redeemable: boolean
      /** Server-confirmed collection instant for the redeemed-proof line (F26). */
      redeemedAt?: string | null
      justRedeemed: boolean
      location: LocationRequirement
      profileGate?: ProfileGate
    }

export type JoinContext =
  | { unavailable: true }
  | {
      unavailable?: false
      merchantId: string
      qrCodeId?: string
      merchant: JoinMerchant
      card: JoinCard
      qrId?: string
      step?: string
      hasSession: boolean
      pendingOtp: boolean
      pendingPhone?: string
      membership: { id: string; current: number } | null
      location: LocationRequirement
    }

export type DeriveCustomerExperienceInput =
  | { entry: "card" | "qr"; context: CardContext }
  | { entry: "stamp"; context: StampContext }
  | { entry: "reward"; context: RewardContext }
  | { entry: "join"; context: JoinContext }

export function deriveCustomerExperience(
  input: DeriveCustomerExperienceInput
): CustomerExperience {
  switch (input.entry) {
    case "card":
    case "qr":
      return deriveCard(input.context)
    case "stamp":
      return deriveStamp(input.context)
    case "reward":
      return deriveReward(input.context)
    case "join":
      return deriveJoin(input.context)
    default:
      return assertNever(input)
  }
}

function deriveCard(context: CardContext): CustomerExperience {
  if (context.access) {
    return accessUnavailable(context.access, context.recovery)
  }

  if (context.unavailableReason) {
    return { kind: "unavailable", reason: context.unavailableReason }
  }

  if (context.fullWithoutReward) {
    return { kind: "unavailable", reason: FULL_CARD_NO_REWARD_REASON }
  }

  const reward = context.reward
  const rewardStatus = reward
    ? reward.redeemable
      ? ("ready" as const)
      : ("waiting" as const)
    : ("none" as const)

  const giftReward = context.giftReward
  const gift: CardGift | null = giftReward
    ? {
        rewardId: giftReward.id,
        rewardName: giftReward.name,
        source: giftReward.source,
        redeemable: giftReward.redeemable,
        redeemableFrom: giftReward.redeemableFrom,
      }
    : null

  return {
    kind: "card_collecting",
    membershipId: context.membershipId,
    merchantName: context.merchantName,
    locality: context.locality,
    googleReviewUrl: context.googleReviewUrl,
    cardName: context.cardName,
    current: context.current,
    total: context.total,
    slamIndex: context.justStamped ? context.current - 1 : -1,
    reward: rewardStatus,
    rewardId: reward?.id,
    rewardName: reward?.name,
    rewardTerms: reward?.terms ?? context.rewardTerms,
    rewardRedeemableFrom: reward?.redeemableFrom ?? null,
    gift,
    stampDates: context.stampDates,
    justStamped: context.justStamped,
    justJoined: context.justJoined,
    firstStampRecovery: context.firstStampRecovery,
    geoFlagged: context.geoFlagged,
    justRedeemed: context.justRedeemed,
    referralShareUrl: context.referralShareUrl,
    referralBonusBank: context.referralBonusBank,
  }
}

/** Card progress shared by both stamp-screen states, with safe defaults. */
function stampCardProgress(context: {
  cardName?: string
  current?: number
  total?: number
  stampDates?: string[]
  todayLabel?: string
  location: LocationRequirement
}) {
  return {
    location: context.location,
    cardName: context.cardName ?? "",
    current: context.current ?? 0,
    total: context.total ?? 0,
    stampDates: context.stampDates ?? [],
    todayLabel: context.todayLabel ?? "",
  }
}

/**
 * Both stamp-screen states (ready-to-stamp and already-stamped) share one shape
 * and render through the same panel — build the experience once. The cast is
 * safe because the two variants are structurally identical apart from `kind`.
 */
function stampScreenExperience(
  kind: "stamp_confirm" | "card_stamped_today",
  context: {
    membershipId: string
    merchantName: string
    qrId?: string
    location: LocationRequirement
    cardName?: string
    current?: number
    total?: number
    stampDates?: string[]
    todayLabel?: string
  },
  reward?: {
    rewardId: string
    rewardName: string
    redeemableFrom: string | null
  }
): CustomerExperience {
  return {
    kind,
    membershipId: context.membershipId,
    merchantName: context.merchantName,
    qrId: context.qrId ?? "",
    ...stampCardProgress(context),
    ...(reward ? { reward } : {}),
  } as CustomerExperience
}

/**
 * The reward pointer to attach to a held completed card, or undefined. The
 * completing stamp can unlock a reward that is not yet redeemable; in that case
 * the stamp screen holds on the card with a tap-through rather than swapping to
 * the waiting voucher. Keeping this decision here keeps {@link deriveStamp} flat.
 */
function heldStampReward(context: {
  unlockedReward: (RewardView & { redeemable: boolean }) | null
}):
  | { rewardId: string; rewardName: string; redeemableFrom: string | null }
  | undefined {
  if (!context.unlockedReward || context.unlockedReward.redeemable) {
    return undefined
  }
  return {
    rewardId: context.unlockedReward.rewardId,
    rewardName: context.unlockedReward.rewardName,
    redeemableFrom: context.unlockedReward.redeemableFrom,
  }
}

function deriveStamp(context: StampContext): CustomerExperience {
  if (context.access) {
    return accessUnavailable(context.access, context.recovery)
  }

  if (context.unavailableReason) {
    return { kind: "unavailable", reason: context.unavailableReason }
  }

  if (context.fullWithoutReward) {
    return { kind: "unavailable", reason: FULL_CARD_NO_REWARD_REASON }
  }

  // A completed card whose reward is not yet redeemable holds on the live card —
  // the customer keeps the full grid and reveal, with the reward one tap away —
  // instead of the stamp screen swapping straight to the waiting voucher. There
  // is nothing to collect at the counter until the next UK business day, so the
  // calm card moment is allowed to breathe. A ready reward still falls through to
  // its own state below (the route redirects to collect it now).
  const heldReward = heldStampReward(context)
  if (heldReward) {
    return stampScreenExperience("card_stamped_today", context, heldReward)
  }

  const candidates: CustomerExperienceKind[] = []

  const unlockedReward = context.unlockedReward
  if (unlockedReward) {
    candidates.push(
      unlockedReward.redeemable ? "reward_ready" : "reward_waiting"
    )
  }
  if (context.alreadyStampedToday) candidates.push("card_stamped_today")
  if (context.qrValid) candidates.push("stamp_confirm")

  const kind = pickByPriority("stamp", candidates)

  switch (kind) {
    case "reward_ready":
      if (!unlockedReward) {
        return {
          kind: "unavailable",
          reason: "Scan the venue code again to add your stamp.",
        }
      }
      return {
        kind: "reward_ready",
        reward: stripRedeemable(unlockedReward),
        merchantName: context.merchantName,
        location: context.location,
        fromCard: false,
        profileGate: context.profileGate ?? COMPLETE_GATE,
      }
    case "reward_waiting":
      if (!unlockedReward) {
        return {
          kind: "unavailable",
          reason: "Scan the venue code again to add your stamp.",
        }
      }
      return {
        kind: "reward_waiting",
        reward: stripRedeemable(unlockedReward),
        merchantName: context.merchantName,
        fromCard: false,
      }
    case "card_stamped_today":
    case "stamp_confirm":
      return stampScreenExperience(kind, context)
    default:
      return {
        kind: "unavailable",
        reason: context.qrMissing
          ? "Open this screen from the printed venue QR so the stamp is tied to the right business."
          : "Scan the venue code again to add your stamp.",
      }
  }
}

function deriveReward(context: RewardContext): CustomerExperience {
  if (context.access) {
    return accessUnavailable(context.access, context.recovery)
  }

  const candidates: CustomerExperienceKind[] = []

  if (context.status === "redeemed") {
    candidates.push("redeemed_proof")
  }
  if (!context.unavailableReason) {
    if (context.redeemable) candidates.push("reward_ready")
    else if (context.status === "unlocked") candidates.push("reward_waiting")
  }

  const kind = pickByPriority("reward", candidates)

  switch (kind) {
    case "redeemed_proof":
      return {
        kind: "redeemed_proof",
        reward: { ...context.reward, redeemedAt: context.redeemedAt ?? null },
        merchantName: context.merchantName,
        justRedeemed: context.justRedeemed,
      }
    case "reward_ready":
      return {
        kind: "reward_ready",
        reward: context.reward,
        merchantName: context.merchantName,
        location: context.location,
        fromCard: true,
        profileGate: context.profileGate ?? COMPLETE_GATE,
      }
    case "reward_waiting":
      return {
        kind: "reward_waiting",
        reward: context.reward,
        merchantName: context.merchantName,
        fromCard: true,
      }
    default:
      return {
        kind: "unavailable",
        reason:
          context.unavailableReason ?? "This reward is no longer available.",
      }
  }
}

function deriveJoin(context: JoinContext): CustomerExperience {
  if (context.unavailable) {
    return {
      kind: "unavailable",
      reason: "This loyalty card is unavailable.",
    }
  }

  const membership = context.membership
  const qrId = context.qrId
  const candidates: CustomerExperienceKind[] = []
  if (membership) candidates.push("join_returning")
  if (context.hasSession) candidates.push("join_terms")
  if (context.pendingOtp) candidates.push("join_otp")
  // Welcome and phone are mutually exclusive: a QR scan lands on welcome, then
  // the welcome CTA carries `step=phone` to advance to the phone form.
  if (qrId && context.step !== "phone") candidates.push("join_welcome")
  else candidates.push("join_phone")

  const kind = pickByPriority("join", candidates)

  switch (kind) {
    case "join_returning":
      if (!membership) {
        return {
          kind: "join_phone",
          merchant: context.merchant,
          card: context.card,
          qrId,
        }
      }
      return {
        kind: "join_returning",
        merchant: context.merchant,
        card: context.card,
        membershipId: membership.id,
        current: membership.current,
        total: context.card.stampsRequired,
        qrId,
      }
    case "join_terms":
      return {
        kind: "join_terms",
        merchant: context.merchant,
        card: context.card,
        qrId: context.qrId,
        location: context.location,
      }
    case "join_otp":
      return {
        kind: "join_otp",
        merchant: context.merchant,
        card: context.card,
        qrId: context.qrId,
        contactLast4: context.pendingPhone?.slice(-4) ?? "",
        location: context.location,
      }
    case "join_welcome":
      if (!qrId) {
        return {
          kind: "join_phone",
          merchant: context.merchant,
          card: context.card,
          qrId,
        }
      }
      return {
        kind: "join_welcome",
        merchant: context.merchant,
        card: context.card,
        qrId,
      }
    default:
      return {
        kind: "join_phone",
        merchant: context.merchant,
        card: context.card,
        qrId: context.qrId,
      }
  }
}

function accessUnavailable(
  access: InternalAccessProblem,
  recovery?: AccessRecovery
): CustomerExperience {
  // Backstop at the one sink that turns an access state into customer-visible
  // copy, so an untyped or future caller cannot reintroduce the existence
  // oracle, and a collapsed state never carries a recovery control the
  // not_found branch would not have.
  const external = externalAccessProblem(access)
  return {
    kind: "unavailable",
    reason: accessProblemReason(external),
    recovery: external === "unauthenticated" ? recovery : undefined,
  }
}

function accessProblemReason(access: AccessProblem): string {
  switch (access) {
    case "unauthenticated":
      // Names the action the recovery button performs (sign in), instead of
      // pointing at the venue QR while the button opens login (CUS-P2-08).
      return "Sign in with your number to open this card."
    case "not_found":
      return "This could not be found."
    default:
      return assertNever(access)
  }
}

function stripRedeemable(
  reward: RewardView & { redeemable: boolean }
): RewardView {
  return {
    rewardId: reward.rewardId,
    membershipId: reward.membershipId,
    rewardName: reward.rewardName,
    rewardTerms: reward.rewardTerms,
    redeemableFrom: reward.redeemableFrom,
  }
}

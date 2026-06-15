import { pickByPriority } from "./priorities"
import {
  assertNever,
  type AccessProblem,
  type AccessRecovery,
  type CustomerExperience,
  type CustomerExperienceKind,
  type JoinCard,
  type JoinMerchant,
  type LocationRequirement,
  type RedemptionTokenView,
  type RewardView,
} from "./types"

/**
 * Pure derivation: loaded facts in, a single {@link CustomerExperience} out.
 *
 * This module never imports the database or `next/*`. Loaders (`load-*.ts`) do
 * the impure fetching and date maths, then hand normalized facts here. That keeps
 * the decision logic fast to unit-test against fixtures and free of side effects.
 */

// --- Loader → derive contracts (one per entry route) ---

type AccessFailure = { access: AccessProblem; recovery?: AccessRecovery }

export type CardContext =
  | AccessFailure
  | {
      access?: undefined
      unavailableReason?: string
      membershipId: string
      merchantName: string
      cardName: string
      current: number
      total: number
      stampsBlocked: boolean
      reward: {
        id: string
        name: string
        terms: string
        minSpendPence: number | null
        redeemableFrom: string | null
        redeemable: boolean
      } | null
      rewardTerms: string
      stampDates: string[]
      justStamped: boolean
      justJoined: boolean
      geoFlagged: boolean
      justRedeemed: boolean
    }

export type StampContext =
  | AccessFailure
  | {
      access?: undefined
      unavailableReason?: string
      membershipId: string
      merchantName: string
      unlockedReward: (RewardView & { redeemable: boolean }) | null
      alreadyStampedToday: boolean
      qrValid: boolean
      qrMissing: boolean
      qrId?: string
      location: LocationRequirement
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
      redeemedProof: boolean
      redemptionToken: RedemptionTokenView | null
      location: LocationRequirement
    }

export type JoinContext =
  | { unavailable: true }
  | {
      unavailable?: false
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

  const reward = context.reward
  const rewardStatus = reward
    ? reward.redeemable
      ? ("ready" as const)
      : ("waiting" as const)
    : ("none" as const)

  return {
    kind: "card_collecting",
    membershipId: context.membershipId,
    merchantName: context.merchantName,
    cardName: context.cardName,
    current: context.current,
    total: context.total,
    slamIndex: context.justStamped ? context.current - 1 : -1,
    reward: rewardStatus,
    rewardId: reward?.id,
    rewardName: reward?.name,
    rewardTerms: reward?.terms ?? context.rewardTerms,
    minSpendPence: reward?.minSpendPence ?? null,
    rewardRedeemableFrom: reward?.redeemableFrom ?? null,
    stampsBlocked: context.stampsBlocked,
    stampDates: context.stampDates,
    justStamped: context.justStamped,
    justJoined: context.justJoined,
    geoFlagged: context.geoFlagged,
    justRedeemed: context.justRedeemed,
  }
}

function deriveStamp(context: StampContext): CustomerExperience {
  if (context.access) {
    return accessUnavailable(context.access, context.recovery)
  }

  if (context.unavailableReason) {
    return { kind: "unavailable", reason: context.unavailableReason }
  }

  const candidates: CustomerExperienceKind[] = []

  if (context.unlockedReward) {
    candidates.push(
      context.unlockedReward.redeemable ? "reward_ready" : "reward_waiting"
    )
  }
  if (context.alreadyStampedToday) candidates.push("card_stamped_today")
  if (context.qrValid) candidates.push("stamp_confirm")

  const kind = pickByPriority("stamp", candidates)

  switch (kind) {
    case "reward_ready": {
      const unlockedReward = context.unlockedReward
      if (!unlockedReward) {
        return {
          kind: "unavailable",
          reason: "This reward is no longer available.",
        }
      }

      return {
        kind: "reward_ready",
        reward: stripRedeemable(unlockedReward),
        merchantName: context.merchantName,
        location: context.location,
        fromCard: false,
      }
    }
    case "reward_waiting": {
      const unlockedReward = context.unlockedReward
      if (!unlockedReward) {
        return {
          kind: "unavailable",
          reason: "This reward is no longer available.",
        }
      }

      return {
        kind: "reward_waiting",
        reward: stripRedeemable(unlockedReward),
        merchantName: context.merchantName,
        fromCard: false,
      }
    }
    case "card_stamped_today":
      return {
        kind: "card_stamped_today",
        membershipId: context.membershipId,
        merchantName: context.merchantName,
      }
    case "stamp_confirm":
      return {
        kind: "stamp_confirm",
        membershipId: context.membershipId,
        merchantName: context.merchantName,
        qrId: context.qrId ?? "",
        location: context.location,
      }
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

  if (context.redeemedProof || context.status === "redeemed") {
    candidates.push("redeemed_proof")
  }
  if (!context.unavailableReason) {
    if (context.redeemable && context.redemptionToken) {
      candidates.push("reward_qr_pending")
    } else if (context.redeemable) candidates.push("reward_ready")
    else if (context.status === "unlocked") candidates.push("reward_waiting")
  }

  const kind = pickByPriority("reward", candidates)

  switch (kind) {
    case "redeemed_proof":
      return {
        kind: "redeemed_proof",
        reward: context.reward,
        merchantName: context.merchantName,
      }
    case "reward_ready":
      return {
        kind: "reward_ready",
        reward: context.reward,
        merchantName: context.merchantName,
        location: context.location,
        fromCard: true,
      }
    case "reward_qr_pending":
      if (!context.redemptionToken) {
        return {
          kind: "unavailable",
          reason: "This reward is no longer available.",
        }
      }
      return {
        kind: "reward_qr_pending",
        reward: context.reward,
        merchantName: context.merchantName,
        token: context.redemptionToken,
        fromCard: true,
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

  const candidates: CustomerExperienceKind[] = []
  if (context.membership) candidates.push("join_returning")
  if (context.hasSession) candidates.push("join_terms")
  if (context.pendingOtp) candidates.push("join_otp")
  // Welcome and phone are mutually exclusive: a QR scan lands on welcome, then
  // the welcome CTA carries `step=phone` to advance to the phone form.
  if (context.qrId && context.step !== "phone") candidates.push("join_welcome")
  else candidates.push("join_phone")

  const kind = pickByPriority("join", candidates)

  switch (kind) {
    case "join_returning": {
      const membership = context.membership
      if (!membership) {
        return {
          kind: "unavailable",
          reason: "This loyalty card is unavailable.",
        }
      }

      return {
        kind: "join_returning",
        merchant: context.merchant,
        card: context.card,
        membershipId: membership.id,
        current: membership.current,
        total: context.card.stampsRequired,
        qrId: context.qrId,
      }
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
        contact: context.pendingPhone ?? "",
      }
    case "join_welcome":
      return {
        kind: "join_welcome",
        merchant: context.merchant,
        card: context.card,
        qrId: context.qrId!,
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
  access: AccessProblem,
  recovery?: AccessRecovery
): CustomerExperience {
  return { kind: "unavailable", reason: accessProblemReason(access), recovery }
}

function accessProblemReason(access: AccessProblem): string {
  switch (access) {
    case "unauthenticated":
      return "Verify your identity from the venue QR to continue."
    case "unauthorized":
      return "This belongs to another customer."
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
    minSpendPence: reward.minSpendPence,
    redeemableFrom: reward.redeemableFrom,
  }
}

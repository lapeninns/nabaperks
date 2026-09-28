import type { OtpChannel } from "@/lib/customer/otp-channel-core"
import { pickByPriority } from "./priorities"
import {
  assertNever,
  type AccessProblem,
  type AccessRecovery,
  type CardGift,
  type CustomerExperience,
  type CustomerExperienceKind,
  type JoinCard,
  type JoinContactChannels,
  type JoinEmailMode,
  type JoinMerchant,
  type JoinOtpContact,
  type LocationRequirement,
  type ProfileGate,
  type RewardView,
  type StampEmailPrompt,
  externalAccessProblem,
  type InternalAccessProblem,
} from "./types"
import { FULL_CARD_REWARD_PENDING_COPY } from "@/lib/customer/card-stamp-labels"
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
        view: RewardView
        redeemable: boolean
      } | null
      /** Issued reward (birthday/merchant) to show as a distinct gift chip. */
      giftReward?: {
        id: string
        name: string
        source: CardGift["source"]
        availableFrom: string | null
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
      emailPrompt?: StampEmailPrompt | null
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
      availableForReview: boolean
      /** Server-confirmed collection instant for the redeemed-proof line (F26). */
      redeemedAt?: string | null
      justRedeemed: boolean
      /** The customer asked to complete collection details before the reward opens. */
      prepare?: boolean
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
      pendingChannel?: OtpChannel
      /**
       * Seconds left, by the server's clock, before the pending phone code's
       * step may offer email (lib/customer/phone-code-email-fallback.ts).
       */
      pendingPhoneEmailFallbackInSeconds?: number
      /**
       * When the server sent the pending phone code (epoch seconds). A resend
       * changes it, which restarts the step's wait for the email fallback.
       */
      pendingPhoneSentAt?: number
      /**
       * A join phone code is still pending while another step shows, so the
       * email step's phone link returns to that code, not a blank number.
       */
      phoneCodePending?: boolean
      /**
       * The server opened the email fallback for `step=email` (see
       * lib/customer/phone-code-email-fallback.ts). Without it `step=email`
       * shows the phone step.
       */
      emailFallbackOpen?: boolean
      /** Channel a first code goes out on (configured primary). */
      primaryChannel?: OtpChannel
      /** Email sign-in rollout mode; unset means `off`. */
      emailMode?: JoinEmailMode
      /** A pending join email challenge (the address already masked). */
      pendingEmail?: {
        maskedEmail: string
        resendAvailableAt: number
        deliveryDelayed?: boolean
      }
      /** A verified email no wallet holds yet, bound to this device and venue. */
      emailHandoff?: { maskedEmail: string }
      /** Contact channels the signed-in wallet holds (terms step copy). */
      customerChannels?: JoinContactChannels
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
    return { kind: "unavailable", reason: FULL_CARD_REWARD_PENDING_COPY }
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
        availableFrom: giftReward.availableFrom,
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
    rewardId: reward?.view.rewardId,
    rewardName: reward?.view.rewardName,
    rewardTerms: reward?.view.rewardTerms ?? context.rewardTerms,
    rewardRedeemableFrom: reward?.view.redeemableFrom ?? null,
    walletReward: reward?.view,
    gift,
    stampDates: context.stampDates,
    justStamped: context.justStamped,
    justJoined: context.justJoined,
    firstStampRecovery: context.firstStampRecovery,
    geoFlagged: context.geoFlagged,
    justRedeemed: context.justRedeemed,
    referralShareUrl: context.referralShareUrl,
    referralBonusBank: context.referralBonusBank,
    emailPrompt: context.justStamped ? (context.emailPrompt ?? null) : null,
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
    return { kind: "unavailable", reason: FULL_CARD_REWARD_PENDING_COPY }
  }

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
          reason: "Scan the venue QR again to add your stamp.",
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
          reason: "Scan the venue QR again to add your stamp.",
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
      // No QR, or one that does not match this card. The member's card is
      // still theirs to see — only the stamp control is withheld, and the
      // panel offers a way back (re-scan / cards) instead of a dead end.
      return {
        kind: "stamp_unmatched",
        problem: context.qrMissing ? "missing" : "unmatched",
        membershipId: context.membershipId,
        merchantName: context.merchantName,
        cardName: context.cardName ?? "",
        current: context.current ?? 0,
        total: context.total ?? 0,
        stampDates: context.stampDates ?? [],
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
    if (context.availableForReview) candidates.push("reward_ready")
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
        profileGate: context.profileGate,
        // Preparing is offered only where there is something to complete, so a
        // customer whose details are already saved is never asked again.
        preparing:
          context.prepare === true && context.profileGate !== undefined,
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

  const kind = pickByPriority("join", joinCandidates(context))

  switch (kind) {
    case "join_returning":
      return context.membership
        ? {
            kind: "join_returning",
            merchant: context.merchant,
            card: context.card,
            membershipId: context.membership.id,
            current: context.membership.current,
            total: context.card.stampsRequired,
            qrId: context.qrId,
          }
        : joinPhone(context)
    case "join_terms":
      return {
        kind: "join_terms",
        merchant: context.merchant,
        card: context.card,
        qrId: context.qrId,
        location: context.location,
        contactChannels: context.customerChannels ?? {
          phone: true,
          email: false,
        },
      }
    case "join_email_choice":
      return context.emailHandoff
        ? {
            kind: "join_email_choice",
            merchant: context.merchant,
            card: context.card,
            qrId: context.qrId,
            maskedEmail: context.emailHandoff.maskedEmail,
            canCreate: joinEmailMode(context) === "full",
          }
        : joinPhone(context)
    case "join_otp":
      return joinOtp(context)
    case "join_email":
      return joinEmail(context)
    case "join_welcome":
      return context.qrId
        ? {
            kind: "join_welcome",
            merchant: context.merchant,
            card: context.card,
            qrId: context.qrId,
            emailSignIn: joinEmailMode(context) !== "off",
          }
        : joinPhone(context)
    default:
      return joinPhone(context)
  }
}

type AvailableJoinContext = Extract<JoinContext, { unavailable?: false }>

/**
 * Every join state the loaded facts satisfy; `JOIN_PRIORITY` picks one. A QR
 * scan lands on welcome, whose CTA carries `step=phone` to open the contact
 * step; an explicit contact step always skips welcome.
 */
function joinCandidates(
  context: AvailableJoinContext
): CustomerExperienceKind[] {
  const candidates: CustomerExperienceKind[] = []
  if (context.membership) candidates.push("join_returning")
  if (context.hasSession) candidates.push("join_terms")
  if (context.emailHandoff && !context.hasSession) {
    candidates.push("join_email_choice")
  }
  if (context.pendingOtp || context.pendingEmail) candidates.push("join_otp")

  const explicitContactStep =
    context.step === "phone" || context.step === "email"
  if (context.qrId && !explicitContactStep) candidates.push("join_welcome")
  else candidates.push(joinContactKind(context))
  return candidates
}

function joinEmailMode(context: AvailableJoinContext): JoinEmailMode {
  return context.emailMode ?? "off"
}

/**
 * Phone is always the contact step. Email is a fallback the phone code step
 * offers (`step=email`): it does not exist while email sign-in is off, and
 * only once the server has opened it.
 */
function joinContactKind(
  context: AvailableJoinContext
): "join_email" | "join_phone" {
  return context.step === "email" &&
    joinEmailMode(context) !== "off" &&
    context.emailFallbackOpen === true
    ? "join_email"
    : "join_phone"
}

function joinPhone(context: AvailableJoinContext): CustomerExperience {
  return {
    kind: "join_phone",
    merchant: context.merchant,
    card: context.card,
    channel: context.primaryChannel ?? "whatsapp",
    qrId: context.qrId,
    emailSignIn: joinEmailMode(context) !== "off",
  }
}

function joinEmail(context: AvailableJoinContext): CustomerExperience {
  const emailMode = joinEmailMode(context)
  if (emailMode === "off") return joinPhone(context)
  return {
    kind: "join_email",
    merchant: context.merchant,
    card: context.card,
    qrId: context.qrId,
    emailMode,
    phoneCodePending: context.phoneCodePending === true,
  }
}

/** When a phone code step may offer email: never while email sign-in is off. */
function phoneCodeFallback(context: AvailableJoinContext): {
  emailFallbackInSeconds?: number
  phoneCodeSentAt?: number
} {
  if (joinEmailMode(context) === "off") return {}
  if (context.pendingPhoneEmailFallbackInSeconds === undefined) return {}
  return {
    emailFallbackInSeconds: context.pendingPhoneEmailFallbackInSeconds,
    ...(context.pendingPhoneSentAt === undefined
      ? {}
      : { phoneCodeSentAt: context.pendingPhoneSentAt }),
  }
}

/** The loader passes at most one pending challenge; email wins if both. */
function joinOtp(context: AvailableJoinContext): CustomerExperience {
  const contact: JoinOtpContact = context.pendingEmail
    ? {
        method: "email",
        maskedEmail: context.pendingEmail.maskedEmail,
        resendAvailableAt: context.pendingEmail.resendAvailableAt,
        ...(context.pendingEmail.deliveryDelayed
          ? { deliveryDelayed: true }
          : {}),
        phoneCodePending: context.phoneCodePending === true,
      }
    : {
        method: "phone",
        last4: context.pendingPhone?.slice(-4) ?? "",
        channel: context.pendingChannel ?? "sms",
        ...phoneCodeFallback(context),
      }
  return {
    kind: "join_otp",
    merchant: context.merchant,
    card: context.card,
    qrId: context.qrId,
    contact,
    location: context.location,
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
  const { redeemable, ...view } = reward
  void redeemable
  return view
}

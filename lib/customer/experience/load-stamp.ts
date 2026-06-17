import "server-only"

import {
  getCustomerCardState,
  getMembershipStampDisplayDates,
  reconcileCardStampCount,
} from "@/lib/customer/card"
import { getStampQrContextForMembership } from "@/lib/customer/join"
import { getMerchantStampLocationRequirement } from "@/lib/customer/stamp"
import { formatStampDisplayDateFromIso } from "@/lib/customer/uk-calendar"
import { isRedeemableFrom, ukTodayIso } from "@/lib/customer/uk-date"
import { customerLoginHref } from "@/lib/navigation/safe-next-path"
import { logger } from "@/lib/observability/logger"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

import type { StampContext } from "./derive"
import { loadProfileGate } from "./load-profile-gate"

const DEFAULT_LOCATION = { requireGeofence: false, geofenceRadiusMeters: 150 }

/**
 * Impure loader for the stamp route. Resolves card state, an unlocked reward,
 * whether the customer is already stamped for the UK business day, and the
 * scanned QR — then hands pure facts to {@link deriveCustomerExperience}.
 */
export async function loadStampExperienceContext(
  membershipId: string,
  qr: string | undefined
): Promise<StampContext> {
  const cardState = await getCustomerCardState(membershipId)

  if (cardState.status !== "ready") {
    return {
      access: cardState.status,
      recovery:
        cardState.status === "unauthenticated"
          ? {
              loginHref: customerLoginHref(
                `/card/${membershipId}/stamp${qr ? `?qr=${qr}` : ""}`
              ),
            }
          : undefined,
    }
  }

  const merchantName = cardState.merchant.business_name

  if (cardState.unavailableReason) {
    return {
      unavailableReason: cardState.unavailableReason,
      membershipId,
      merchantName,
      unlockedReward: null,
      alreadyStampedToday: false,
      qrValid: false,
      qrMissing: !qr,
      location: DEFAULT_LOCATION,
    }
  }

  // An unlocked reward blocks new stamps until collected; surface the reward QR
  // first so the customer sees the collection path instead of a stamp block.
  const unlocked = cardState.latestReward
  if (unlocked && unlocked.status === "unlocked") {
    const redeemable = isRedeemableFrom(unlocked.redeemable_from)
    return {
      membershipId,
      merchantName,
      unlockedReward: {
        rewardId: unlocked.id,
        membershipId,
        rewardName: unlocked.reward_name,
        rewardTerms: unlocked.reward_terms,
        minSpendPence: unlocked.min_spend_pence,
        redeemableFrom: unlocked.redeemable_from,
        redeemable,
      },
      alreadyStampedToday: false,
      qrValid: false,
      qrMissing: !qr,
      location: DEFAULT_LOCATION,
      // The gate only governs a ready reward — skip the profile lookup otherwise.
      profileGate: redeemable ? await loadProfileGate() : undefined,
    }
  }

  // No unlocked reward, yet the active-cycle count is already full: the reward
  // row the RPC expects is missing. Block the stamp with a recovery state and
  // leave an operator-diagnosable signal instead of inviting another scan.
  const loyaltyCard = cardState.loyaltyCard
  if (
    loyaltyCard &&
    cardState.membership.current_stamp_count >= loyaltyCard.stamps_required
  ) {
    logger.warn("customer_full_card_without_reward", {
      membershipId,
      route: "stamp",
      currentStampCount: cardState.membership.current_stamp_count,
      stampsRequired: loyaltyCard.stamps_required,
    })
    return {
      membershipId,
      merchantName,
      unlockedReward: null,
      alreadyStampedToday: false,
      qrValid: false,
      qrMissing: !qr,
      location: DEFAULT_LOCATION,
      fullWithoutReward: true,
    }
  }

  // Card progress so the stamp screen renders the live card grid; both the
  // already-stamped and ready-to-stamp states show it.
  const progress = await loadCardProgress(cardState)

  if (await isStampedToday(membershipId)) {
    return {
      membershipId,
      merchantName,
      unlockedReward: null,
      alreadyStampedToday: true,
      qrValid: false,
      qrMissing: !qr,
      qrId: qr,
      location: DEFAULT_LOCATION,
      ...progress,
    }
  }

  if (!qr) {
    return {
      membershipId,
      merchantName,
      unlockedReward: null,
      alreadyStampedToday: false,
      qrValid: false,
      qrMissing: true,
      location: DEFAULT_LOCATION,
    }
  }

  const qrContext = await getStampQrContextForMembership(membershipId, qr)

  if (!qrContext) {
    return {
      membershipId,
      merchantName,
      unlockedReward: null,
      alreadyStampedToday: false,
      qrValid: false,
      qrMissing: false,
      qrId: qr,
      location: DEFAULT_LOCATION,
    }
  }

  const location = await getMerchantStampLocationRequirement(
    cardState.merchant.id
  )

  return {
    membershipId,
    merchantName,
    unlockedReward: null,
    alreadyStampedToday: false,
    qrValid: true,
    qrMissing: false,
    qrId: qrContext.qrId ?? qr,
    location,
    ...progress,
  }
}

/** Card name, current/total stamps, dates, and today's label for the stamp UI. */
async function loadCardProgress(cardState: {
  membership: {
    id: string
    current_stamp_count: number
    active_cycle_number: number
  }
  loyaltyCard: { card_name: string; stamps_required: number } | null
}) {
  const todayLabel = formatStampDisplayDateFromIso(ukTodayIso())
  const loyaltyCard = cardState.loyaltyCard
  if (!loyaltyCard) {
    return { cardName: "", current: 0, total: 0, stampDates: [], todayLabel }
  }

  const total = loyaltyCard.stamps_required
  const stampDates = await getMembershipStampDisplayDates(
    cardState.membership.id,
    total,
    cardState.membership.active_cycle_number
  )
  const current = reconcileCardStampCount({
    membershipCount: cardState.membership.current_stamp_count,
    stampDateCount: stampDates.length,
    total,
  })

  return {
    cardName: loyaltyCard.card_name,
    current,
    total,
    stampDates: stampDates.slice(0, current),
    todayLabel,
  }
}

/** True when the membership already has an `earned` stamp for today's UK date. */
async function isStampedToday(membershipId: string): Promise<boolean> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("stamp_events")
    .select("earned_business_date")
    .eq("membership_id", membershipId)
    .eq("event_type", "earned")
    .order("earned_business_date", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to load latest stamp: ${error.message}`)
  }

  const latest =
    data && typeof data.earned_business_date === "string"
      ? data.earned_business_date
      : null

  return latest !== null && latest === ukTodayIso()
}

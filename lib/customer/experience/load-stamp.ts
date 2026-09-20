import "server-only"

import {
  getCustomerCardState,
  getMembershipStampDisplayDates,
  reconcileCardStampCount,
  stampDisplayLabelsForCount,
} from "@/lib/customer/card"
import { getStampQrContextForMembership } from "@/lib/customer/join"
import { legacyRewardBlocksStamps } from "@/lib/customer/legacy-reward-stamp-block"
import { getMembershipLocationRequirement } from "@/lib/customer/stamp"
import { formatStampDisplayDateFromIso } from "@/lib/customer/uk-calendar"
import { getVenueTradingDate } from "@/lib/customer/venue-trading-date"
import { customerLoginHref } from "@/lib/navigation/safe-next-path"
import { logger } from "@/lib/observability/logger"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

import type { StampContext } from "./derive"
import { loadProfileGate } from "./load-profile-gate"

const DEFAULT_LOCATION = { requireGeofence: false, geofenceRadiusMeters: 150 }

/**
 * Impure loader for the stamp route. Resolves card state, an unlocked reward,
 * whether the customer is already stamped for the venue trading day, and the
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

  const unlocked = cardState.stampCycleReward
  if (
    unlocked &&
    cardState.loyaltyCard &&
    legacyRewardBlocksStamps({
      reward: unlocked,
      currentStampCount: cardState.membership.current_stamp_count,
      stampsRequired: cardState.loyaltyCard.stamps_required,
    })
  ) {
    const redeemable = unlocked.collection_state === "ready"
    const unlockedReward = {
      rewardId: unlocked.id,
      membershipId,
      rewardName: unlocked.reward_name,
      rewardTerms: unlocked.reward_terms,
      redeemableFrom: unlocked.redeemable_from,
      availableFrom: unlocked.available_from,
      expiresAt: unlocked.expires_at,
      requiresAgeCheck: unlocked.requires_age_check,
      earningTerms: unlocked.earning_terms,
      inWindow: unlocked.in_window,
      windowEndsAt: unlocked.window_ends_at,
      upgradeRewardName: unlocked.upgrade_reward_name,
      nextWindowStartsAt: unlocked.next_window_starts_at,
      nextWindowEndsAt: unlocked.next_window_ends_at,
      nextWindowUpgradeName: unlocked.next_window_upgrade_name,
      redeemable,
    }

    // A reward that is not yet redeemable keeps the customer on the completed
    // card (full grid + reveal) with a tap-through to the reward, rather than an
    // instant swap to the waiting voucher. Load the card progress so that held
    // card can render. A ready reward instead surfaces its collection path now.
    if (!redeemable) {
      const tradingDate = await getVenueTradingDate(cardState.merchant.id)
      const progress = await loadCardProgress(cardState, tradingDate)
      return {
        membershipId,
        merchantName,
        unlockedReward,
        alreadyStampedToday: true,
        qrValid: false,
        qrMissing: !qr,
        qrId: qr,
        location: DEFAULT_LOCATION,
        ...progress,
      }
    }

    return {
      membershipId,
      merchantName,
      unlockedReward,
      alreadyStampedToday: false,
      qrValid: false,
      qrMissing: !qr,
      location: DEFAULT_LOCATION,
      profileGate: await loadProfileGate(),
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

  // Card progress, the same-day check and the QR match are independent reads
  // and go out together — the stamp screen is the first thing a member sees
  // after a physical scan, so every sequential await here is felt. Only the
  // location policy waits on the QR (see customer-stamp-contract). Progress is
  // loaded for every outcome, including the QR failures: the card is the
  // member's own and stays on screen whatever happened to the query string.
  //
  // The QR lookup starts now but is only *awaited* once it matters. A member
  // already stamped today gets their card whatever the QR did; a transient
  // read error in that lookup must not send them to the error boundary, so
  // the settled result is held and its error re-thrown only on the path that
  // actually needs the answer.
  const qrLookup = qr
    ? getStampQrContextForMembership(membershipId, qr).then(
        (value) => ({ ok: true as const, value }),
        (error: unknown) => ({ ok: false as const, error })
      )
    : Promise.resolve({ ok: true as const, value: null })
  const tradingDate = await getVenueTradingDate(cardState.merchant.id)
  const [progress, stampedToday] = await Promise.all([
    loadCardProgress(cardState, tradingDate),
    isStampedToday(membershipId, tradingDate),
  ])

  if (stampedToday) {
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
      ...progress,
    }
  }

  const qrResult = await qrLookup
  if (!qrResult.ok) throw qrResult.error
  const qrContext = qrResult.value

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
      ...progress,
    }
  }

  // Location requirements are loaded only after the QR is confirmed to belong to
  // the member (see customer-stamp-contract) — an intentional ordering, not a
  // waterfall to optimise away.
  const location = await getMembershipLocationRequirement(membershipId)

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
async function loadCardProgress(
  cardState: {
    membership: {
      id: string
      current_stamp_count: number
      active_cycle_number: number
    }
    loyaltyCard: { card_name: string; stamps_required: number } | null
  },
  tradingDate: string
) {
  const todayLabel = formatStampDisplayDateFromIso(tradingDate)
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
    total,
  })

  return {
    cardName: loyaltyCard.card_name,
    current,
    total,
    stampDates: stampDisplayLabelsForCount({
      labels: stampDates,
      count: current,
    }),
    todayLabel,
  }
}

/** True when the membership already has an `earned` stamp for today's UK date. */
async function isStampedToday(
  membershipId: string,
  tradingDate: string
): Promise<boolean> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("stamp_events")
    .select("earned_business_date")
    .eq("membership_id", membershipId)
    .eq("event_type", "earned")
    .not("earned_business_date", "is", null)
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

  return latest !== null && latest === tradingDate
}

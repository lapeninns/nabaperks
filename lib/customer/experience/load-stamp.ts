import "server-only"

import { getCustomerCardState } from "@/lib/customer/card"
import { getStampQrContextForMembership } from "@/lib/customer/join"
import { getMerchantStampLocationRequirement } from "@/lib/customer/stamp"
import { isRedeemableFrom, ukTodayIso } from "@/lib/customer/uk-date"
import { customerLoginHref } from "@/lib/navigation/safe-next-path"
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

  if (await isStampedToday(membershipId)) {
    return {
      membershipId,
      merchantName,
      unlockedReward: null,
      alreadyStampedToday: true,
      qrValid: false,
      qrMissing: !qr,
      location: DEFAULT_LOCATION,
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

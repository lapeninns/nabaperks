"use server"

import { revalidatePath } from "next/cache"

import {
  merchantActivitySummaryCacheTag,
  revalidateCacheTag,
} from "@/lib/cache/tags"
import { blockReasonCopy } from "@/lib/customer/experience/block-reasons"
import { getStampQrContextForMembership } from "@/lib/customer/join"
import { drainReferralBonusBankWithOutcome } from "@/lib/customer/referral-bonus-bank"
import {
  issueSelfServiceStamp,
  type GeoCoordinates,
} from "@/lib/customer/stamp"
import { enqueueStampTransitionNotifications } from "@/lib/notifications/events"
import type { SelfStampActionState } from "@/lib/customer/self-stamp-action-state"
import { logger } from "@/lib/observability/logger"

function fail(message: string): SelfStampActionState {
  return { status: "error", message }
}

export async function selfStampAction(
  _state: SelfStampActionState,
  formData: FormData
): Promise<SelfStampActionState> {
  const membershipId = value(formData, "membershipId")
  const qrId = value(formData, "qrId")

  if (!membershipId || !qrId) {
    return fail("Scan the venue code to add your stamp.")
  }

  const qrContext = await getStampQrContextForMembership(membershipId, qrId)

  if (!qrContext) {
    return fail("Scan the venue code to add your stamp.")
  }

  let result: Awaited<ReturnType<typeof issueSelfServiceStamp>>
  try {
    result = await issueSelfServiceStamp(membershipId, coordinates(formData))
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }
    logger.error("self_service_stamp_unexpected_error", {
      membershipId,
      error,
    })
    return fail(blockReasonCopy("unknown"))
  }

  if (result.status === "blocked") {
    return fail(result.reason)
  }

  let bonusStampsApplied = 0
  let bonusRewardUnlocked = false
  try {
    const bonusDrain = await drainReferralBonusBankWithOutcome(membershipId)
    bonusStampsApplied = bonusDrain.applied
    bonusRewardUnlocked = bonusDrain.rewardUnlocked
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }
    logger.warn("referral_bonus_bank_drain_failed", {
      membershipId,
      error,
    })
  }

  // Mark the card route stale so navigating away/back reflects the new stamp.
  // The customer stays on this screen; the UI confirms the stamp in place.
  revalidateCacheTag(merchantActivitySummaryCacheTag(qrContext.merchant.id))
  revalidatePath(`/card/${membershipId}`)
  revalidatePath("/home")

  try {
    const rewardUnlocked = result.rewardUnlocked || bonusRewardUnlocked
    await enqueueStampTransitionNotifications({
      membershipId,
      newStampCount: result.newStampCount + bonusStampsApplied,
      rewardUnlocked,
    })
  } catch (error) {
    logger.warn("push_stamp_transition_enqueue_failed", {
      membershipId,
      error,
    })
  }

  return {
    status: "issued",
    newStampCount: result.newStampCount + bonusStampsApplied,
    rewardUnlocked: result.rewardUnlocked || bonusRewardUnlocked,
    geoFlagged: result.geoFlagged,
    bonusStampsApplied,
  }
}

function coordinates(formData: FormData): GeoCoordinates | undefined {
  const qrId = value(formData, "qrId")
  const latitude = numberValue(formData, "latitude")
  const longitude = numberValue(formData, "longitude")
  const accuracyMeters = numberValue(formData, "accuracy_meters")
  const locationStatus = value(formData, "location_status")
  const captureElapsedMs = numberValue(formData, "capture_elapsed_ms")

  if (
    !qrId &&
    latitude === null &&
    longitude === null &&
    accuracyMeters === null &&
    !locationStatus &&
    captureElapsedMs === null
  ) {
    return undefined
  }

  return {
    qrId: qrId || null,
    latitude,
    longitude,
    accuracyMeters,
    locationStatus: locationStatus || null,
    captureElapsedMs,
  }
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  if (typeof raw !== "string") return ""

  return raw.trim()
}

function numberValue(formData: FormData, key: string) {
  const raw = value(formData, key)
  if (!raw) return null

  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

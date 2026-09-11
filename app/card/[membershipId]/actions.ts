"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import {
  merchantActivitySummaryCacheTag,
  revalidateCacheTag,
} from "@/lib/cache/tags"
import { blockReasonCopy } from "@/lib/customer/experience/block-reasons"
import {
  getCurrentCustomerId,
  getStampQrContextForMembership,
} from "@/lib/customer/join"
import {
  getJoinFirstStampRecovery,
  retryJoinFirstStampRecovery,
} from "@/lib/customer/join-first-stamp-recovery"
import { drainReferralBonusBankWithOutcome } from "@/lib/customer/referral-bonus-bank"
import {
  issueSelfServiceStamp,
  issueVenueCodeStamp,
  type GeoCoordinates,
  type IssueSelfServiceStampResult,
} from "@/lib/customer/stamp"
import { enqueueStampTransitionNotifications } from "@/lib/notifications/events"
import type {
  SelfStampActionState,
  SelfStampBlockedDetail,
} from "@/lib/customer/self-stamp-action-state"
import { logger } from "@/lib/observability/logger"
import {
  customerDeviceHashFromHeaders,
  customerRateLimitIdentityFromHeaders,
  enforceRateLimit,
  rateLimitIdentityFromHeaders,
  RateLimitError,
} from "@/lib/security/rate-limit"

const SELF_STAMP_ACTION_LIMIT = 10
const SELF_STAMP_ACTION_WINDOW_MS = 15 * 60 * 1000
const VENUE_CODE_LENGTH = 6
const SCAN_FIRST_COPY = "Scan the venue code to add your stamp."

type IssuedStamp = Extract<IssueSelfServiceStampResult, { status: "issued" }>

function fail(
  message: string,
  detail: SelfStampBlockedDetail = {}
): SelfStampActionState {
  return { status: "error", message, ...detail }
}

function unknownStamp(): SelfStampActionState {
  return { status: "unknown" }
}

export async function selfStampAction(
  _state: SelfStampActionState,
  formData: FormData
): Promise<SelfStampActionState> {
  try {
    await chargeSelfStampActionAttempt()
  } catch (error) {
    if (error instanceof RateLimitError) {
      return fail(blockReasonCopy("rate_limited"), { reason: "rate_limited" })
    }
    throw error
  }

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
    return unknownStamp()
  }

  if (result.status === "blocked") {
    return fail(result.reason, { reason: result.blockReason })
  }

  return completeIssuedStamp(membershipId, qrContext.merchant.id, result)
}

/**
 * The venue-code fallback. Same QR proof, same attempt throttle shape and the
 * same post-stamp side effects as {@link selfStampAction}; the only new input
 * is the six-digit code a team member read out, which the RPC verifies.
 */
export async function venueCodeStampAction(
  _state: SelfStampActionState,
  formData: FormData
): Promise<SelfStampActionState> {
  try {
    await chargeVenueCodeActionAttempt()
  } catch (error) {
    if (error instanceof RateLimitError) {
      return fail(blockReasonCopy("rate_limited"), { reason: "rate_limited" })
    }
    throw error
  }

  const membershipId = value(formData, "membershipId")
  const qrId = value(formData, "qrId")
  const code = value(formData, "code").replace(/\s+/g, "")

  if (!membershipId || !qrId) {
    return fail(SCAN_FIRST_COPY)
  }

  if (!new RegExp(`^[0-9]{${VENUE_CODE_LENGTH}}$`).test(code)) {
    return fail(blockReasonCopy("venue_code_format"), {
      reason: "venue_code_format",
    })
  }

  const qrContext = await getStampQrContextForMembership(membershipId, qrId)

  if (!qrContext) {
    return fail(SCAN_FIRST_COPY)
  }

  const requestHeaders = await headers()
  let result: Awaited<ReturnType<typeof issueVenueCodeStamp>>
  try {
    result = await issueVenueCodeStamp({
      membershipId,
      qrId,
      code,
      deviceHash: customerDeviceHashFromHeaders(requestHeaders),
      networkHash: rateLimitIdentityFromHeaders(requestHeaders),
    })
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }
    logger.error("venue_code_stamp_unexpected_error", {
      membershipId,
      error,
    })
    return unknownStamp()
  }

  if (result.status === "blocked") {
    return fail(result.reason, { reason: result.blockReason })
  }

  if (result.status === "code_rejected") {
    return fail(blockReasonCopy("venue_code_rejected"), {
      reason: "venue_code_rejected",
      attemptsRemaining: result.attemptsRemaining,
    })
  }

  if (result.status === "locked_out") {
    return fail(blockReasonCopy("venue_code_locked"), {
      reason: "venue_code_locked",
      lockedUntil: result.lockedUntil ?? undefined,
    })
  }

  return completeIssuedStamp(membershipId, qrContext.merchant.id, result)
}

/**
 * Everything that happens once a stamp has landed: settle banked referral
 * bonuses, mark the card and home routes stale, and queue the push
 * transition. Shared by the GPS path and the venue-code path so the two can
 * never drift. The customer stays on the stamp screen; the UI confirms the
 * stamp in place.
 */
async function completeIssuedStamp(
  membershipId: string,
  merchantId: string,
  result: IssuedStamp
): Promise<SelfStampActionState> {
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
  revalidateCacheTag(merchantActivitySummaryCacheTag(merchantId))
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
    ...(result.verification ? { verification: result.verification } : {}),
  }
}

type ActionBucketKeys = {
  readonly request: (requestIdentity: string) => string
  readonly customer: (customerId: string) => string
}

/** The GPS stamp's app-layer throttle. */
async function chargeSelfStampActionAttempt(): Promise<void> {
  await chargeActionAttempt({
    request: (requestIdentity) => `selfstamp-action:request:${requestIdentity}`,
    customer: (customerId) => `selfstamp-action:customer:${customerId}`,
  })
}

/** The venue-code stamp's app-layer throttle — its own buckets, so one path cannot starve the other. */
async function chargeVenueCodeActionAttempt(): Promise<void> {
  await chargeActionAttempt({
    request: (requestIdentity) => `venuecode-action:request:${requestIdentity}`,
    customer: (customerId) => `venuecode-action:customer:${customerId}`,
  })
}

/**
 * Two app-layer buckets — one per request identity, one per signed-in
 * customer — charged before any database work, in addition to the RPC's own
 * committed-first throttle.
 */
async function chargeActionAttempt(keys: ActionBucketKeys): Promise<void> {
  const requestIdentity = customerRateLimitIdentityFromHeaders(await headers())
  await enforceRateLimit({
    key: keys.request(requestIdentity),
    limit: SELF_STAMP_ACTION_LIMIT,
    windowMs: SELF_STAMP_ACTION_WINDOW_MS,
  })

  const customerId = await getCurrentCustomerId()
  if (!customerId) return

  await enforceRateLimit({
    key: keys.customer(customerId),
    limit: SELF_STAMP_ACTION_LIMIT,
    windowMs: SELF_STAMP_ACTION_WINDOW_MS,
  })
}

export async function retryJoinFirstStampAction(
  formData: FormData
): Promise<void> {
  const membershipId = value(formData, "membershipId")
  if (!membershipId) redirect("/home")

  const recovery = await getJoinFirstStampRecovery(membershipId)

  let outcome: Awaited<ReturnType<typeof retryJoinFirstStampRecovery>>
  try {
    outcome = await retryJoinFirstStampRecovery(membershipId)
  } catch (error) {
    if (!(error instanceof Error)) throw error
    logger.error("join_first_stamp_retry_failed", { membershipId, error })
    revalidatePath(`/card/${membershipId}`)
    redirect(`/card/${membershipId}`)
  }

  revalidatePath(`/card/${membershipId}`)
  revalidatePath("/home")
  if (recovery) {
    revalidateCacheTag(merchantActivitySummaryCacheTag(recovery.merchantId))
  }
  if (outcome === "issued" || outcome === "already_issued") {
    redirect(`/card/${membershipId}?stamp=issued`)
  }
  redirect(`/card/${membershipId}`)
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

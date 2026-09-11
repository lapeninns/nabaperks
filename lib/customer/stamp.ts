import "server-only"

import { recordProductEvent } from "@/lib/analytics/events"
import {
  blockReasonCopy,
  stampBlockReasonFromSqlState,
  toStampBlockReason,
  type CustomerBlockReason,
} from "@/lib/customer/experience/block-reasons"
import { getCurrentCustomer } from "@/lib/customer/identity"
import { logger } from "@/lib/observability/logger"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type GeoCoordinates = {
  readonly qrId?: string | null
  readonly latitude?: number | null
  readonly longitude?: number | null
  readonly accuracyMeters?: number | null
  readonly locationStatus?: string | null
  readonly captureElapsedMs?: number | null
}

export type IssueSelfServiceStampResult =
  | {
      status: "issued"
      stampEventId: string
      newStampCount: number
      rewardUnlocked: boolean
      geoFlagged: boolean
    }
  | { status: "blocked"; reason: string; blockReason: CustomerBlockReason }

type IssuedStampResult = Extract<
  IssueSelfServiceStampResult,
  { status: "issued" }
>

type BlockedStampResult = Extract<
  IssueSelfServiceStampResult,
  { status: "blocked" }
>

export type VenueCodeStampInput = {
  readonly membershipId: string
  readonly qrId: string
  readonly code: string
  /** sha256 of the proxy-minted device cookie, or null when absent. */
  readonly deviceHash: string | null
  /** Hashed verified client IP, or null locally (no x-vercel-forwarded-for). */
  readonly networkHash: string | null
}

export type IssueVenueCodeStampResult =
  | IssuedStampResult
  | BlockedStampResult
  | { status: "code_rejected"; attemptsRemaining: number }
  | { status: "locked_out"; lockedUntil: string | null }

type IssueStampRpcParams = {
  readonly p_membership_id: string
  readonly p_customer_id: string
  readonly p_qr_id: string | null
  readonly p_latitude: number | null
  readonly p_longitude: number | null
  readonly p_accuracy_meters: number | null
  readonly p_location_status: string | null
  readonly p_capture_elapsed_ms: number | null
  readonly p_referral_bonuses_pre_drained: number
}

export type LocationRequirement = {
  requireGeofence: boolean
  geofenceRadiusMeters: number
  firstVerifiedVisit: number
  nextVisitNumber: number
  /**
   * How many more unverified-location stamps the server will still commit for
   * this membership before refusing with NBS11 (`location_required`). Only a
   * membership-scoped read knows this; venue-level reads leave it undefined.
   */
  unverifiedGraceRemaining?: number
}

export async function issueSelfServiceStamp(
  membershipId: string,
  coordinates?: GeoCoordinates
): Promise<IssueSelfServiceStampResult> {
  const customer = await getCurrentCustomer()
  if (!customer) return notSignedIn()

  const supabase = createSupabaseServiceRoleClient()
  const { error: attemptError } = await supabase.rpc(
    "consume_self_service_stamp_attempt",
    {
      p_membership_id: membershipId,
      p_customer_id: customer.id,
    }
  )

  if (attemptError) {
    return blockKnownStampFailure(
      attemptError.message,
      membershipId,
      attemptError.code
    )
  }

  const referralBonusesPreDrained = await drainReferralBonusesBeforeStamp(
    supabase,
    membershipId,
    customer.id
  )
  const { data, error } = await supabase.rpc(
    "issue_self_service_stamp",
    buildIssueStampRpcParams(
      membershipId,
      customer.id,
      coordinates,
      referralBonusesPreDrained
    )
  )

  if (error) {
    const blocked = blockKnownStampFailure(
      error.message,
      membershipId,
      error.code
    )
    await recordLocationRefusal(supabase, membershipId, customer.id, error.code)
    return blocked
  }

  const row = firstRecord(data)

  // A separately settled referral bonus can fill the card before the visit stamp
  // is reached. The RPC returns no stamp id so the customer sees the waiting
  // reward without the scan being counted as a location-verified visit.
  if (filledByReferralBonus(row)) return rewardReadyFirst()

  const issuedStamp = issuedStampResult(row)
  if (!issuedStamp) throw new Error("Unable to issue a stamp")

  return issuedStamp
}

/**
 * The venue-code fallback: a customer whose location check was refused types
 * the six-digit code a team member read out, and the stamp is issued through
 * the same QR transaction with only the location gate bypassed.
 *
 * Mirrors {@link issueSelfServiceStamp} step for step — a committed-first
 * attempt charge, the referral settle-before-stamp, then the RPC — with two
 * deliberate differences: a wrong code comes back as a status, never an error,
 * so the lockout ledger the RPC wrote is honoured; and no location refusal is
 * recorded here, because a refused code is not a location refusal.
 */
export async function issueVenueCodeStamp(
  input: VenueCodeStampInput
): Promise<IssueVenueCodeStampResult> {
  const customer = await getCurrentCustomer()
  if (!customer) return notSignedIn()

  const supabase = createSupabaseServiceRoleClient()
  const { error: attemptError } = await supabase.rpc(
    "consume_venue_code_attempt",
    {
      p_membership_id: input.membershipId,
      p_customer_id: customer.id,
      p_device_hash: input.deviceHash,
      p_network_hash: input.networkHash,
    }
  )

  if (attemptError) {
    return blockKnownStampFailure(
      attemptError.message,
      input.membershipId,
      attemptError.code
    )
  }

  const referralBonusesPreDrained = await drainReferralBonusesBeforeStamp(
    supabase,
    input.membershipId,
    customer.id
  )
  const { data, error } = await supabase.rpc("issue_venue_code_stamp", {
    p_membership_id: input.membershipId,
    p_customer_id: customer.id,
    p_qr_id: input.qrId,
    p_code: input.code,
    p_device_hash: input.deviceHash,
    p_referral_bonuses_pre_drained: referralBonusesPreDrained,
  })

  if (error) {
    return blockKnownStampFailure(error.message, input.membershipId, error.code)
  }

  const row = firstRecord(data)
  const status = row ? stringValue(row.status) : ""

  if (status === "code_rejected") {
    return {
      status,
      attemptsRemaining: (row && numberValue(row.attempts_remaining)) ?? 0,
    }
  }
  if (status === "locked_out") {
    return {
      status,
      lockedUntil: (row && stringValue(row.locked_until)) || null,
    }
  }

  if (filledByReferralBonus(row)) return rewardReadyFirst()

  const issuedStamp = issuedStampResult(row)
  if (!issuedStamp) throw new Error("Unable to issue a venue-code stamp")

  return issuedStamp
}

function notSignedIn(): BlockedStampResult {
  return {
    status: "blocked",
    reason: "Open your cards first.",
    blockReason: "unauthenticated",
  }
}

function rewardReadyFirst(): BlockedStampResult {
  return {
    status: "blocked",
    reason: blockReasonCopy("reward_ready_first"),
    blockReason: "reward_ready_first",
  }
}

/**
 * A separately settled referral bonus can fill the card before the visit
 * stamp is reached. The RPC then returns no stamp id, so the customer sees the
 * waiting reward without the scan being counted as a location-verified visit.
 */
function filledByReferralBonus(row: Record<string, unknown> | null): boolean {
  return (
    row !== null &&
    !stringValue(row.stamp_event_id) &&
    booleanValue(row.reward_unlocked)
  )
}

function buildIssueStampRpcParams(
  membershipId: string,
  customerId: string,
  coordinates: GeoCoordinates | undefined,
  referralBonusesPreDrained: number
): IssueStampRpcParams {
  return {
    p_membership_id: membershipId,
    p_customer_id: customerId,
    p_qr_id: coordinates?.qrId ?? null,
    p_latitude: coordinates?.latitude ?? null,
    p_longitude: coordinates?.longitude ?? null,
    p_accuracy_meters: coordinates?.accuracyMeters ?? null,
    p_location_status: coordinates?.locationStatus ?? null,
    p_capture_elapsed_ms: coordinates?.captureElapsedMs ?? null,
    p_referral_bonuses_pre_drained: referralBonusesPreDrained,
  }
}

async function drainReferralBonusesBeforeStamp(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  membershipId: string,
  customerId: string
): Promise<number> {
  const { data, error } = await supabase.rpc(
    "drain_due_referrer_bonuses_for_membership",
    { p_referrer_membership_id: membershipId }
  )

  if (!error) return numberValue(data) ?? 0

  try {
    await recordProductEvent({
      eventName: "referral_settlement_failed",
      customerId,
      membershipId,
      actorType: "system",
      actorId: "system",
      metadata: {
        outcome: "failed",
        stage: "settle_before_stamp",
        sqlstate: error.code ?? "unknown",
        error: error.message.slice(0, 500),
      },
    })
  } catch (cause) {
    logger.warn("referral_settlement_failure_record_failed", {
      membershipId,
      reason: cause instanceof Error ? cause.message : "unknown",
    })
  }

  logger.warn("referral_settlement_before_stamp_failed", {
    membershipId,
    sqlstate: error.code ?? "unknown",
  })
  return 0
}

/**
 * Persist a location refusal, which the RPC itself cannot do.
 *
 * NBS10/NBS11 are raised, and a raise aborts the transaction — so a fraud flag
 * written inside `issue_self_service_stamp` is rolled back with the refusal it
 * describes. Recording from here works because the failed RPC has already ended
 * its transaction and this is a new one.
 *
 * Best-effort by design: the customer has already been told why their stamp did
 * not land, and losing the signal must never turn into a second error on that
 * screen.
 */
async function recordLocationRefusal(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  membershipId: string,
  customerId: string,
  code: string | null | undefined
): Promise<void> {
  const reason = stampBlockReasonFromSqlState(code)
  if (reason !== "location_out_of_range" && reason !== "location_required")
    return

  try {
    const { error } = await supabase.rpc("record_stamp_location_refusal", {
      p_membership_id: membershipId,
      p_customer_id: customerId,
      p_reason: reason,
    })
    if (error) throw new Error(error.message)
  } catch (cause) {
    logger.warn("stamp_location_refusal_record_failed", {
      membershipId,
      reason: cause instanceof Error ? cause.message : "unknown",
    })
  }
}

function blockKnownStampFailure(
  rpcMessage: string,
  membershipId: string,
  rpcCode?: string | null
): IssueSelfServiceStampResult {
  // The SQLSTATE is authoritative; the message is only consulted for refusals
  // that do not carry one yet (see block-reasons.ts).
  const reason = toStampBlockReason(rpcMessage, rpcCode)

  if (reason === "unknown") {
    throw new Error(`Unable to issue a stamp: ${rpcMessage}`)
  }

  // A misconfigured reward pool blocks the final stamp; the customer gets
  // calm copy while operators get a diagnosable signal in the logs/audit.
  if (reason === "pool_unavailable") {
    logger.warn("self_service_stamp_pool_unavailable", {
      membershipId,
      rpcMessage,
    })
  }

  return {
    status: "blocked",
    reason: blockReasonCopy(reason),
    blockReason: reason,
  }
}

function issuedStampResult(
  row: Record<string, unknown> | null
): IssuedStampResult | null {
  if (!row) return null

  const stampEventId = stringValue(row.stamp_event_id)
  const newStampCount = numberValue(row.new_stamp_count)

  if (!stampEventId || newStampCount === null) return null

  return {
    status: "issued",
    stampEventId,
    newStampCount,
    rewardUnlocked: booleanValue(row.reward_unlocked),
    geoFlagged: booleanValue(row.geo_flagged),
  }
}

export async function getMembershipLocationRequirement(
  membershipId: string
): Promise<LocationRequirement> {
  const customer = await getCurrentCustomer()

  if (!customer) return defaultLocationRequirement()

  const supabase = createSupabaseServiceRoleClient()
  const { data: membership, error: membershipError } = await supabase
    .from("customer_memberships")
    .select("merchant_id, customer_id")
    .eq("id", membershipId)
    .maybeSingle()

  if (membershipError) {
    throw new Error(
      `Unable to load membership location: ${membershipError.message}`
    )
  }

  if (!isRecord(membership)) return defaultLocationRequirement()

  if (stringValue(membership.customer_id) !== customer.id) {
    return defaultLocationRequirement()
  }

  const merchantId = stringValue(membership.merchant_id)
  if (!merchantId) return defaultLocationRequirement()

  const { count, error: visitCountError } = await supabase
    .from("stamp_events")
    .select("id", { count: "exact", head: true })
    .eq("membership_id", membershipId)
    .eq("event_type", "earned")
    .eq("metadata->>source", "self_service_qr")

  if (visitCountError) {
    throw new Error(
      `Unable to load membership visits: ${visitCountError.message}`
    )
  }

  const requirement = await getMerchantStampLocationRequirement(merchantId)
  const nextVisitNumber = (count ?? 0) + 1

  // The grace count is only worth a round trip once a stamp could be asked to
  // verify location. Before that the client never captures GPS at all.
  if (
    !requirement.requireGeofence ||
    nextVisitNumber < requirement.firstVerifiedVisit
  ) {
    return { ...requirement, nextVisitNumber }
  }

  return {
    ...requirement,
    nextVisitNumber,
    unverifiedGraceRemaining: await getUnverifiedGraceRemaining(
      supabase,
      membershipId
    ),
  }
}

/**
 * How many unverified-location stamps the membership can still commit. Mirrors
 * the check in `private.issue_visit_stamp`: committed `unverified` stamps
 * against `public.geofence_unverified_grace_limit()`. The client uses it to
 * decide whether a capture without a fix is worth submitting at all.
 */
async function getUnverifiedGraceRemaining(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  membershipId: string
): Promise<number> {
  const [{ data: limitData, error: limitError }, { count, error: usedError }] =
    await Promise.all([
      supabase.rpc("geofence_unverified_grace_limit"),
      supabase
        .from("stamp_events")
        .select("id", { count: "exact", head: true })
        .eq("membership_id", membershipId)
        .eq("event_type", "earned")
        .eq("metadata->>geo_verification", "unverified"),
    ])

  if (limitError) {
    throw new Error(
      `Unable to load unverified grace limit: ${limitError.message}`
    )
  }
  if (usedError) {
    throw new Error(
      `Unable to load unverified stamp count: ${usedError.message}`
    )
  }

  const limit = numberValue(limitData)
  if (limit === null) {
    throw new Error("Unable to load unverified grace limit: empty result")
  }

  return Math.max(Math.trunc(limit) - (count ?? 0), 0)
}

/**
 * Location gate for a merchant's active loyalty card, resolved without a
 * membership. Join flows use the venue policy; returning-member stamp flows add
 * the membership's next lifetime visit number separately.
 */
export async function getMerchantStampLocationRequirement(
  merchantId: string
): Promise<LocationRequirement> {
  const supabase = createSupabaseServiceRoleClient()
  const { data: card, error: cardError } = await supabase
    .from("loyalty_cards")
    .select("location_id")
    .eq("merchant_id", merchantId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (cardError) {
    throw new Error(`Unable to load card location: ${cardError.message}`)
  }

  if (!isRecord(card)) return defaultLocationRequirement()

  const locationId = stringValue(card.location_id)
  if (!locationId) return defaultLocationRequirement()

  return getLocationRequirement(locationId)
}

export async function getLocationRequirement(
  locationId: string | null | undefined
): Promise<LocationRequirement> {
  if (!locationId) return defaultLocationRequirement()

  const supabase = createSupabaseServiceRoleClient()
  const { data: location, error } = await supabase
    .from("merchant_locations")
    .select(
      "require_geofence, geofence_radius_meters, soft_geofence_trigger_stamp_number"
    )
    .eq("id", locationId)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to load venue location: ${error.message}`)
  }

  if (!isRecord(location)) return defaultLocationRequirement()

  return {
    requireGeofence: booleanValue(location.require_geofence),
    geofenceRadiusMeters: numberValue(location.geofence_radius_meters) ?? 150,
    firstVerifiedVisit: Math.max(
      numberValue(location.soft_geofence_trigger_stamp_number) ?? 3,
      1
    ),
    nextVisitNumber: 1,
  }
}

function defaultLocationRequirement(): LocationRequirement {
  return {
    requireGeofence: false,
    geofenceRadiusMeters: 150,
    firstVerifiedVisit: 3,
    nextVisitNumber: 1,
  }
}

function firstRecord(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) {
    return isRecord(data[0]) ? data[0] : null
  }

  return isRecord(data) ? data : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : null
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function booleanValue(value: unknown) {
  return value === true
}

import "server-only"

import { recordProductEvent } from "@/lib/analytics/events"
import {
  blockReasonCopy,
  stampBlockReasonFromSqlState,
  toStampBlockReason,
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
  | { status: "blocked"; reason: string }

type IssuedStampResult = Extract<
  IssueSelfServiceStampResult,
  { status: "issued" }
>

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
}

export async function issueSelfServiceStamp(
  membershipId: string,
  coordinates?: GeoCoordinates
): Promise<IssueSelfServiceStampResult> {
  const customer = await getCurrentCustomer()
  if (!customer) return { status: "blocked", reason: "Open your cards first." }

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
  if (
    row &&
    !stringValue(row.stamp_event_id) &&
    booleanValue(row.reward_unlocked)
  ) {
    return { status: "blocked", reason: blockReasonCopy("reward_ready_first") }
  }

  const issuedStamp = issuedStampResult(row)
  if (!issuedStamp) throw new Error("Unable to issue a stamp")

  return issuedStamp
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

  return { status: "blocked", reason: blockReasonCopy(reason) }
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
  return { ...requirement, nextVisitNumber: (count ?? 0) + 1 }
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

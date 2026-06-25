import "server-only"

import {
  blockReasonCopy,
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
}

export type LocationRequirement = {
  requireGeofence: boolean
  geofenceRadiusMeters: number
}

export async function issueSelfServiceStamp(
  membershipId: string,
  coordinates?: GeoCoordinates
): Promise<IssueSelfServiceStampResult> {
  const customer = await getCurrentCustomer()
  if (!customer) return { status: "blocked", reason: "Open your cards first." }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc(
    "issue_self_service_stamp",
    buildIssueStampRpcParams(membershipId, customer.id, coordinates)
  )

  if (error) {
    return blockKnownStampFailure(error.message, membershipId)
  }

  const issuedStamp = issuedStampResult(firstRecord(data))
  if (!issuedStamp) throw new Error("Unable to issue a stamp")

  return issuedStamp
}

function buildIssueStampRpcParams(
  membershipId: string,
  customerId: string,
  coordinates: GeoCoordinates | undefined
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
  }
}

function blockKnownStampFailure(
  rpcMessage: string,
  membershipId: string
): IssueSelfServiceStampResult {
  const reason = toStampBlockReason(rpcMessage)

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

  return getMerchantStampLocationRequirement(merchantId)
}

/**
 * Location gate for a merchant's active loyalty card, resolved without a
 * membership. Returning QR visits use this to decide whether the next existing
 * member stamp should land on the stamp screen for the cycle-stamp-3 soft
 * location attempt.
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
    .select("require_geofence, geofence_radius_meters")
    .eq("id", locationId)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to load venue location: ${error.message}`)
  }

  if (!isRecord(location)) return defaultLocationRequirement()

  return {
    requireGeofence: booleanValue(location.require_geofence),
    geofenceRadiusMeters: numberValue(location.geofence_radius_meters) ?? 150,
  }
}

function defaultLocationRequirement(): LocationRequirement {
  return {
    requireGeofence: false,
    geofenceRadiusMeters: 150,
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

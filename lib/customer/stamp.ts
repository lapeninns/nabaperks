import "server-only"

import {
  blockReasonCopy,
  toStampBlockReason,
} from "@/lib/customer/experience/block-reasons"
import { getCurrentCustomer } from "@/lib/customer/identity"
import { logger } from "@/lib/observability/logger"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type GeoCoordinates = {
  readonly latitude: number
  readonly longitude: number
}

export type StampLocationStatus =
  | "skipped"
  | "available"
  | "denied"
  | "denied_remembered"
  | "timeout"
  | "unsupported"
  | "unavailable"

export type StampLocationEvidence = {
  readonly latitude?: number | null
  readonly longitude?: number | null
  readonly accuracyMeters?: number | null
  readonly locationStatus?: StampLocationStatus | null
  readonly captureElapsedMs?: number | null
}

type IssueStampRpcParams = {
  readonly p_membership_id: string
  readonly p_customer_id: string
  readonly p_latitude: number | null
  readonly p_longitude: number | null
  p_accuracy_meters?: number | null
  p_location_status?: StampLocationStatus | null
  p_capture_elapsed_ms?: number | null
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

export type LocationRequirement = {
  requireGeofence: boolean
  geofenceRadiusMeters: number
}

export async function issueSelfServiceStamp(
  membershipId: string,
  location?: StampLocationEvidence
): Promise<IssueSelfServiceStampResult> {
  const customer = await getCurrentCustomer()
  if (!customer) return { status: "blocked", reason: "Open your cards first." }

  const supabase = createSupabaseServiceRoleClient()
  const rpcParams: IssueStampRpcParams = {
    p_membership_id: membershipId,
    p_customer_id: customer.id,
    p_latitude: location?.latitude ?? null,
    p_longitude: location?.longitude ?? null,
  }

  if (hasDetailedLocationEvidence(location)) {
    rpcParams.p_accuracy_meters = location?.accuracyMeters ?? null
    rpcParams.p_location_status = location?.locationStatus ?? null
    rpcParams.p_capture_elapsed_ms = location?.captureElapsedMs ?? null
  }

  const { data, error } = await supabase.rpc(
    "issue_self_service_stamp",
    rpcParams
  )

  if (error) {
    const reason = toStampBlockReason(error.message)

    if (reason !== "unknown") {
      // A misconfigured reward pool blocks the final stamp; the customer gets
      // calm copy while operators get a diagnosable signal in the logs/audit.
      if (reason === "pool_unavailable") {
        logger.warn("self_service_stamp_pool_unavailable", {
          membershipId,
          rpcMessage: error.message,
        })
      }
      return { status: "blocked", reason: blockReasonCopy(reason) }
    }

    throw new Error(`Unable to issue a stamp: ${error.message}`)
  }

  const row = firstRecord(data)

  if (!row) {
    throw new Error("Unable to issue a stamp")
  }

  const stampEventId = stringValue(row.stamp_event_id)
  const newStampCount = numberValue(row.new_stamp_count)

  if (!stampEventId || newStampCount === null) {
    throw new Error("Unable to issue a stamp")
  }

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
 * membership. The join flow needs this to capture geolocation on the final
 * onboarding step before the first stamp is issued.
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

export async function getRewardLocationRequirement(
  rewardId: string
): Promise<LocationRequirement> {
  const customer = await getCurrentCustomer()

  if (!customer) return defaultLocationRequirement()

  const supabase = createSupabaseServiceRoleClient()
  const { data: reward, error: rewardError } = await supabase
    .from("reward_events")
    .select("loyalty_card_id, customer_id")
    .eq("id", rewardId)
    .maybeSingle()

  if (rewardError) {
    throw new Error(`Unable to load reward location: ${rewardError.message}`)
  }

  if (!isRecord(reward)) return defaultLocationRequirement()

  if (stringValue(reward.customer_id) !== customer.id) {
    return defaultLocationRequirement()
  }

  const loyaltyCardId = stringValue(reward.loyalty_card_id)
  if (!loyaltyCardId) return defaultLocationRequirement()

  const { data: card, error: cardError } = await supabase
    .from("loyalty_cards")
    .select("location_id")
    .eq("id", loyaltyCardId)
    .maybeSingle()

  if (cardError) {
    throw new Error(`Unable to load reward card location: ${cardError.message}`)
  }

  if (!isRecord(card)) return defaultLocationRequirement()

  const locationId = stringValue(card.location_id)
  if (!locationId) return defaultLocationRequirement()

  return getLocationRequirement(locationId)
}

async function getLocationRequirement(
  locationId: string
): Promise<LocationRequirement> {
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

function hasDetailedLocationEvidence(
  location: StampLocationEvidence | undefined
) {
  return (
    location?.accuracyMeters !== undefined ||
    location?.locationStatus !== undefined ||
    location?.captureElapsedMs !== undefined
  )
}

function booleanValue(value: unknown) {
  return value === true
}

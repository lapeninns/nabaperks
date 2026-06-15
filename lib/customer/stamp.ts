import "server-only"

import { blockReasonCopy } from "@/lib/customer/experience/block-reasons"
import { getCurrentCustomer } from "@/lib/customer/identity"
import { profileCompletionFrom } from "@/lib/customer/profile"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type GeoCoordinates = {
  latitude: number
  longitude: number
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

export type RedeemSelfServiceRewardResult =
  | {
      status: "redeemed"
      rewardId: string
      rewardName: string
      membershipId: string
      newStampCount: number
    }
  | { status: "blocked"; reason: string }

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
  const { data, error } = await supabase.rpc("issue_self_service_stamp", {
    p_membership_id: membershipId,
    p_customer_id: customer.id,
    p_latitude: coordinates?.latitude ?? null,
    p_longitude: coordinates?.longitude ?? null,
  })

  if (error) {
    const reason = blockedReason(error.message)

    if (reason) return { status: "blocked", reason }

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

export async function redeemSelfServiceReward(
  rewardId: string,
  coordinates?: GeoCoordinates
): Promise<RedeemSelfServiceRewardResult> {
  const customer = await getCurrentCustomer()
  if (!customer) return { status: "blocked", reason: "Open your cards first." }

  // Profile gate (also enforced in the RPC) — block before the write so an
  // incomplete profile never reaches redemption, even if the UI is bypassed.
  if (!profileCompletionFrom(customer).complete) {
    return { status: "blocked", reason: blockReasonCopy("profile_incomplete") }
  }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("redeem_self_service_reward", {
    p_reward_event_id: rewardId,
    p_customer_id: customer.id,
    p_latitude: coordinates?.latitude ?? null,
    p_longitude: coordinates?.longitude ?? null,
  })

  if (error) {
    const reason = blockedReason(error.message)

    if (reason) return { status: "blocked", reason }

    throw new Error(`Unable to redeem reward: ${error.message}`)
  }

  const row = firstRecord(data)

  if (!row) {
    throw new Error("Unable to redeem reward")
  }

  const rewardEventId = stringValue(row.reward_event_id)
  const rewardName = stringValue(row.reward_name)
  const membershipId = stringValue(row.membership_id)
  const newStampCount = numberValue(row.new_stamp_count)

  if (
    !rewardEventId ||
    !rewardName ||
    !membershipId ||
    newStampCount === null
  ) {
    throw new Error("Unable to redeem reward")
  }

  return {
    status: "redeemed",
    rewardId: rewardEventId,
    rewardName,
    membershipId,
    newStampCount,
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

function blockedReason(message: string) {
  if (message.includes("Stamp already issued for this UK business day")) {
    return "You're already stamped today. Come back tomorrow."
  }

  if (message.includes("A reward is already ready to redeem")) {
    return "Your reward is ready - redeem it before collecting more stamps."
  }

  if (message.includes("Reward already redeemed")) {
    return "This reward has already been redeemed."
  }

  if (message.includes("not redeemable until the next UK business day")) {
    return "Give it a day to breathe - redeemable from the next UK business day."
  }

  if (message.includes("Reward is not redeemable")) {
    return "This reward is not redeemable."
  }

  if (message.includes("not active") || message.includes("unavailable")) {
    return "This loyalty programme is unavailable right now."
  }

  if (message.includes("Authentication required")) {
    return "Verify your identity from the venue QR before continuing."
  }

  if (message.includes("Complete your profile")) {
    return blockReasonCopy("profile_incomplete")
  }

  return null
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

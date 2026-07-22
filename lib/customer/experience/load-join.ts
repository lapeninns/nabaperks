import "server-only"

import { headers } from "next/headers"

import { getCurrentCustomer } from "@/lib/customer/identity"
import {
  getExistingMembershipForCurrentUser,
  getMerchantJoinContext,
} from "@/lib/customer/join"
import { getPendingPhoneVerification } from "@/lib/customer/session"
import { getMerchantStampLocationRequirement } from "@/lib/customer/stamp"
import { customerRateLimitIdentityFromHeaders } from "@/lib/security/rate-limit"
import { logger } from "@/lib/observability/logger"
import {
  normalizeRequestId,
  REQUEST_ID_HEADER,
} from "@/lib/observability/request-id"

import type { JoinContext } from "./derive"

type JoinSearchParams = {
  qr?: string
  step?: string
}

/**
 * Impure loader for the join route. Resolves merchant availability, the current
 * session, an existing membership, and a pending OTP — then hands pure facts to
 * {@link deriveCustomerExperience}. The pending-OTP lookup is skipped once a
 * session exists (a verified customer is already past that step), and an explicit
 * `step=phone` always returns the customer to the phone form.
 */
export async function loadJoinExperienceContext(
  merchantSlug: string,
  searchParams: JoinSearchParams
): Promise<JoinContext> {
  let context: Awaited<ReturnType<typeof getMerchantJoinContext>>
  const requestHeaders = await headers()

  try {
    context = await getMerchantJoinContext(
      merchantSlug,
      searchParams.qr,
      customerRateLimitIdentityFromHeaders(requestHeaders)
    )
  } catch (error) {
    if (!(error instanceof Error)) throw error
    logger.error("customer_join_context_failed", {
      requestId:
        normalizeRequestId(requestHeaders.get(REQUEST_ID_HEADER)) ??
        "unavailable",
      operation: "join_context_load",
      reason: "database_unavailable",
    })
    return { unavailable: true }
  }

  if (!context?.available) {
    return { unavailable: true }
  }

  const merchant = {
    name: context.merchant.business_name,
    slug: merchantSlug,
    termsUrl: `/merchant/${merchantSlug}/terms`,
  }
  const card = {
    name: context.loyaltyCard.card_name,
    stampsRequired: context.loyaltyCard.stamps_required,
    rewardTerms: context.loyaltyCard.reward_terms,
  }
  // Geofence gate is only consumed by the final terms step (the only screen that
  // can issue the first stamp), so default it cheaply and resolve the real value
  // only on that branch.
  const baseLocation = { requireGeofence: false, geofenceRadiusMeters: 150 }
  const base = {
    merchantId: context.merchant.id,
    qrCodeId: "qrCodeId" in context ? context.qrCodeId : undefined,
    merchant,
    card,
    qrId: searchParams.qr,
    step: searchParams.step,
    location: baseLocation,
  }

  const customer = await getCurrentCustomer()
  const membership = customer
    ? await getExistingMembershipForCurrentUser(context.merchant.id)
    : null

  if (membership) {
    return {
      ...base,
      hasSession: true,
      pendingOtp: false,
      membership: {
        id: membership.id,
        current: membership.current_stamp_count,
      },
    }
  }

  if (customer) {
    return {
      ...base,
      location: await getMerchantStampLocationRequirement(context.merchant.id),
      hasSession: true,
      pendingOtp: false,
      membership: null,
    }
  }

  // No session: a pending join verification means show the code step — unless the
  // customer explicitly asked to re-enter their number (`step=phone`).
  const pending = await getPendingPhoneVerification()
  const pendingOtp =
    searchParams.step !== "phone" && pending?.purpose === "join"

  if (pendingOtp) {
    return {
      ...base,
      hasSession: false,
      pendingOtp,
      pendingPhone: pending.phone,
      membership: null,
    }
  }

  return {
    ...base,
    hasSession: false,
    pendingOtp,
    pendingPhone: pendingOtp ? pending.phone : undefined,
    membership: null,
  }
}

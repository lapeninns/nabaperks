import "server-only"

import { capturePostHogEvent } from "@/lib/analytics/events"
import { getCustomerCardState } from "@/lib/customer/card"
import { getCurrentCustomer } from "@/lib/customer/identity"
import {
  getExistingMembershipForCurrentUser,
  getMerchantJoinContext,
  getStampQrContextForMembership,
} from "@/lib/customer/join"
import {
  issueSelfServiceStamp,
  type GeoCoordinates,
} from "@/lib/customer/stamp"
import { isRedeemableFrom } from "@/lib/customer/uk-date"

type ReturningQrRedirectOptions = {
  /** When true, issue today's stamp immediately after QR identity verification. */
  readonly issueStamp: boolean
  readonly coordinates?: GeoCoordinates
}

/**
 * Resolves where a returning member should land after scanning a venue QR.
 * New members return null so the join flow can continue.
 */
export async function destinationForReturningQrVisit(
  merchantSlug: string,
  qrId: string,
  options: ReturningQrRedirectOptions
): Promise<string | null> {
  const customer = await getCurrentCustomer()
  if (!customer) return null

  let context: Awaited<ReturnType<typeof getMerchantJoinContext>>

  try {
    context = await getMerchantJoinContext(merchantSlug, qrId)
  } catch {
    return null
  }

  if (!context?.available) return null

  const membership = await getExistingMembershipForCurrentUser(
    context.merchant.id
  )
  if (!membership) return null

  const stampPath = `/card/${membership.id}/stamp?qr=${encodeURIComponent(qrId)}`
  const cardPath = `/card/${membership.id}`

  if (!options.issueStamp) {
    return stampPath
  }

  const qrContext = await getStampQrContextForMembership(membership.id, qrId)
  if (!qrContext) return cardPath

  const cardState = await getCustomerCardState(membership.id)
  if (
    cardState.status === "ready" &&
    cardState.latestReward?.status === "unlocked"
  ) {
    if (isRedeemableFrom(cardState.latestReward.redeemable_from)) {
      return `/reward/${cardState.latestReward.id}`
    }

    return cardPath
  }

  const result = await issueSelfServiceStamp(membership.id, options.coordinates)

  if (result.status === "issued") {
    await capturePostHogEvent({
      eventName: "stamp_issued",
      membershipId: membership.id,
      actorType: "customer",
      actorId: customer.id,
      metadata: {
        merchant_slug: merchantSlug,
        source: "returning_qr_after_otp",
        geo_flagged: result.geoFlagged,
      },
    })

    const params = new URLSearchParams({ stamp: "issued" })
    if (result.geoFlagged) params.set("geo", "flagged")
    return `${cardPath}?${params.toString()}`
  }

  if (result.reason?.includes("already stamped")) {
    return stampPath
  }

  return stampPath
}

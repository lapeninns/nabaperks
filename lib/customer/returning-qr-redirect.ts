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

  // A ready reward outranks a new stamp; a waiting reward returns to the card.
  const rewardPath = await rewardDestinationForMembership(
    membership.id,
    cardPath
  )
  if (rewardPath) return rewardPath

  return issueStampDestination({
    membershipId: membership.id,
    merchantSlug,
    customerId: customer.id,
    coordinates: options.coordinates,
    stampPath,
    cardPath,
  })
}

/**
 * Reward-first routing for a returning member: a redeemable reward → its page; an
 * unlocked-but-waiting reward → the card. Returns null when there is no unlocked
 * reward, so the caller proceeds to issue a stamp.
 */
async function rewardDestinationForMembership(
  membershipId: string,
  cardPath: string
): Promise<string | null> {
  const cardState = await getCustomerCardState(membershipId)
  if (
    cardState.status !== "ready" ||
    cardState.latestReward?.status !== "unlocked"
  ) {
    return null
  }

  return isRedeemableFrom(cardState.latestReward.redeemable_from)
    ? `/reward/${cardState.latestReward.id}`
    : cardPath
}

type IssueStampDestinationInput = {
  readonly membershipId: string
  readonly merchantSlug: string
  readonly customerId: string
  readonly coordinates?: GeoCoordinates
  readonly stampPath: string
  readonly cardPath: string
}

async function issueStampDestination({
  membershipId,
  merchantSlug,
  customerId,
  coordinates,
  stampPath,
  cardPath,
}: IssueStampDestinationInput): Promise<string> {
  let result: Awaited<ReturnType<typeof issueSelfServiceStamp>>
  try {
    result = await issueSelfServiceStamp(membershipId, coordinates)
  } catch {
    // An unexpected auto-issue failure must not error the OTP verification.
    // Degrade to the stamp screen so the customer can retry from the venue QR.
    return stampPath
  }

  if (result.status !== "issued") {
    // Already-stamped (and any other block) routes to the stamp status screen.
    return stampPath
  }

  await capturePostHogEvent({
    eventName: "stamp_issued",
    membershipId,
    actorType: "customer",
    actorId: customerId,
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

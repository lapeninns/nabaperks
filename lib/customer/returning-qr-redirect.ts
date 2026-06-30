import "server-only"

import { capturePostHogEvent } from "@/lib/analytics/events"
import {
  getCustomerCardState,
  type CustomerCardState,
} from "@/lib/customer/card"
import { getCurrentCustomer } from "@/lib/customer/identity"
import {
  getExistingMembershipForCurrentUser,
  getMerchantJoinContext,
  getStampQrContextForMembership,
} from "@/lib/customer/join"
import {
  getMembershipLocationRequirement,
  issueSelfServiceStamp,
  type GeoCoordinates,
} from "@/lib/customer/stamp"
import { isRedeemableFrom } from "@/lib/customer/uk-date"
import { logger } from "@/lib/observability/logger"

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
  const rewardPath = rewardDestinationFromCardState(cardState, cardPath)
  if (rewardPath) return rewardPath

  const locationAttemptPath = await locationAttemptDestinationForMembership(
    membership.id,
    cardState,
    stampPath
  )
  if (locationAttemptPath) return locationAttemptPath

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
function rewardDestinationFromCardState(
  cardState: CustomerCardState,
  cardPath: string
): string | null {
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

async function locationAttemptDestinationForMembership(
  membershipId: string,
  cardState: CustomerCardState,
  stampPath: string
): Promise<string | null> {
  if (!isNextCycleStampThree(cardState)) return null

  try {
    const requirement = await getMembershipLocationRequirement(membershipId)
    return requirement.requireGeofence ? stampPath : null
  } catch {
    return stampPath
  }
}

function isNextCycleStampThree(cardState: CustomerCardState): boolean {
  return (
    cardState.status === "ready" &&
    cardState.membership.current_stamp_count + 1 === 3
  )
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
  } catch (error) {
    // An unexpected auto-issue failure must not error the OTP verification.
    // Degrade to the stamp screen so the customer can retry from the venue QR.
    logger.warn("returning_qr_auto_stamp_failed", {
      membershipId,
      merchantSlug,
      error: error instanceof Error ? error.message : String(error),
    })
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

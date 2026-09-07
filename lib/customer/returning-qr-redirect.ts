import "server-only"

import {
  getMembershipForCustomer,
  getMerchantJoinContext,
} from "@/lib/customer/join"

/**
 * Where a customer who just verified their phone on a QR join lands if they
 * already hold a card at this venue: the stamp screen, so the visit counts.
 * The caller passes the customer it already resolved; this never re-reads the
 * session, and the join context behind it is a cache hit.
 */
export async function destinationForReturningQrVisit(
  merchantSlug: string,
  qrId: string,
  customerId: string
): Promise<string | null> {
  let context: Awaited<ReturnType<typeof getMerchantJoinContext>>

  try {
    context = await getMerchantJoinContext(merchantSlug, qrId)
  } catch {
    return null
  }

  if (!context?.available) return null

  const membership = await getMembershipForCustomer(
    context.merchant.id,
    customerId
  )
  if (!membership) return null

  return `/card/${membership.id}/stamp?qr=${encodeURIComponent(qrId)}`
}

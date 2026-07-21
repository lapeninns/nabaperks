import "server-only"

import { getCurrentCustomer } from "@/lib/customer/identity"
import {
  getExistingMembershipForCurrentUser,
  getMerchantJoinContext,
} from "@/lib/customer/join"

export async function destinationForReturningQrVisit(
  merchantSlug: string,
  qrId: string,
  scanRateLimitIdentity?: string
): Promise<string | null> {
  const customer = await getCurrentCustomer()
  if (!customer) return null

  let context: Awaited<ReturnType<typeof getMerchantJoinContext>>

  try {
    context = await getMerchantJoinContext(
      merchantSlug,
      qrId,
      scanRateLimitIdentity
    )
  } catch {
    return null
  }

  if (!context?.available) return null

  const membership = await getExistingMembershipForCurrentUser(
    context.merchant.id
  )
  if (!membership) return null

  return `/card/${membership.id}/stamp?qr=${encodeURIComponent(qrId)}`
}

import "server-only"

import { scheduleMerchantActivationEvent } from "@/lib/analytics/merchant-activation-events"
import {
  scheduleMerchantBillingCheckoutReturnedWith,
  scheduleMerchantBillingCheckoutStartedWith,
  scheduleMerchantBillingReachedWith,
} from "@/lib/analytics/merchant-billing-events-core"

export function scheduleMerchantBillingReached(merchantId: string): void {
  scheduleMerchantBillingReachedWith(
    merchantId,
    scheduleMerchantActivationEvent
  )
}

export function scheduleMerchantBillingCheckoutStarted(
  merchantId: string
): void {
  scheduleMerchantBillingCheckoutStartedWith(
    merchantId,
    scheduleMerchantActivationEvent
  )
}

export function scheduleMerchantBillingCheckoutReturned(
  merchantId: string
): void {
  scheduleMerchantBillingCheckoutReturnedWith(
    merchantId,
    scheduleMerchantActivationEvent
  )
}

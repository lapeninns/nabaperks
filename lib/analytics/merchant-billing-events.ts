import "server-only"

import { scheduleMerchantActivationEvent } from "@/lib/analytics/merchant-activation-events"
import {
  observeMerchantBillingCheckoutPreparationWith,
  scheduleMerchantBillingCheckoutReturnedWith,
  scheduleMerchantBillingReachedForLaunchWith,
  type MerchantBillingCheckoutPreparationResult,
  type MerchantBillingLaunchObservation,
} from "@/lib/analytics/merchant-billing-events-core"

export function scheduleMerchantBillingReachedForLaunch(
  input: MerchantBillingLaunchObservation
): void {
  scheduleMerchantBillingReachedForLaunchWith(
    input,
    scheduleMerchantActivationEvent
  )
}

export function observeMerchantBillingCheckoutPreparation<
  Result extends MerchantBillingCheckoutPreparationResult,
>(merchantId: string, prepare: () => Promise<Result>): Promise<Result> {
  return observeMerchantBillingCheckoutPreparationWith(
    merchantId,
    prepare,
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

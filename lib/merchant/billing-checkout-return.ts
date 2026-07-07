import "server-only"

import { revalidateMerchantLaunchSurfaces } from "@/lib/merchant/revalidate-launch-surfaces"
import { syncMerchantBillingFromStripe } from "@/lib/stripe/billing"

/** Pull Stripe subscription state into Postgres and invalidate launch surfaces. */
export async function completeBillingCheckoutReturn(merchantId: string) {
  await syncMerchantBillingFromStripe(merchantId)
  revalidateMerchantLaunchSurfaces(merchantId)
}

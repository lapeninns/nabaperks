import { scheduleMerchantActivationEvent } from "@/lib/analytics/merchant-activation-events"
import { getCurrentMerchant } from "@/lib/auth/session"

export default async function MerchantLaunchLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const merchant = await getCurrentMerchant()

  if (merchant) {
    scheduleMerchantActivationEvent({
      merchantId: merchant.id,
      eventName: "merchant_launch_entered",
      idempotencyKey: "first-entry",
      source: "merchant_launch",
    })
  }

  return children
}

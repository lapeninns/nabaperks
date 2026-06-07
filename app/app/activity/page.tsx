import { redirect } from "next/navigation"

import { EmptyState, PageTitle } from "@/components/brand"
import { ActivityFeed } from "@/components/data"
import { getCurrentMerchant } from "@/lib/auth/session"
import { getMerchantActivity } from "@/lib/merchant/dashboard"

export default async function MerchantActivityPage() {
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  const activity = await getMerchantActivity(merchant.id)

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Activity"
        title="Recent activity"
        description="Stamps, rewards, joins, QR downloads, and account events for this merchant."
      />

      <ActivityFeed
        items={activity.map((item) => ({
          id: item.id,
          title: activityLabel(item.event_name),
          timestamp: item.created_at,
        }))}
        emptyState={
          <EmptyState
            title="No activity yet"
            description="Activity will appear after customers join, staff issue stamps, rewards are redeemed, or QR assets are downloaded."
          />
        }
      />
    </div>
  )
}

function activityLabel(eventName: string) {
  const labels: Record<string, string> = {
    customer_joined: "Customer joined",
    stamp_issued: "Stamp issued",
    reward_redeemed: "Reward redeemed",
    qr_downloaded: "QR downloaded",
    qr_created: "QR created",
    loyalty_card_created: "Card created",
    loyalty_card_updated: "Card updated",
    merchant_signed_up: "Merchant signed up",
  }

  return labels[eventName] ?? eventName.replaceAll("_", " ")
}

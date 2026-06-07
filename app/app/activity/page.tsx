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
          description: activityDescription(item.event_name),
          timestamp: item.created_at,
          metadata: <ActivityMetadata metadata={item.metadata} />,
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
    qr_scanned: "QR scanned",
    customer_joined: "Customer joined",
    stamp_claim_started: "Stamp claim started",
    stamp_issued: "Stamp issued",
    reward_unlocked: "Reward unlocked",
    reward_redeemed: "Reward redeemed",
    qr_downloaded: "QR downloaded",
    qr_created: "QR created",
    loyalty_card_created: "Card created",
    loyalty_card_updated: "Card updated",
    merchant_signed_up: "Merchant signed up",
    subscription_started: "Subscription started",
    subscription_cancelled: "Subscription cancelled",
  }

  return labels[eventName] ?? eventName.replaceAll("_", " ")
}

function activityDescription(eventName: string) {
  const descriptions: Record<string, string> = {
    qr_scanned: "A customer opened the venue QR resolver.",
    customer_joined: "A customer joined this merchant loyalty card.",
    stamp_claim_started: "A customer opened staff approval from their card.",
    stamp_issued: "Staff issued a visit stamp.",
    reward_unlocked: "A customer reached the stamp target and unlocked a reward.",
    reward_redeemed: "Staff confirmed a reward redemption.",
    qr_downloaded: "A merchant QR asset was downloaded.",
    qr_created: "A permanent venue QR was generated.",
    loyalty_card_created: "The merchant loyalty card was created.",
    loyalty_card_updated: "The merchant loyalty card was updated.",
    merchant_signed_up: "The merchant account completed onboarding.",
    subscription_started: "Stripe marked the Growth Plan subscription as started.",
    subscription_cancelled: "Stripe marked the Growth Plan subscription as cancelled.",
  }

  return descriptions[eventName] ?? "Merchant activity event."
}

function ActivityMetadata({
  metadata,
}: {
  metadata: Record<string, unknown> | null
}) {
  if (!metadata) return null

  const safeItems = [
    metadata.asset_type ? `Asset: ${String(metadata.asset_type)}` : null,
    metadata.status ? `Status: ${String(metadata.status)}` : null,
    metadata.plan ? `Plan: ${String(metadata.plan)}` : null,
    metadata.source ? `Source: ${String(metadata.source)}` : null,
  ].filter(Boolean)

  if (!safeItems.length) return null

  return (
    <ul className="flex flex-wrap gap-2" aria-label="Activity metadata">
      {safeItems.map((item) => (
        <li
          key={item}
          className="rounded-full bg-secondary px-2 py-1 text-secondary-foreground"
        >
          {item}
        </li>
      ))}
    </ul>
  )
}

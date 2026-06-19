import Link from "next/link"
import {
  Activity03Icon,
  CheckmarkBadge04Icon,
  Download01Icon,
  GiftIcon,
  RefreshIcon,
  UserAdd01Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"

import {
  EmptyState,
  Icon,
  MetricTile,
  ReceiptCard,
  SectionHeader,
} from "@/components/brand"
import { ActivityCompactFeed } from "@/components/merchant/activity-compact-feed"
import { MerchantBillingNotice } from "@/components/merchant/billing-status"
import { LaunchReadinessPanel } from "@/components/merchant/launch-readiness-panel"
import { WetInkRise } from "@/components/motion"
import { Button } from "@/components/ui/button"
import { getEnrichedMerchantActivity } from "@/lib/merchant/activity"
import {
  getMerchantDashboardData,
  type MerchantDashboardMerchant,
} from "@/lib/merchant/dashboard"
import { getMerchantLaunchReadiness } from "@/lib/merchant/launch-readiness"
import { timeServerLoader } from "@/lib/perf/server-timing"

export async function MerchantDashboardStream({
  merchant,
}: {
  merchant: MerchantDashboardMerchant
}) {
  const [dashboard, launchReadiness] = await Promise.all([
    timeServerLoader("/app", "getMerchantDashboardData", () =>
      getMerchantDashboardData(merchant)
    ),
    timeServerLoader("/app", "getMerchantLaunchReadiness", () =>
      getMerchantLaunchReadiness()
    ),
  ])
  const metrics = dashboard.metrics
  const secondaryMetrics = [
    {
      label: "New members (7d)",
      value: metrics.newMembers.toString(),
      icon: UserAdd01Icon,
    },
    {
      label: "Stamps issued",
      value: metrics.stampsIssued.toString(),
      icon: CheckmarkBadge04Icon,
    },
    {
      label: "Repeat customers",
      value: metrics.repeatCustomers.toString(),
      icon: RefreshIcon,
    },
    {
      label: "Rewards redeemed",
      value: metrics.rewardsRedeemed.toString(),
      icon: GiftIcon,
    },
    {
      label: "QR downloads",
      value: metrics.qrDownloads.toString(),
      icon: Download01Icon,
    },
  ]

  return (
    <>
      <MerchantBillingNotice status={dashboard.billingStatus} />
      {!launchReadiness.launchReady ? (
        <LaunchReadinessPanel readiness={launchReadiness} />
      ) : null}

      {metrics.members === 0 ? (
        <EmptyState
          title="No members yet"
          description="Generate the venue QR and place it at the till so customers can join before their next order."
          icon={UserMultiple02Icon}
          actions={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild size="sm">
                <Link href="/app/launch?tab=qr">Generate QR</Link>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link href="/app/launch?tab=card">Check card setup</Link>
              </Button>
            </div>
          }
        />
      ) : null}

      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-6 overflow-hidden rounded-lg border-2 border-ink bg-card p-6 shadow-sm">
          <div className="grid content-start gap-2">
            <p className="eyebrow">Members</p>
            <p className="numeric-tabular text-5xl leading-none font-extrabold sm:text-6xl">
              {metrics.members}
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              People carrying your card right now.
            </p>
          </div>
          <span className="hidden size-20 shrink-0 -rotate-6 place-items-center rounded-full border-2 border-ink bg-accent text-accent-foreground shadow-sm sm:grid">
            <Icon icon={UserMultiple02Icon} size={36} />
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {secondaryMetrics.map((metric, index) => (
            <WetInkRise key={metric.label} delay={index * 0.045} distance={12}>
              <MetricTile
                label={metric.label}
                value={metric.value}
                icon={metric.icon}
              />
            </WetInkRise>
          ))}
        </div>
      </section>
    </>
  )
}

export async function MerchantCompactActivityStream({
  merchantId,
}: {
  merchantId: string
}) {
  const compactActivity = await timeServerLoader(
    "/app",
    "getEnrichedMerchantActivity",
    () => getEnrichedMerchantActivity(merchantId, { limit: 6 })
  )

  return (
    <ReceiptCard className="grid gap-4">
      <SectionHeader
        title="Recent activity"
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/app/activity">View all</Link>
          </Button>
        }
      />
      <ActivityCompactFeed
        rows={compactActivity.rows}
        emptyState={
          <EmptyState
            title="No activity yet"
            description="Activity will appear here after customers join, stamps are issued, rewards are redeemed, or QR assets are downloaded."
            icon={Activity03Icon}
            className="bg-background"
          />
        }
      />
    </ReceiptCard>
  )
}

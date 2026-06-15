import Link from "next/link"

import {
  EmptyState,
  MetricTile,
  ReceiptCard,
  SectionHeader,
} from "@/components/brand"
import { ActivityCompactFeed } from "@/components/merchant/activity-compact-feed"
import { MerchantBillingNotice } from "@/components/merchant/billing-status"
import { LaunchReadinessPanel } from "@/components/merchant/launch-readiness-panel"
import { MotionReveal } from "@/components/motion"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
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
    { label: "New members (7d)", value: metrics.newMembers.toString() },
    { label: "Stamps issued", value: metrics.stampsIssued.toString() },
    { label: "Repeat customers", value: metrics.repeatCustomers.toString() },
    { label: "Rewards redeemed", value: metrics.rewardsRedeemed.toString() },
    { label: "QR downloads", value: metrics.qrDownloads.toString() },
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
        <div className="grid overflow-hidden rounded-lg border-2 border-ink bg-card shadow-sm sm:grid-cols-2">
          <div className="grid content-start gap-2 border-b-2 border-ink p-6 sm:border-r-2 sm:border-b-0">
            <p className="eyebrow">Members</p>
            <p className="numeric-tabular text-4xl leading-none font-extrabold sm:text-5xl">
              {metrics.members}
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              People carrying your card right now.
            </p>
          </div>
          <div className="grid content-start gap-2 p-6">
            <p className="eyebrow">Estimated repeat revenue</p>
            <p className="numeric-tabular text-4xl leading-none font-extrabold sm:text-5xl">
              {formatPence(metrics.estimatedRepeatRevenuePence)}
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              Estimate only, from repeat visits at your average order value.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {secondaryMetrics.map((metric, index) => (
            <MotionReveal
              key={metric.label}
              delay={index * 0.045}
              distance={12}
            >
              <MetricTile label={metric.label} value={metric.value} />
            </MotionReveal>
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
            className="bg-background"
          />
        }
      />
    </ReceiptCard>
  )
}

export function MerchantDashboardSkeleton() {
  return (
    <div className="grid gap-4" aria-label="Loading dashboard metrics">
      <Skeleton className="h-20 rounded-[8px] border-2 border-ink/15 bg-card/70" />
      <section className="grid gap-3">
        <div className="grid overflow-hidden rounded-[8px] border-2 border-ink/15 bg-card/70 sm:grid-cols-2">
          <div className="grid gap-3 border-b-2 border-ink/15 p-6 sm:border-r-2 sm:border-b-0">
            <Skeleton className="h-3 w-20 rounded-full bg-ink/15" />
            <Skeleton className="h-12 w-28 rounded-[8px] bg-ink/15" />
            <Skeleton className="h-3 w-44 rounded-full bg-ink/10" />
          </div>
          <div className="grid gap-3 p-6">
            <Skeleton className="h-3 w-36 rounded-full bg-ink/15" />
            <Skeleton className="h-12 w-36 rounded-[8px] bg-ink/15" />
            <Skeleton className="h-3 w-56 rounded-full bg-ink/10" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4].map((tile) => (
            <Skeleton
              key={tile}
              className="h-24 rounded-[8px] border-2 border-ink/15 bg-card/70"
            />
          ))}
        </div>
      </section>
    </div>
  )
}

export function MerchantCompactActivitySkeleton() {
  return (
    <ReceiptCard className="grid gap-4" aria-label="Loading recent activity">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-32 rounded-full bg-ink/15" />
        <Skeleton className="h-9 w-20 rounded-[8px] bg-ink/15" />
      </div>
      <div className="grid gap-2">
        {[0, 1, 2].map((row) => (
          <Skeleton
            key={row}
            className="h-16 rounded-[8px] border-2 border-ink/15 bg-background/70"
          />
        ))}
      </div>
    </ReceiptCard>
  )
}

function formatPence(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100)
}

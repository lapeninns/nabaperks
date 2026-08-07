import Link from "next/link"
import {
  Activity03Icon,
  CheckmarkBadge04Icon,
  GiftIcon,
  UserAdd01Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"

import {
  EmptyState,
  KpiTile,
  ReceiptCard,
  SectionHeader,
} from "@/components/brand"
import { TrendChart } from "@/components/data"
import { ActivityCompactFeed } from "@/components/merchant/activity-compact-feed"
import { WetInkRise } from "@/components/motion"
import { Button } from "@/components/ui/button"
import { getEnrichedMerchantActivity } from "@/lib/merchant/activity"
import {
  getMerchantDashboardData,
  getMerchantDashboardSeries,
  type MerchantDashboardMerchant,
} from "@/lib/merchant/dashboard"
import { timeServerLoader } from "@/lib/perf/server-timing"

export async function MerchantDashboardStream({
  merchant,
}: {
  readonly merchant: MerchantDashboardMerchant
}) {
  const [dashboard, series] = await Promise.all([
    timeServerLoader("/app", "getMerchantDashboardData", () =>
      getMerchantDashboardData(merchant)
    ),
    timeServerLoader("/app", "getMerchantDashboardSeries", () =>
      getMerchantDashboardSeries(merchant.id)
    ),
  ])
  const metrics = dashboard.metrics
  const trends = dashboard.trends

  const kpis = [
    {
      label: "Members",
      value: metrics.members,
      icon: UserMultiple02Icon,
      series: series.members,
      seriesColor: "var(--w-leaf)",
      trend: null,
    },
    {
      label: "New (7d)",
      value: trends.newMembers.current,
      icon: UserAdd01Icon,
      series: series.joins,
      trend: trends.newMembers,
    },
    {
      label: "Stamps (7d)",
      value: trends.stamps.current,
      icon: CheckmarkBadge04Icon,
      series: series.stamps,
      trend: trends.stamps,
    },
    {
      label: "Rewards (7d)",
      value: trends.rewards.current,
      icon: GiftIcon,
      series: series.rewards,
      trend: trends.rewards,
    },
  ]

  return (
    <>
      {metrics.members === 0 ? (
        // Brand-new venue: a grid of zeros reads as failure. Point at the QR
        // instead — the first join/stamp/reward populates this in place.
        <DashboardMembersEmptyState />
      ) : (
        <section className="grid gap-3.5">
          <SectionHeader
            eyebrow="Last 14 days"
            title="How the week is going"
            description="Deltas compare this week with the seven days before; the lines trace the last fortnight."
          />

          <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
            {kpis.map((kpi, index) => (
              <WetInkRise
                key={kpi.label}
                className="min-w-0"
                delay={index * 0.045}
                distance={12}
              >
                <KpiTile
                  label={kpi.label}
                  value={kpi.value}
                  icon={kpi.icon}
                  series={kpi.series}
                  seriesColor={kpi.seriesColor}
                  trend={kpi.trend}
                />
              </WetInkRise>
            ))}
          </div>

          <ReceiptCard className="grid gap-3" padding="md">
            <p className="eyebrow">Stamps vs joins</p>
            <TrendChart
              startLabel="2 weeks ago"
              endLabel="Today"
              aria-label="Daily stamps issued and new members over the last 14 days"
              series={[
                {
                  label: "Stamps",
                  color: "var(--primary)",
                  data: series.stamps,
                  fill: true,
                },
                {
                  label: "Joins",
                  color: "var(--w-cobalt)",
                  data: series.joins,
                },
              ]}
            />
          </ReceiptCard>
        </section>
      )}
    </>
  )
}

/**
 * First-run metrics state: shown in place of the KPI grid until the venue has
 * its first member, so a brand-new merchant sees an encouraging next action
 * rather than a wall of zeros. Exported so the DB-free dashboard harness can
 * render the real state via `?members=empty`.
 */
export function DashboardMembersEmptyState() {
  return (
    <ReceiptCard className="grid gap-3.5" padding="md">
      <EmptyState
        icon={UserMultiple02Icon}
        title="No members yet — that's expected"
        description="Show your counter QR to your next customer. Your first join, stamp, and reward will show up here."
        headingLevel={2}
        className="bg-background"
      />
    </ReceiptCard>
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
    () => getEnrichedMerchantActivity(merchantId, { limit: 4 })
  )

  return (
    // gap-3.5 inside a card, gap-6 between page sections: the dashboard used to
    // stack gap-6 / gap-3 / gap-3 / gap-4 in one column, so the nesting gap and
    // the sibling gap were not reliably different and the eye could not tell
    // which blocks were siblings.
    <ReceiptCard className="grid gap-3.5">
      <SectionHeader
        title="Recent activity"
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/app/activity" prefetch={false}>
              View all
            </Link>
          </Button>
        }
      />
      <ActivityCompactFeed
        inset
        rows={compactActivity.rows}
        emptyState={
          <EmptyState
            title="No activity yet"
            description="Activity will appear after members join, add stamps, redeem rewards, or download QR assets."
            icon={Activity03Icon}
            className="bg-background"
            // Nest under the card's "Recent activity" h2 instead of peering with it.
            headingLevel={3}
          />
        }
      />
    </ReceiptCard>
  )
}

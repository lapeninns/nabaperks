import Link from "next/link"
import {
  Activity03Icon,
  ArrowRight01Icon,
  CheckmarkBadge04Icon,
  GiftIcon,
  UserAdd01Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"

import {
  EmptyState,
  Icon,
  KpiTile,
  ReceiptCard,
  SectionHeader,
} from "@/components/brand"
import { TrendChart } from "@/components/data"
import { ActivityCompactFeed } from "@/components/merchant/activity-compact-feed"
import { MerchantBillingNotice } from "@/components/merchant/billing-status"
import { LaunchReadinessPanel } from "@/components/merchant/launch-readiness-panel"
import { ProgressTrack } from "@/components/loyalty/progress-track"
import { WetInkRise } from "@/components/motion"
import { Button } from "@/components/ui/button"
import { getEnrichedMerchantActivity } from "@/lib/merchant/activity"
import {
  getMerchantDashboardCustomerCounts,
  getMerchantDashboardData,
  getMerchantDashboardSeries,
  type MerchantDashboardMerchant,
} from "@/lib/merchant/dashboard"
import { getMerchantLaunchReadiness } from "@/lib/merchant/launch-readiness"
import { timeServerLoader } from "@/lib/perf/server-timing"
import { cn } from "@/lib/utils"

export async function MerchantDashboardStream({
  merchant,
}: {
  merchant: MerchantDashboardMerchant
}) {
  const [dashboard, launchReadiness, series, customerCounts] =
    await Promise.all([
      timeServerLoader("/app", "getMerchantDashboardData", () =>
        getMerchantDashboardData(merchant)
      ),
      timeServerLoader("/app", "getMerchantLaunchReadiness", () =>
        getMerchantLaunchReadiness()
      ),
      timeServerLoader("/app", "getMerchantDashboardSeries", () =>
        getMerchantDashboardSeries(merchant.id)
      ),
      // "Do next" needs only two integers — load them without pulling the full
      // (PII-bearing) customer list onto the dashboard path.
      timeServerLoader("/app", "getMerchantDashboardCustomerCounts", () =>
        getMerchantDashboardCustomerCounts(merchant.id)
      ),
    ])
  const metrics = dashboard.metrics
  const trends = dashboard.trends

  const { readyCount, quietCount } = customerCounts

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
      <MerchantBillingNotice status={dashboard.billingStatus} />
      {!launchReadiness.launchReady ? (
        <LaunchReadinessPanel readiness={launchReadiness} />
      ) : null}

      <section className="grid gap-3">
        <SectionHeader
          eyebrow="Last 14 days"
          title="How the week is going"
          description="Deltas compare this week with the seven days before; the lines trace the last fortnight."
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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

      <MerchantNextActions
        readyCount={readyCount}
        quietCount={quietCount}
        repeatCustomers={metrics.repeatCustomers}
        members={metrics.members}
      />
    </>
  )
}

const NEXT_ACTION_DOT: Record<"accent" | "sun" | "leaf", string> = {
  accent: "bg-primary",
  sun: "bg-sun",
  leaf: "bg-leaf",
}

function MerchantNextActions({
  readyCount,
  quietCount,
  repeatCustomers,
  members,
}: {
  readyCount: number
  quietCount: number
  repeatCustomers: number
  members: number
}) {
  return (
    <ReceiptCard className="grid gap-4">
      <SectionHeader title="Do next" />
      <div className="grid gap-1.5">
        <NextActionRow
          href="/app/customers"
          tone={readyCount > 0 ? "accent" : "leaf"}
          label={
            readyCount > 0
              ? `${readyCount} ${readyCount === 1 ? "reward" : "rewards"} ready to redeem`
              : "No rewards waiting — you're all caught up"
          }
        />
        <NextActionRow
          href="/app/customers"
          tone={quietCount > 0 ? "sun" : "leaf"}
          label={
            quietCount > 0
              ? `${quietCount} ${quietCount === 1 ? "member" : "members"} gone quiet`
              : "Every member has visited recently"
          }
        />
      </div>
      <div className="border-t border-dashed border-line pt-4">
        <ProgressTrack
          current={repeatCustomers}
          total={members}
          label="Repeat members"
        />
      </div>
    </ReceiptCard>
  )
}

function NextActionRow({
  href,
  tone,
  label,
}: {
  href: string
  tone: "accent" | "sun" | "leaf"
  label: string
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="-mx-2 flex items-center gap-3 rounded-lg border-2 border-transparent px-2 py-2 transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] hover:border-ink/15 hover:bg-secondary/50 focus-visible:border-ink/15 focus-visible:bg-secondary/50 focus-visible:outline-none motion-reduce:transition-none"
    >
      <span
        className={cn(
          "size-2.5 shrink-0 rounded-full border-2 border-ink",
          NEXT_ACTION_DOT[tone]
        )}
      />
      <span className="min-w-0 flex-1 text-sm font-semibold text-balance">
        {label}
      </span>
      <Icon
        icon={ArrowRight01Icon}
        size={16}
        className="shrink-0 text-ink-soft"
      />
    </Link>
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
    <ReceiptCard className="grid gap-4">
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

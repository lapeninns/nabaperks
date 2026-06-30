import Link from "next/link"
import { notFound } from "next/navigation"
import {
  Activity03Icon,
  ArrowRight01Icon,
  Camera01Icon,
  CheckmarkBadge04Icon,
  GiftIcon,
  UserAdd01Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"

import {
  EmptyState,
  Icon,
  KpiTile,
  PageTitle,
  ReceiptCard,
  SectionHeader,
} from "@/components/brand"
import { TrendChart } from "@/components/data"
import { ActivityCompactFeed } from "@/components/merchant/activity-compact-feed"
import { ProgressTrack } from "@/components/loyalty/progress-track"
import { WetInkRise } from "@/components/motion"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import {
  HARNESS_ACTIVITY_ROWS,
  HARNESS_KPIS,
  HARNESS_MERCHANT,
  HARNESS_NEXT_ACTIONS,
  HARNESS_TREND_SERIES,
} from "../fixtures"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const KPI_ICON = {
  Members: UserMultiple02Icon,
  "New (7d)": UserAdd01Icon,
  "Stamps (7d)": CheckmarkBadge04Icon,
  "Rewards (7d)": GiftIcon,
} as const

/**
 * Dashboard harness — mounts the REAL presentational primitives that
 * {@link MerchantDashboardStream} renders (KpiTile 2-up→4-up grid, TrendChart,
 * the "Do next" ReceiptCard, ProgressTrack, and ActivityCompactFeed) fed
 * DB-free fixtures. The async stream wrappers themselves fetch Supabase, so —
 * per the qa-harness spec — their presentational children are mounted directly.
 * The page header reuses the same PageTitle + Scan-reward CTA as /app/page.tsx.
 */
export default function DashboardHarnessPage() {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const { readyCount, quietCount, repeatCustomers, members } =
    HARNESS_NEXT_ACTIONS

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Your venue"
        title={HARNESS_MERCHANT.business_name}
        description="A quick read on how your loyalty card is doing: members, repeat visits, and rewards."
        actions={
          <Button asChild className="w-full sm:w-auto">
            <Link href="/app/scan">
              <Icon icon={Camera01Icon} size={16} />
              Scan reward
            </Link>
          </Button>
        }
      />

      <section className="grid gap-3">
        <SectionHeader
          eyebrow="Last 14 days"
          title="How the week is going"
          description="Deltas compare this week with the seven days before; the lines trace the last fortnight."
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {HARNESS_KPIS.map((kpi, index) => (
            <WetInkRise
              key={kpi.label}
              className="min-w-0"
              delay={index * 0.045}
              distance={12}
            >
              <KpiTile
                label={kpi.label}
                value={kpi.value.toLocaleString("en-GB")}
                icon={KPI_ICON[kpi.label]}
                series={[...kpi.series]}
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
            series={HARNESS_TREND_SERIES.map((s) => ({ ...s, data: [...s.data] }))}
          />
        </ReceiptCard>
      </section>

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
          inset
          rows={HARNESS_ACTIVITY_ROWS.slice(0, 4)}
          emptyState={
            <EmptyState
              title="No activity yet"
              description="Activity will appear after members join, add stamps, redeem rewards, or download QR assets."
              icon={Activity03Icon}
              className="bg-background"
              headingLevel={3}
            />
          }
        />
      </ReceiptCard>
    </div>
  )
}

const NEXT_ACTION_DOT: Record<"accent" | "sun" | "leaf", string> = {
  accent: "bg-primary",
  sun: "bg-sun",
  leaf: "bg-leaf",
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

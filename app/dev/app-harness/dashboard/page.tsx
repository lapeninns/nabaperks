import Link from "next/link"
import { notFound } from "next/navigation"
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
  PageTitle,
  ReceiptCard,
  SectionHeader,
} from "@/components/brand"
import { TrendChart } from "@/components/data"
import { ActivityCompactFeed } from "@/components/merchant/activity-compact-feed"
import { MerchantDashboardHeaderActions } from "@/components/merchant/dashboard-header-actions"
import { DashboardMembersEmptyState } from "@/components/merchant/dashboard-home-streams"
import { DashboardQrCardView } from "@/components/merchant/dashboard-qr-card"
import { MerchantNextActions } from "@/components/merchant/dashboard-next-actions"
import { LaunchReadinessPanel } from "@/components/merchant/launch-readiness-panel"
import { WetInkRise } from "@/components/motion"
import { Button } from "@/components/ui/button"
import { buildLaunchReadiness } from "@/lib/merchant/launch-readiness"
import { LAUNCH_MIN_ACTIVE_REWARDS } from "@/lib/merchant/launch-readiness-contract"

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

/** Shared DB-free inputs for the dashboard's live, paused, and setup states. */
const HARNESS_ACTIVE_CARD = {
  id: "card_harness",
  card_name: "Mystery Visit Card",
  reward_name: "Mystery reward",
  stamps_required: 3,
} as const

const HARNESS_LOCATION = {
  id: "loc_harness",
  name: "Old Crown Girton",
  address: "12 High Street, Girton, Cambridge, CB3 0QH",
  latitude: 52.2399,
  longitude: 0.0826,
  geofence_radius_meters: 150,
  require_geofence: false,
  geocoded_at: "2026-06-20T10:00:00.000Z",
} as const

function buildDashboardHarnessReadiness({
  setupIncomplete,
  qrPaused,
  qrGated,
}: {
  readonly setupIncomplete: boolean
  readonly qrPaused: boolean
  readonly qrGated: boolean
}) {
  return buildLaunchReadiness({
    activeCard: HARNESS_ACTIVE_CARD,
    activeRewardPoolItemCount: setupIncomplete ? 1 : LAUNCH_MIN_ACTIVE_REWARDS,
    qrCode: setupIncomplete
      ? null
      : {
          id: "qr_harness",
          qr_id: "old-crown-girton",
          destination_type: "join",
          is_active: !qrPaused,
        },
    location: HARNESS_LOCATION,
    billing: {
      requiresBilling: true,
      status: setupIncomplete || qrGated ? null : "active",
    },
  })
}

/**
 * Dashboard harness — mounts the REAL presentational primitives that
 * {@link MerchantDashboardStream} renders (KpiTile 2-up→4-up grid, TrendChart,
 * the "Do next" ReceiptCard, ProgressTrack, and ActivityCompactFeed) fed
 * DB-free fixtures. The async stream wrappers themselves fetch Supabase, so —
 * per the qa-harness spec — their presentational children are mounted directly.
 * The page header renders the same readiness-driven action component as
 * /app/page.tsx, so incomplete and operational states cannot drift.
 */
export default async function DashboardHarnessPage({
  searchParams,
}: {
  searchParams?: Promise<{ setup?: string; members?: string; qr?: string }>
}) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const params = searchParams ? await searchParams : {}
  const showSetupReminder = params.setup === "incomplete"
  const showEmptyMembers = params.members === "empty"
  const qrPaused = params.qr === "paused"
  const qrGated = params.qr === "gated"
  const qrScansAvailable = !qrPaused && !qrGated
  const readiness = buildDashboardHarnessReadiness({
    setupIncomplete: showSetupReminder,
    qrPaused,
    qrGated,
  })

  const { readyCount, quietCount, repeatCustomers, members } =
    HARNESS_NEXT_ACTIONS

  return (
    <div className="grid gap-6">
      {/* Incomplete-setup reminder — the real compact readiness panel the
          merchant layout shows while launch is unfinished. */}
      {showSetupReminder ? (
        <LaunchReadinessPanel
          readiness={readiness}
          variant="compact"
          showHeader={false}
        />
      ) : null}
      <PageTitle
        eyebrow="Your venue"
        title={HARNESS_MERCHANT.business_name}
        description="A quick read on how your loyalty card is doing: members, repeat visits, and rewards."
        actions={<MerchantDashboardHeaderActions readiness={readiness} />}
      />

      <DashboardQrCardView
        qrCodeId="qr_harness"
        venueName={HARNESS_MERCHANT.business_name}
        shareUrl="https://nabaperks.com/q/old-crown-girton"
        isActive={!qrPaused}
        scansAvailable={qrScansAvailable}
        actionHref={qrGated ? "/app/launch?tab=billing" : "/app/qr"}
        actionLabel={qrGated ? "Finish launch setup" : "Review QR setup"}
      />

      {showEmptyMembers ? (
        <DashboardMembersEmptyState />
      ) : (
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
              series={HARNESS_TREND_SERIES.map((s) => ({
                ...s,
                data: [...s.data],
              }))}
            />
          </ReceiptCard>
        </section>
      )}

      {showEmptyMembers ? null : (
        <MerchantNextActions
          readyCount={readyCount}
          quietCount={quietCount}
          repeatCustomers={repeatCustomers}
          members={members}
        />
      )}

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
          rows={showEmptyMembers ? [] : HARNESS_ACTIVITY_ROWS.slice(0, 4)}
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

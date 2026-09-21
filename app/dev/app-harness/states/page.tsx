import type { ReactNode } from "react"
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
import { ActivityCompactFeed } from "@/components/merchant/activity-compact-feed"
import { ActivityDetailFeed } from "@/components/merchant/activity-detail-feed"
import { CustomerReadbackTable } from "@/components/merchant/customer-readback-table"
import { StatusBanner } from "@/components/loyalty/status-banner"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** One link per row of the console handoff's state matrices (§7.1–§7.5). */
const CONSOLE_STATE_LINKS: ReadonlyArray<readonly [string, string]> = [
  ["Counter — ready", "/dev/app-harness/dashboard"],
  ["Counter — QR paused", "/dev/app-harness/dashboard?qr=paused"],
  ["Counter — QR gated", "/dev/app-harness/dashboard?qr=gated"],
  ["Counter — QR missing", "/dev/app-harness/dashboard?qr=missing"],
  ["Counter — QR failed to load", "/dev/app-harness/dashboard?qr=error"],
  ["Counter — QR loading", "/dev/app-harness/dashboard?qr=loading"],
  ["Counter — code revealed", "/dev/app-harness/dashboard?code=revealed"],
  ["Counter — code unavailable", "/dev/app-harness/dashboard?code=unavailable"],
  ["Counter — code loading", "/dev/app-harness/dashboard?code=loading"],
  ["Counter — reset refused", "/dev/app-harness/dashboard?reset=fail"],
  ["Counter — reset in flight", "/dev/app-harness/dashboard?reset=slow"],
  ["Counter — setup incomplete", "/dev/app-harness/dashboard?setup=incomplete"],
  ["Shell — offline strip", "/dev/app-harness/dashboard?offline=1"],
  ["Numbers — full history", "/dev/app-harness/numbers"],
  ["Numbers — 7 days", "/dev/app-harness/numbers?range=7"],
  ["Numbers — 3–13 days", "/dev/app-harness/numbers?state=partial"],
  ["Numbers — under 3 days", "/dev/app-harness/numbers?state=early"],
  ["Numbers — no stamp yet", "/dev/app-harness/numbers?state=never"],
  ["Numbers — zero activity", "/dev/app-harness/numbers?state=zero"],
  ["Numbers — series failed", "/dev/app-harness/numbers?state=series-error"],
  ["Numbers — totals failed", "/dev/app-harness/numbers?state=totals-error"],
  ["Numbers — both failed", "/dev/app-harness/numbers?state=both-error"],
  ["Numbers — loading", "/dev/app-harness/numbers?state=loading"],
  ["Numbers — members detail", "/dev/app-harness/numbers/members"],
  ["Numbers — stamps detail", "/dev/app-harness/numbers/stamps"],
  ["Numbers — rewards detail", "/dev/app-harness/numbers/rewards"],
  ["Numbers — QR detail", "/dev/app-harness/numbers/qr"],
  ["Activity — grouped", "/dev/app-harness/activity?fixture=grouped"],
  ["Activity — single row", "/dev/app-harness/activity?fixture=single"],
  ["Activity — load more", "/dev/app-harness/activity?fixture=load-more"],
  [
    "Activity — empty, filtered",
    "/dev/app-harness/activity?fixture=empty&filter=reward",
  ],
  [
    "Activity — empty, today",
    "/dev/app-harness/activity?fixture=empty&range=today",
  ],
  [
    "Activity — empty, brand new",
    "/dev/app-harness/activity?fixture=empty&range=28d",
  ],
  ["More — all subtitles", "/dev/app-harness/more"],
  ["More — subtitles failed", "/dev/app-harness/more?state=subtitles-failed"],
  ["More — setup incomplete", "/dev/app-harness/more?state=setup-incomplete"],
  ["More — billing past due", "/dev/app-harness/more?state=billing-past-due"],
  ["More — trial", "/dev/app-harness/more?state=trial"],
  ["More — log out in flight", "/dev/app-harness/more?state=logout-pending"],
  ["More — loading", "/dev/app-harness/more?state=loading"],
  ["Skeletons", "/dev/app-harness/skeletons"],
]

const ZERO_KPIS = [
  { label: "Members", value: 0, icon: UserMultiple02Icon },
  { label: "New (7d)", value: 0, icon: UserAdd01Icon },
  { label: "Stamps (7d)", value: 0, icon: CheckmarkBadge04Icon },
  { label: "Rewards (7d)", value: 0, icon: GiftIcon },
] as const

/**
 * States harness — mounts the customers / activity / dashboard bodies with
 * EMPTY fixtures and with an ERROR fixture, reusing the REAL EmptyState /
 * StatusBanner the pages already pass in (no re-created markup), so the
 * empty/error branches — otherwise only reachable by manipulating live DB rows —
 * are screenshot-provable.
 */
export default function StatesHarnessPage() {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  return (
    <div className="grid gap-12">
      <PageTitle
        eyebrow="QA harness"
        title="Empty & error states"
        description="The first-run empty states and load-failure banners across the /app surface, mounted via the real body components with empty/error fixtures."
      />

      <HarnessSection
        id="console-rebuild"
        title="Counter-first console — every handoff §7 state"
      >
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {CONSOLE_STATE_LINKS.map(([label, href]) => (
            <li key={href}>
              <Link
                href={href}
                prefetch={false}
                className="focus-ring inline-flex min-h-11 items-center font-bold underline underline-offset-4"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </HarnessSection>

      <HarnessSection id="customers-empty" title="Members — empty (no members)">
        <CustomerReadbackTable
          customers={[]}
          totalMembers={0}
          emptyState={
            <EmptyState
              title="No members yet"
              description="Members will appear here after they join via the venue QR."
              icon={UserMultiple02Icon}
            />
          }
        />
      </HarnessSection>

      <HarnessSection id="activity-empty" title="Activity — empty (no events)">
        <ActivityDetailFeed
          summary={{
            total: 0,
            joins: 0,
            stamps: 0,
            rewards: 0,
            qrEvents: 0,
            accountEvents: 0,
          }}
          rows={[]}
          limit={25}
          hasMore={false}
          emptyState={
            <EmptyState
              title="No activity yet"
              description="Activity will appear after members join, add stamps, redeem rewards, or download QR assets."
              icon={Activity03Icon}
            />
          }
        />
      </HarnessSection>

      <HarnessSection
        id="dashboard-empty"
        title="Dashboard — empty (zeroed metrics + empty activity)"
      >
        <div className="grid gap-6">
          <section className="grid gap-3">
            <SectionHeader
              eyebrow="Last 14 days"
              title="How the week is going"
              description="Deltas compare this week with the seven days before; the lines trace the last fortnight."
            />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {ZERO_KPIS.map((kpi) => (
                <KpiTile
                  key={kpi.label}
                  label={kpi.label}
                  value={kpi.value}
                  icon={kpi.icon}
                  trend={null}
                />
              ))}
            </div>
          </section>
          <ReceiptCard className="grid gap-4">
            <SectionHeader title="Recent activity" />
            <ActivityCompactFeed
              inset
              rows={[]}
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
      </HarnessSection>

      <HarnessSection
        id="error-banners"
        title="Error fixtures — the real StatusBanner load-failure surfaces"
      >
        <div className="grid gap-4">
          <StatusBanner
            tone="error"
            title="Billing details could not be loaded"
          >
            Try again.
          </StatusBanner>
          <StatusBanner tone="error" title="QR action failed.">
            Unable to update QR. Check the QR status and try again.
          </StatusBanner>
          <StatusBanner tone="error" title="Could not reach the venue">
            Check your connection and try again.
          </StatusBanner>
        </div>
      </HarnessSection>
    </div>
  )
}

function HarnessSection({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: ReactNode
}) {
  return (
    <section id={id} className="grid scroll-mt-6 gap-4">
      <SectionHeader eyebrow="State" title={title} />
      {children}
    </section>
  )
}

import type { ReactNode } from "react"
import { notFound } from "next/navigation"

import { HarnessIndex, HarnessSections } from "@/app/dev/harness-index"
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
const STATE_SECTIONS = [
  { id: "customers-empty", label: "Customers empty" },
  { id: "activity-empty", label: "Activity empty" },
  { id: "dashboard-empty", label: "Dashboard empty" },
  { id: "error-banners", label: "Error banners" },
] as const

export default async function StatesHarnessPage({
  searchParams,
}: {
  searchParams: Promise<{ only?: string | string[] }>
}) {
  const requested = (await searchParams).only
  const only = Array.isArray(requested) ? requested[0] : requested
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

      <HarnessIndex
        label="State sections"
        sections={STATE_SECTIONS}
        only={only}
      />

      <HarnessSections only={only}>
        <HarnessSection
          id="customers-empty"
          title="Members — empty (no members)"
        >
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

        <HarnessSection
          id="activity-empty"
          title="Activity — empty (no events)"
        >
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
      </HarnessSections>
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

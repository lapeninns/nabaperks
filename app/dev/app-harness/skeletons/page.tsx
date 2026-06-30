import type { ReactNode } from "react"
import { notFound } from "next/navigation"

import { PageTitle } from "@/components/brand"
import {
  AccountBillingPanelSkeleton,
  AccountProfilePanelSkeleton,
  ActivityFeedSkeleton,
  LaunchPanelSkeleton,
  MerchantCompactActivitySkeleton,
  MerchantCustomersTableSkeleton,
  MerchantDashboardMetricsSkeleton,
  MerchantPageTitleSkeleton,
  RewardScanContentSkeleton,
} from "@/components/merchant/loading-skeletons"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Skeletons harness — renders EVERY export of
 * `@/components/merchant/loading-skeletons` (the single source of truth for
 * every /app Suspense fallback) in a labelled section, including all four
 * {@link LaunchPanelSkeleton} tab variants. These fallbacks are otherwise only
 * visible for the sub-second streaming window of a logged-in render, so their
 * breakpoint behaviour (e.g. the customers skeleton's sm:hidden cards vs
 * hidden sm:block table, the launch card tab's lg two-column grid) is invisible
 * to screenshot proof without this page.
 */
export default function SkeletonsHarnessPage() {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  return (
    <div className="grid gap-12">
      <PageTitle
        eyebrow="QA harness"
        title="Loading skeletons"
        description="Every /app Suspense fallback, rendered statically so its responsive structure is screenshot-provable. Each mirrors the layout of the surface it stands in for."
      />

      <HarnessSection id="page-title" title="MerchantPageTitleSkeleton">
        <MerchantPageTitleSkeleton />
      </HarnessSection>

      <HarnessSection
        id="dashboard-metrics"
        title="MerchantDashboardMetricsSkeleton"
      >
        <MerchantDashboardMetricsSkeleton />
      </HarnessSection>

      <HarnessSection
        id="compact-activity"
        title="MerchantCompactActivitySkeleton"
      >
        <MerchantCompactActivitySkeleton />
      </HarnessSection>

      <HarnessSection id="activity-feed" title="ActivityFeedSkeleton">
        <ActivityFeedSkeleton />
      </HarnessSection>

      <HarnessSection
        id="customers-table"
        title="MerchantCustomersTableSkeleton"
      >
        <MerchantCustomersTableSkeleton />
      </HarnessSection>

      <HarnessSection id="launch-venue" title='LaunchPanelSkeleton tab="venue"'>
        <LaunchPanelSkeleton tab="venue" />
      </HarnessSection>

      <HarnessSection id="launch-card" title='LaunchPanelSkeleton tab="card"'>
        <LaunchPanelSkeleton tab="card" />
      </HarnessSection>

      <HarnessSection
        id="launch-rewards"
        title='LaunchPanelSkeleton tab="rewards"'
      >
        <LaunchPanelSkeleton tab="rewards" />
      </HarnessSection>

      <HarnessSection id="launch-qr" title='LaunchPanelSkeleton tab="qr"'>
        <LaunchPanelSkeleton tab="qr" />
      </HarnessSection>

      <HarnessSection id="account-profile" title="AccountProfilePanelSkeleton">
        <AccountProfilePanelSkeleton />
      </HarnessSection>

      <HarnessSection id="account-billing" title="AccountBillingPanelSkeleton">
        <AccountBillingPanelSkeleton />
      </HarnessSection>

      <HarnessSection id="reward-scan" title="RewardScanContentSkeleton">
        <RewardScanContentSkeleton />
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
    <section id={id} className="grid min-w-0 scroll-mt-6 gap-4">
      <div className="grid gap-1">
        <p className="eyebrow">Skeleton</p>
        {/* Long unbreakable component identifiers (e.g. MerchantDashboardMetricsSkeleton)
            must be allowed to break, or the harness page itself overflows at narrow
            widths even though the skeletons it shows are fluid. */}
        <h2 className="font-mono text-sm font-bold break-all">{title}</h2>
      </div>
      {children}
    </section>
  )
}

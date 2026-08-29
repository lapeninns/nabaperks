import { redirect } from "next/navigation"
import { after } from "next/server"
import { Suspense } from "react"

import { PageTitle } from "@/components/brand"
import { MerchantDashboardHeaderActions } from "@/components/merchant/dashboard-header-actions"
import { MerchantBillingNotice } from "@/components/merchant/billing-status"
import { DashboardQrCard } from "@/components/merchant/dashboard-qr-card"
import {
  MerchantCompactActivityStream,
  MerchantDashboardStream,
} from "@/components/merchant/dashboard-home-streams"
import {
  DashboardQrCardSkeleton,
  MerchantCompactActivitySkeleton,
  MerchantDashboardMetricsSkeleton,
} from "@/components/merchant/loading-skeletons"
import { StreamErrorBoundary } from "@/components/merchant/stream-error-boundary"
import {
  capturePostHogEvent,
  type ProductEventInput,
} from "@/lib/analytics/events"
import { getMerchantBilling } from "@/lib/merchant/billing"
import { getMerchantLaunchReadiness } from "@/lib/merchant/launch-readiness"
import { getMerchantOnboardingStatus } from "@/lib/merchant/onboarding"
import { timeServerLoader } from "@/lib/perf/server-timing"

export const dynamic = "force-dynamic"

export default async function MerchantAppPage() {
  const setup = await timeServerLoader(
    "/app",
    "getMerchantOnboardingStatus",
    () => getMerchantOnboardingStatus()
  )

  if (setup.status !== "complete") {
    redirect("/app/onboarding")
  }

  const merchant = setup.merchant
  // Reused from the layout's setup reminder within the same request (cache()),
  // so this adds no query — it just lets the header CTA match the venue's state.
  const readiness = await getMerchantLaunchReadiness()
  // Same trick for billing: readiness already resolved `getMerchantBilling`
  // (request-memoized), so this is a cache hit, not a second query. Reading it
  // here rather than inside the metrics stream keeps the most consequential
  // message on the page out of a Suspense boundary — it used to be the first
  // child of `MerchantDashboardStream`, whose skeleton reserves no space for
  // it, so a past-due banner appeared late and pushed the page down.
  const billingResult = await getMerchantBilling(merchant.id)
  const billingStatus =
    (billingResult.ok ? billingResult.billing?.status : null) ?? merchant.status

  scheduleDashboardViewed({
    eventName: "dashboard_viewed",
    merchantId: merchant.id,
    actorType: "merchant",
    actorId: merchant.id,
  })

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Your venue"
        title={merchant.business_name}
        description="A quick read on how your loyalty card is doing: members, repeat visits, and rewards."
        actions={<MerchantDashboardHeaderActions readiness={readiness} />}
      />

      <MerchantBillingNotice status={billingStatus} />

      {/* Counter QR sits first: the code a customer scans is the most-reached-for
          action at the till, so it renders one glance (one tap to full screen)
          away instead of a nav hop to the Poster page. Its own boundary keeps
          the extra QR read off the header/metrics critical path.

          03#12 asks for the ticket beside the KPI grid rather than stacked on
          top of it, at `md`. Measured, `md` is not available: the console
          sidebar is 272px, so a 768px viewport gives the content column 448px
          and an 18rem sidecar would leave the four KPI tiles 34px each. The
          split therefore starts at `xl`, where the column is 944px and each
          tile is 158px — within a pixel or two of the 162px they render at
          today's largest stacked width. Each stream keeps its own boundary and
          its own skeleton; only the track they sit in changed. */}
      <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)] xl:items-start">
        <StreamErrorBoundary label="your venue QR">
          <Suspense fallback={<DashboardQrCardSkeleton />}>
            <DashboardQrCard />
          </Suspense>
        </StreamErrorBoundary>

        {/* Per-stream boundaries: a failure inside one stream keeps the other
            (and the page chrome) up instead of tripping the segment-wide
            app/app/error.tsx. */}
        <StreamErrorBoundary label="your dashboard numbers">
          <Suspense fallback={<MerchantDashboardMetricsSkeleton />}>
            <MerchantDashboardStream merchant={merchant} />
          </Suspense>
        </StreamErrorBoundary>
      </div>

      <StreamErrorBoundary label="recent activity">
        <Suspense fallback={<MerchantCompactActivitySkeleton />}>
          <MerchantCompactActivityStream merchantId={merchant.id} />
        </Suspense>
      </StreamErrorBoundary>
    </div>
  )
}

function scheduleDashboardViewed(input: ProductEventInput) {
  scheduleAfterResponse(() => {
    void capturePostHogEvent(input)
  })
}

function scheduleAfterResponse(callback: () => void) {
  try {
    after(callback)
  } catch (error) {
    if (isAfterOutsideRequestScopeError(error)) {
      callback()
      return
    }

    throw error
  }
}

function isAfterOutsideRequestScopeError(error: unknown) {
  return (
    error instanceof Error && error.message.includes("outside a request scope")
  )
}

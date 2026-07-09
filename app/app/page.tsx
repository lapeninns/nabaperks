import Link from "next/link"
import { redirect } from "next/navigation"
import { after } from "next/server"
import { Suspense } from "react"
import {
  ArrowRight02Icon,
  Camera01Icon,
  Megaphone01Icon,
} from "@hugeicons/core-free-icons"

import { Icon, PageTitle } from "@/components/brand"
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
import { Button } from "@/components/ui/button"
import {
  capturePostHogEvent,
  type ProductEventInput,
} from "@/lib/analytics/events"
import {
  getMerchantLaunchReadiness,
  isVenueOperational,
} from "@/lib/merchant/launch-readiness"
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
        actions={
          isVenueOperational(readiness) ? (
            // Operational venue — live, or already launched with the join QR
            // merely paused (existing members still redeem at the counter, so
            // scanning must stay reachable; a paused QR only stops new joins).
            // Scanning a reward at the counter is the reach-for action, so it
            // leads. flex-col-reverse keeps it on TOP when the buttons stack
            // full-width on mobile (the secondary would otherwise sit above it);
            // sm:flex-row restores primary-rightmost on desktop.
            <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
              <Button asChild variant="secondary" className="w-full sm:w-auto">
                <Link href="/app/announcements" prefetch={false}>
                  <Icon icon={Megaphone01Icon} size={16} />
                  Announce
                </Link>
              </Button>
              <Button asChild className="w-full sm:w-auto">
                <Link href="/app/scan" prefetch={false}>
                  <Icon icon={Camera01Icon} size={16} />
                  Scan reward
                </Link>
              </Button>
            </div>
          ) : (
            // Still in setup (a gate outstanding, or the QR never created): with
            // no members yet there is nothing to scan or announce to, so
            // finishing setup is the only action that matters — a premature
            // "Scan reward" must not compete with it.
            <Button asChild className="w-full sm:w-auto">
              <Link
                href={readiness.nextStep?.href ?? "/app/launch"}
                prefetch={false}
              >
                <Icon icon={ArrowRight02Icon} size={16} />
                Finish setup
              </Link>
            </Button>
          )
        }
      />

      {/* Counter QR sits first: the code a customer scans is the most-reached-for
          action at the till, so it renders one glance (one tap to full screen)
          away instead of a nav hop to the Poster page. Its own boundary keeps
          the extra QR read off the header/metrics critical path. */}
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

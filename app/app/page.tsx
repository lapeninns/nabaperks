import Link from "next/link"
import { redirect } from "next/navigation"
import { after } from "next/server"
import { Suspense } from "react"

import { PageTitle } from "@/components/brand"
import {
  MerchantCompactActivitySkeleton,
  MerchantCompactActivityStream,
  MerchantDashboardSkeleton,
  MerchantDashboardStream,
} from "@/components/merchant/dashboard-home-streams"
import { Button } from "@/components/ui/button"
import {
  capturePostHogEvent,
  type ProductEventInput,
} from "@/lib/analytics/events"
import { getMerchantOnboardingStatus } from "@/lib/merchant/onboarding"
import { timeServerLoader } from "@/lib/perf/server-timing"

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
        description="A quick read on how your loyalty card is doing — members, repeat visits, and rewards."
        actions={
          <Button asChild>
            <Link href="/app/launch">Launch QR</Link>
          </Button>
        }
      />

      <Suspense fallback={<MerchantDashboardSkeleton />}>
        <MerchantDashboardStream merchant={merchant} />
      </Suspense>

      <Suspense fallback={<MerchantCompactActivitySkeleton />}>
        <MerchantCompactActivityStream merchantId={merchant.id} />
      </Suspense>
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

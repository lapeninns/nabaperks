import Link from "next/link"
import { redirect } from "next/navigation"
import { after } from "next/server"
import { Suspense } from "react"
import { Camera01Icon } from "@hugeicons/core-free-icons"

import { Icon, PageTitle } from "@/components/brand"
import {
  MerchantCompactActivityStream,
  MerchantDashboardStream,
} from "@/components/merchant/dashboard-home-streams"
import {
  MerchantCompactActivitySkeleton,
  MerchantDashboardMetricsSkeleton,
} from "@/components/merchant/loading-skeletons"
import { Button } from "@/components/ui/button"
import {
  capturePostHogEvent,
  type ProductEventInput,
} from "@/lib/analytics/events"
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
          <Button asChild className="w-full sm:w-auto">
            <Link href="/app/scan" prefetch={false}>
              <Icon icon={Camera01Icon} size={16} />
              Scan reward
            </Link>
          </Button>
        }
      />

      <Suspense fallback={<MerchantDashboardMetricsSkeleton />}>
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

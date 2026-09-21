import { redirect } from "next/navigation"
import { after } from "next/server"
import { Suspense } from "react"

import { CounterPinnedAction } from "@/components/merchant/counter-pinned-action"
import { CounterQrCard } from "@/components/merchant/counter-qr-card"
import {
  CounterQrCardSkeleton,
  TeamCodePanelSkeleton,
} from "@/components/merchant/loading-skeletons"
import { StreamErrorBoundary } from "@/components/merchant/stream-error-boundary"
import { TeamCodePanel } from "@/components/merchant/team-code-panel"
import {
  capturePostHogEvent,
  type ProductEventInput,
} from "@/lib/analytics/events"
import { getMerchantLaunchReadiness } from "@/lib/merchant/launch-readiness"
import { getMerchantOnboardingStatus } from "@/lib/merchant/onboarding"
import { timeServerLoader } from "@/lib/perf/server-timing"

export const dynamic = "force-dynamic"

/**
 * Counter — the during-service screen. The QR to present and the code to
 * read out, with the scanner pinned; nothing else. The owner's after-service
 * read (metrics, activity) lives on /app/numbers and /app/activity.
 */
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
  // so this adds no query — it just lets the pinned action match the venue.
  const readiness = await getMerchantLaunchReadiness()

  scheduleDashboardViewed({
    eventName: "dashboard_viewed",
    merchantId: merchant.id,
    actorType: "merchant",
    actorId: merchant.id,
  })

  return (
    <>
      <h1 className="sr-only">Counter</h1>
      {/* One column to 599px, two-up (QR left, code right) from 600px, capped
          at 560px then 820px on the rail (handoff §8). Each stream keeps its
          own boundary: a failing QR read must not take the team code down. */}
      <div className="mx-auto grid w-full max-w-[35rem] gap-5 min-[600px]:max-w-none min-[600px]:grid-cols-2 min-[600px]:items-start min-[900px]:max-w-[51.25rem]">
        <StreamErrorBoundary label="your venue QR">
          <Suspense fallback={<CounterQrCardSkeleton />}>
            <CounterQrCard />
          </Suspense>
        </StreamErrorBoundary>

        <StreamErrorBoundary label="today's team code">
          <Suspense fallback={<TeamCodePanelSkeleton />}>
            <TeamCodePanel />
          </Suspense>
        </StreamErrorBoundary>
      </div>

      <CounterPinnedAction readiness={readiness} />
    </>
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

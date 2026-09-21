import { redirect } from "next/navigation"
import { Suspense } from "react"

import { PageTitle } from "@/components/brand"
import { MerchantDashboardStream } from "@/components/merchant/dashboard-home-streams"
import { MerchantDashboardMetricsSkeleton } from "@/components/merchant/loading-skeletons"
import { StreamErrorBoundary } from "@/components/merchant/stream-error-boundary"
import { getCurrentMerchant } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

/**
 * Numbers — the tab bar's third destination. Until the Numbers lane lands
 * this renders the existing metrics stream, so the tab never 404s.
 */
export default async function MerchantNumbersPage() {
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Numbers"
        title="How the week is going"
        description="Members, stamps and rewards over the last fortnight."
      />
      <StreamErrorBoundary label="your numbers">
        <Suspense fallback={<MerchantDashboardMetricsSkeleton />}>
          <MerchantDashboardStream merchant={merchant} />
        </Suspense>
      </StreamErrorBoundary>
    </div>
  )
}

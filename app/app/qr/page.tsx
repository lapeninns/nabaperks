import { Suspense } from "react"
import { redirect } from "next/navigation"

import { PageTitle } from "@/components/brand"
import { LaunchPanelSkeleton } from "@/components/merchant/loading-skeletons"
import { QrPanel } from "@/components/merchant/launch/qr-panel"
import { getCurrentMerchant } from "@/lib/auth/session"
import { loadLaunchSetup } from "@/lib/merchant/launch-page-model"
import { resolveLaunchBillingHref } from "@/lib/merchant/launch-readiness-core"
import { QR_POSTER_PATH } from "@/lib/merchant/qr-nav"
import {
  parseLaunchSearchParams,
  type RawLaunchSearchParams,
} from "@/lib/merchant/launch-search-params"

export const dynamic = "force-dynamic"

type QrPageProps = {
  searchParams: Promise<RawLaunchSearchParams>
}

export default async function QrPage({ searchParams }: QrPageProps) {
  const params = parseLaunchSearchParams(await searchParams)
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  const { setup, readiness } = await loadLaunchSetup(merchant.id)
  const billingHref = resolveLaunchBillingHref(readiness)

  return (
    <div className="grid min-w-0 gap-2 overflow-x-clip sm:gap-6">
      <PageTitle
        eyebrow="Counter poster"
        title="Venue QR"
        description="Your permanent scan code and eight printable A4 counter posters. Share the link anywhere or print a layout."
      />
      <Suspense fallback={<LaunchPanelSkeleton tab="qr" />}>
        <QrPanel
          setup={setup}
          readiness={readiness}
          params={params}
          billingHref={billingHref}
          returnHref={QR_POSTER_PATH}
        />
      </Suspense>
    </div>
  )
}

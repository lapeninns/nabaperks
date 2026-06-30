import { Suspense } from "react"
import { redirect } from "next/navigation"

import { PageTitle } from "@/components/brand"
import { LaunchPanelSkeleton } from "@/components/merchant/loading-skeletons"
import { QrPanel, type QrPanelParams } from "@/components/merchant/launch/qr-panel"
import { getCurrentMerchant } from "@/lib/auth/session"
import { loadLaunchSetup } from "@/lib/merchant/launch-page-model"
import { resolveLaunchBillingHref } from "@/lib/merchant/launch-readiness-core"
import { QR_POSTER_PATH } from "@/lib/merchant/qr-nav"

export const dynamic = "force-dynamic"

type QrPageProps = {
  searchParams: Promise<QrPanelParams>
}

export default async function QrPage({ searchParams }: QrPageProps) {
  const params = await searchParams
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
        description="Your permanent scan code and printable A4 posters. Share the link anywhere or print a layout for the till."
      />
      <Suspense fallback={<LaunchPanelSkeleton tab="qr" />}>
        <QrPanel
          setup={setup}
          readiness={readiness}
          params={params}
          launchReady={readiness.launchReady}
          billingHref={billingHref}
          returnHref={QR_POSTER_PATH}
        />
      </Suspense>
    </div>
  )
}

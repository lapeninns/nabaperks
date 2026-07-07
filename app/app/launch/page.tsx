import Link from "next/link"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { PageTitle } from "@/components/brand"
import { LaunchReadinessPanel } from "@/components/merchant/launch-readiness-panel"
import { BillingPanel } from "@/components/merchant/account/billing-panel"
import { LaunchTransientQueryCleanup } from "@/components/merchant/launch/launch-tab-auto-advance"
import {
  AccountBillingPanelSkeleton,
  LaunchPanelSkeleton,
} from "@/components/merchant/loading-skeletons"
import { CardPanel } from "@/components/merchant/launch/card-panel"
import { QrPanel } from "@/components/merchant/launch/qr-panel"
import { RewardsPanel } from "@/components/merchant/launch/rewards-panel"
import { VenuePanel } from "@/components/merchant/launch/venue-panel"
import { Button } from "@/components/ui/button"
import { getCurrentMerchant } from "@/lib/auth/session"
import { completeBillingCheckoutReturn } from "@/lib/merchant/billing-checkout-return"
import { getLaunchPageModel } from "@/lib/merchant/launch-page-model"
import {
  rewardsContinueLabel,
  type LaunchHubTab,
  type LaunchReadiness,
} from "@/lib/merchant/launch-readiness-core"
import {
  parseLaunchSearchParams,
  type LaunchSearchParams,
  type RawLaunchSearchParams,
} from "@/lib/merchant/launch-search-params"
import { QR_LAUNCH_TAB_PATH } from "@/lib/merchant/qr-nav"
import { type QrSetup } from "@/lib/merchant/qr-code"

export const dynamic = "force-dynamic"

type LaunchPageProps = {
  searchParams: Promise<RawLaunchSearchParams>
}

export default async function LaunchPage({ searchParams }: LaunchPageProps) {
  const params = parseLaunchSearchParams(await searchParams)
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  if (params.checkout === "success") {
    try {
      await completeBillingCheckoutReturn(merchant.id)
    } catch (error) {
      console.error(
        "[launch] billing checkout return sync failed",
        error instanceof Error ? error.message : error
      )
    }
  }

  const {
    setup,
    readiness,
    activeTab,
    needsBilling,
    billingHref,
    continueHref,
    rewardsContinueHref,
    transientCleanHref,
  } = await getLaunchPageModel(merchant.id, params)

  const pageHeading = readiness.launchReady
    ? "You're live"
    : needsBilling
      ? "Your account is created"
      : "Bring your venue to life"

  return (
    <div className="grid min-w-0 gap-2 overflow-x-clip sm:gap-6">
      {/* Stable page-level h1 for mobile, where the visual PageTitle is hidden
          to save space. Without this, the first heading on the card/rewards/
          billing tabs jumped to h2, so the heading level shifted per tab. The
          visible PageTitle h1 (sm+) is the page heading from sm up, so this is
          sm:hidden to keep exactly one page-level h1 at every breakpoint. */}
      <h1 className="sr-only sm:hidden">{pageHeading}</h1>
      <div className="hidden sm:grid">
        <PageTitle
          eyebrow="Merchant setup"
          title={pageHeading}
          description={
            readiness.launchReady
              ? "Customers can scan, join, and collect stamps. Your QR is live below when you need the link."
              : needsBilling
                ? "Your account is created. Proceed to billing to activate your venue and start accepting stamps."
                : `${readiness.total} setup checks and you're live. Create your QR once the earlier steps are done.`
          }
          actions={
            readiness.launchReady ? (
              <Button asChild variant="secondary">
                <Link href="/app/launch?tab=qr">Open venue QR</Link>
              </Button>
            ) : needsBilling ? (
              <Button asChild>
                <Link href={billingHref ?? "/app/launch?tab=billing"}>
                  Proceed to billing
                </Link>
              </Button>
            ) : undefined
          }
        />
      </div>

      <LaunchReadinessPanel
        readiness={readiness}
        showHeader={false}
        activeTab={activeTab}
        variant="full"
      />

      <LaunchTransientQueryCleanup cleanHref={transientCleanHref} />

      <Suspense
        key={activeTab}
        fallback={
          activeTab === "billing" ? (
            <AccountBillingPanelSkeleton />
          ) : (
            <LaunchPanelSkeleton tab={activeTab === "qr" ? "qr" : activeTab} />
          )
        }
      >
        <LaunchActivePanel
          activeTab={activeTab}
          params={params}
          setup={setup}
          readiness={readiness}
          continueHref={continueHref}
          rewardsContinueHref={rewardsContinueHref}
          launchReady={readiness.launchReady}
          needsBillingActivation={needsBilling}
          billingHref={billingHref}
        />
      </Suspense>
    </div>
  )
}

function LaunchActivePanel({
  activeTab,
  params,
  setup,
  readiness,
  continueHref,
  rewardsContinueHref,
  launchReady,
  needsBillingActivation,
  billingHref,
}: {
  activeTab: LaunchHubTab
  params: LaunchSearchParams
  setup: QrSetup
  readiness: LaunchReadiness
  continueHref: string | null
  rewardsContinueHref: string | null
  launchReady: boolean
  needsBillingActivation: boolean
  billingHref: string | null
}) {
  return (
    <div className="grid min-w-0 gap-3 sm:gap-5">
      {activeTab === "card" ? (
        <CardPanel params={params} advanceHref={continueHref} />
      ) : activeTab === "rewards" ? (
        <RewardsPanel
          params={params}
          advanceHref={continueHref}
          continueHref={rewardsContinueHref}
          continueLabel={rewardsContinueLabel(rewardsContinueHref)}
          needsBillingActivation={needsBillingActivation}
          billingHref={billingHref}
        />
      ) : activeTab === "venue" ? (
        <VenuePanel />
      ) : activeTab === "billing" ? (
        <BillingPanel
          params={{ checkout: params.checkout, portal: params.portal }}
          mode="setup"
        />
      ) : (
        <QrPanel
          setup={setup}
          readiness={readiness}
          params={params}
          continueHref={continueHref}
          launchReady={launchReady}
          billingHref={billingHref}
          returnHref={QR_LAUNCH_TAB_PATH}
        />
      )}
    </div>
  )
}

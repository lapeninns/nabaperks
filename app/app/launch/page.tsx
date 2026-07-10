import Link from "next/link"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { PageTitle } from "@/components/brand"
import { BillingPanel } from "@/components/merchant/account/billing-panel"
import type { BillingPanelOutcome } from "@/components/merchant/account/billing-panel-view"
import { LaunchReadinessPanel } from "@/components/merchant/launch-readiness-panel"
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
  resolveLaunchHeaderModel,
  type LaunchHeaderActionTab,
} from "@/lib/merchant/launch-header-copy"
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

  const billingOutcome: BillingPanelOutcome | undefined =
    params.checkout === "success"
      ? await completeBillingCheckoutReturn(merchant.id, params.session_id)
      : undefined

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

  // Heading / context / description / header-CTA are one pure, unit-tested
  // decision (lib/merchant/launch-header-copy) shared with the launch harness so
  // the two never drift and the hierarchy rules live in one place.
  const header = resolveLaunchHeaderModel(readiness, activeTab)
  const headerActions = renderLaunchHeaderAction(header.actionTab, billingHref)

  return (
    <div className="grid min-w-0 gap-2 overflow-x-clip sm:gap-6">
      {/* Mobile setup context — the visual PageTitle is sm+ only, so on a phone
          the readiness rail would otherwise appear with no heading or "what's
          left" line. This carries the single page-level h1 on mobile (sm:hidden);
          the PageTitle h1 takes over from sm up, so exactly one h1 renders per
          breakpoint and the heading level never shifts per tab. */}
      <div className="grid gap-1 sm:hidden">
        <span className="eyebrow">Merchant setup</span>
        <h1 className="text-2xl leading-tight font-extrabold text-balance">
          {header.heading}
        </h1>
        <p className="text-sm leading-6 text-pretty text-muted-foreground">
          {header.mobileContext}
        </p>
      </div>
      <div className="hidden sm:grid">
        <PageTitle
          eyebrow="Merchant setup"
          title={header.heading}
          description={header.description}
          actions={headerActions}
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
          billingOutcome={billingOutcome}
        />
      </Suspense>
    </div>
  )
}

/**
 * The launch header's jump-to-tab CTA. Renders nothing when the pure header
 * model suppresses it (actionTab null) — i.e. when it would point at the tab
 * already on screen, so it never competes with the active panel's primary CTA.
 */
function renderLaunchHeaderAction(
  actionTab: LaunchHeaderActionTab,
  billingHref: string | null
) {
  if (actionTab === "qr") {
    return (
      <Button asChild variant="secondary">
        <Link href={QR_LAUNCH_TAB_PATH}>Open venue QR</Link>
      </Button>
    )
  }

  if (actionTab === "billing") {
    return (
      <Button asChild>
        <Link href={billingHref ?? "/app/launch?tab=billing"}>
          Proceed to billing
        </Link>
      </Button>
    )
  }

  return undefined
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
  billingOutcome,
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
  billingOutcome: BillingPanelOutcome | undefined
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
          params={{
            checkout: params.checkout,
            portal: params.portal,
            session_id: params.session_id,
            billing_error: params.billing_error,
          }}
          mode="setup"
          initialOutcome={billingOutcome}
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

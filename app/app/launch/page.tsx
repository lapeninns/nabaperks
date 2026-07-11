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
import { BillingActivationAssetPreview } from "@/components/merchant/launch/billing-activation-asset-preview"
import { LaunchFlowFooter } from "@/components/merchant/launch/launch-flow-footer"
import { QrPanel } from "@/components/merchant/launch/qr-panel"
import { RewardsPanel } from "@/components/merchant/launch/rewards-panel"
import { VenuePanel } from "@/components/merchant/launch/venue-panel"
import { scheduleMerchantBillingReachedForLaunch } from "@/lib/analytics/merchant-billing-events"
import { getCurrentMerchant } from "@/lib/auth/session"
import { completeBillingCheckoutReturn } from "@/lib/merchant/billing-checkout-return"
import { getLaunchPageModel } from "@/lib/merchant/launch-page-model"
import {
  resolveLaunchFlowCta,
  type LaunchHubTab,
  type LaunchReadiness,
} from "@/lib/merchant/launch-readiness-core"
import { resolveLaunchHeaderModel } from "@/lib/merchant/launch-header-copy"
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
    transientCleanHref,
  } = await getLaunchPageModel(merchant.id, params)

  scheduleMerchantBillingReachedForLaunch({
    merchantId: merchant.id,
    activeTab,
    needsBilling,
  })

  // Heading / context / description / header-CTA are one pure, unit-tested
  // decision (lib/merchant/launch-header-copy) shared with the launch harness so
  // the two never drift and the hierarchy rules live in one place.
  const header = resolveLaunchHeaderModel(readiness, activeTab)

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
          needsBillingActivation={needsBilling}
          billingHref={billingHref}
          billingOutcome={billingOutcome}
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
  needsBillingActivation,
  billingHref,
  billingOutcome,
}: {
  activeTab: LaunchHubTab
  params: LaunchSearchParams
  setup: QrSetup
  readiness: LaunchReadiness
  continueHref: string | null
  needsBillingActivation: boolean
  billingHref: string | null
  billingOutcome: BillingPanelOutcome | undefined
}) {
  return (
    <div className="grid min-w-0 gap-3 sm:gap-5">
      {activeTab === "card" ? (
        <CardPanel params={params} />
      ) : activeTab === "rewards" ? (
        <RewardsPanel
          params={params}
          needsBillingActivation={needsBillingActivation}
        />
      ) : activeTab === "venue" ? (
        <VenuePanel />
      ) : activeTab === "billing" ? (
        needsBillingActivation &&
        setup.location &&
        setup.activeCard &&
        setup.qrCode?.is_active ? (
          <div className="grid min-w-0 items-start gap-3 xl:grid-cols-[minmax(20rem,0.7fr)_minmax(0,1.3fr)] xl:gap-5">
            <BillingActivationAssetPreview
              venueName={setup.merchant?.business_name ?? "Your venue"}
              cardName={setup.activeCard.card_name}
              stampsRequired={setup.activeCard.stamps_required}
              qrCodeId={setup.qrCode.id}
            />
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
          </div>
        ) : (
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
        )
      ) : (
        <QrPanel
          setup={setup}
          readiness={readiness}
          params={params}
          continueHref={continueHref}
          billingHref={billingHref}
          returnHref={QR_LAUNCH_TAB_PATH}
        />
      )}
      <LaunchFlowFooter cta={resolveLaunchFlowCta(activeTab, readiness)} />
    </div>
  )
}

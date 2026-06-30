import Link from "next/link"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { PageTitle } from "@/components/brand"
import { LaunchReadinessPanel } from "@/components/merchant/launch-readiness-panel"
import { BillingPanel } from "@/components/merchant/account/billing-panel"
import { LaunchBillingActivationBanner } from "@/components/merchant/launch/launch-billing-cta"
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
import { ensureJoinQrProvisioned } from "@/lib/merchant/ensure-join-qr"
import {
  buildLaunchReadiness,
  getLaunchBillingReadiness,
  LAUNCH_SETUP_STEP_LABELS,
  needsLaunchBillingActivation,
  resolveLaunchBillingHref,
  type LaunchHubTab,
  type LaunchReadiness,
  type LaunchReadinessTab,
} from "@/lib/merchant/launch-readiness"
import { resolveLaunchContinueHref } from "@/lib/merchant/launch-tab-advance"
import { QR_LAUNCH_TAB_PATH } from "@/lib/merchant/qr-nav"
import { getQrSetupFresh, type QrSetup } from "@/lib/merchant/qr-code"

export const dynamic = "force-dynamic"

const LAUNCH_TABS = [
  { id: "venue", label: LAUNCH_SETUP_STEP_LABELS.venue },
  { id: "card", label: LAUNCH_SETUP_STEP_LABELS.card },
  { id: "rewards", label: LAUNCH_SETUP_STEP_LABELS.rewards },
  { id: "qr", label: LAUNCH_SETUP_STEP_LABELS.qr },
  { id: "billing", label: LAUNCH_SETUP_STEP_LABELS.billing },
] as const satisfies ReadonlyArray<{ id: LaunchHubTab; label: string }>

type LaunchPageProps = {
  searchParams: Promise<{
    tab?: string
    saved?: string
    seeded?: string
    error?: string
    created?: string
    enabled?: string
    disabled?: string
    checkout?: string
    portal?: string
    qr?: string
  }>
}

type LaunchSearchParams = Awaited<LaunchPageProps["searchParams"]>

export default async function LaunchPage({ searchParams }: LaunchPageProps) {
  const params = await searchParams
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  // The setup pipeline and billing readiness are independent (billing keys off
  // the already-resolved session merchant.id), so fetch them together instead
  // of waterfalling billing behind the setup read.
  const [initialSetup, billing] = await Promise.all([
    getQrSetupFresh(),
    getLaunchBillingReadiness(merchant.id),
  ])
  // Reassigned only when the auto-provision side-effect below succeeds and we
  // re-read the now-fresh setup.
  let setup = initialSetup

  let launchReadiness = buildLaunchReadiness({
    activeCard: setup.activeCard,
    activeRewardPoolItemCount: setup.activeRewardPoolItemCount,
    qrCode: setup.qrCode,
    location: setup.location,
    billing,
  })

  if (
    launchReadiness.tabs.venue &&
    launchReadiness.tabs.card &&
    launchReadiness.tabs.rewards &&
    !launchReadiness.tabs.qr &&
    setup.merchant
  ) {
    const { provisioned } = await ensureJoinQrProvisioned({
      merchantId: setup.merchant.id,
      activeCard: setup.activeCard,
      activeRewardPoolItemCount: setup.activeRewardPoolItemCount,
      venueReady: launchReadiness.tabs.venue,
      qrCode: setup.qrCode,
    })

    if (provisioned) {
      setup = await getQrSetupFresh()
      launchReadiness = buildLaunchReadiness({
        activeCard: setup.activeCard,
        activeRewardPoolItemCount: setup.activeRewardPoolItemCount,
        qrCode: setup.qrCode,
        location: setup.location,
        billing,
      })
    }
  }

  const activeRewardPoolItemCount = setup.activeRewardPoolItemCount

  const needsBilling = needsLaunchBillingActivation(launchReadiness)
  const billingHref = resolveLaunchBillingHref(launchReadiness)
  const defaultTab = resolveDefaultTab(
    launchReadiness.launchReady,
    launchReadiness.nextStep?.tab
  )
  const requested = params.tab
  const activeTab: LaunchHubTab = isTabId(requested) ? requested : defaultTab
  const continueHref = resolveLaunchContinueHref(
    activeTab,
    params,
    launchReadiness.checklist,
    { rewardsReady: activeRewardPoolItemCount >= 3 }
  )
  const rewardsContinueHref = resolveRewardsContinueHref(
    launchReadiness,
    activeRewardPoolItemCount
  )
  const transientCleanHref =
    params.saved ||
    params.seeded ||
    params.created ||
    params.enabled ||
    params.disabled ||
    params.qr
      ? `/app/launch?tab=${activeTab}`
      : null

  const pageHeading = launchReadiness.launchReady
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
            launchReadiness.launchReady
              ? "Customers can scan, join, and collect stamps. Your QR is live below when you need the link."
              : needsBilling
                ? "Your account is created. Proceed to billing to activate your venue and start accepting stamps."
                : `${launchReadiness.total} setup checks and you're live. Your QR is created automatically once the earlier steps are done.`
          }
          actions={
            launchReadiness.launchReady ? (
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
        readiness={launchReadiness}
        showHeader={false}
        activeTab={activeTab}
      />

      {needsBilling && activeTab !== "billing" ? (
        <LaunchBillingActivationBanner compact />
      ) : null}

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
          readiness={launchReadiness}
          continueHref={continueHref}
          rewardsContinueHref={rewardsContinueHref}
          launchReady={launchReadiness.launchReady}
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

function resolveRewardsContinueHref(
  launchReadiness: ReturnType<typeof buildLaunchReadiness>,
  activeRewardPoolItemCount: number
): string | null {
  if (activeRewardPoolItemCount < 3) {
    return null
  }

  if (needsLaunchBillingActivation(launchReadiness)) {
    return resolveLaunchBillingHref(launchReadiness)
  }

  if (!launchReadiness.tabs.qr) {
    return "/app/launch?tab=qr"
  }

  return resolveLaunchBillingHref(launchReadiness) ?? "/app/launch?tab=qr"
}

function rewardsContinueLabel(continueHref: string | null): string {
  if (!continueHref) {
    return "the next step"
  }

  if (continueHref.includes("billing")) {
    return "billing"
  }

  if (continueHref.includes("tab=qr")) {
    return "your venue QR"
  }

  return "the next step"
}

function isTabId(value: string | undefined): value is LaunchHubTab {
  return LAUNCH_TABS.some((tab) => tab.id === value)
}

function resolveDefaultTab(
  launchReady: boolean,
  nextTab: LaunchReadinessTab | "billing" | undefined
): LaunchHubTab {
  if (launchReady) {
    return "qr"
  }

  if (nextTab === "billing") {
    return "billing"
  }

  return isReadinessTab(nextTab) ? nextTab : "card"
}

function isReadinessTab(
  value: LaunchReadinessTab | undefined
): value is LaunchReadinessTab {
  return (
    value === "card" ||
    value === "rewards" ||
    value === "venue" ||
    value === "qr"
  )
}

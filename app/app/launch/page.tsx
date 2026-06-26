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
import { ensureJoinQrProvisioned } from "@/lib/merchant/ensure-join-qr"
import {
  buildLaunchReadiness,
  getLaunchBillingReadiness,
  isLaunchBillingReady,
  isLaunchSetupCompleteWithoutQr,
  LAUNCH_SETUP_STEP_LABELS,
  type LaunchHubTab,
  type LaunchReadinessTab,
} from "@/lib/merchant/launch-readiness"
import { resolveLaunchContinueHref } from "@/lib/merchant/launch-tab-advance"
import { getQrSetupFresh } from "@/lib/merchant/qr-code"

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
  }>
}

type LaunchSearchParams = Awaited<LaunchPageProps["searchParams"]>

export default async function LaunchPage({ searchParams }: LaunchPageProps) {
  const params = await searchParams
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  let {
    merchant: setupMerchant,
    activeCard,
    activeRewardPoolItemCount,
    qrCode,
    location,
  } = await getQrSetupFresh()
  const billing = setupMerchant
    ? await getLaunchBillingReadiness(setupMerchant.id)
    : undefined

  let launchReadiness = buildLaunchReadiness({
    activeCard,
    activeRewardPoolItemCount,
    qrCode,
    location,
    billing,
  })

  if (
    isLaunchSetupCompleteWithoutQr(launchReadiness.checklist) &&
    !launchReadiness.tabs.qr &&
    setupMerchant
  ) {
    const { provisioned } = await ensureJoinQrProvisioned({
      merchantId: setupMerchant.id,
      activeCard,
      activeRewardPoolItemCount,
      venueReady: launchReadiness.tabs.venue,
      billingReady: isLaunchBillingReady(billing),
      qrCode,
    })

    if (provisioned) {
      ;({
        merchant: setupMerchant,
        activeCard,
        activeRewardPoolItemCount,
        qrCode,
        location,
      } = await getQrSetupFresh())
      launchReadiness = buildLaunchReadiness({
        activeCard,
        activeRewardPoolItemCount,
        qrCode,
        location,
        billing,
      })
    }
  }

  const needsBilling = launchReadiness.nextStep?.id === "billing"
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
    params.saved || params.seeded || params.created || params.enabled
      ? `/app/launch?tab=${activeTab}`
      : null

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Merchant setup"
        title={
          launchReadiness.launchReady
            ? "You're live"
            : needsBilling
              ? "Add a card to activate"
              : "Bring your venue to life"
        }
        description={
          launchReadiness.launchReady
            ? "Customers can scan, join, and collect stamps. Your QR is live below — print it when you are ready."
            : needsBilling
              ? "Your setup is ready. Add a card through Stripe to activate the venue; the first 30 days are free."
              : `${launchReadiness.total} setup checks and you're live. Your QR is created automatically once the earlier steps are done.`
        }
        actions={
          launchReadiness.launchReady ? (
            <Button asChild variant="secondary">
              <Link href="/app/launch?tab=qr">Open launch kit</Link>
            </Button>
          ) : needsBilling ? (
            <Button asChild>
              <Link href="/app/launch?tab=billing">Add a card</Link>
            </Button>
          ) : undefined
        }
      />

      <LaunchReadinessPanel
        readiness={launchReadiness}
        showHeader={false}
        activeTab={activeTab}
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
          continueHref={continueHref}
          rewardsContinueHref={rewardsContinueHref}
          launchReady={launchReadiness.launchReady}
        />
      </Suspense>
    </div>
  )
}

function LaunchActivePanel({
  activeTab,
  params,
  continueHref,
  rewardsContinueHref,
  launchReady,
}: {
  activeTab: LaunchHubTab
  params: LaunchSearchParams
  continueHref: string | null
  rewardsContinueHref: string | null
  launchReady: boolean
}) {
  return (
    <div className="grid gap-5">
      {activeTab === "card" ? (
        <CardPanel params={params} advanceHref={continueHref} />
      ) : activeTab === "rewards" ? (
        <RewardsPanel
          params={params}
          advanceHref={continueHref}
          continueHref={rewardsContinueHref}
          continueLabel={rewardsContinueLabel(rewardsContinueHref)}
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
          params={params}
          continueHref={continueHref}
          launchReady={launchReady}
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

  return launchReadiness.nextStep?.href ?? "/app/launch?tab=qr"
}

function rewardsContinueLabel(continueHref: string | null): string {
  if (!continueHref) {
    return "the next step"
  }

  if (continueHref.includes("billing")) {
    return "billing"
  }

  if (continueHref.includes("tab=qr")) {
    return "your launch kit"
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

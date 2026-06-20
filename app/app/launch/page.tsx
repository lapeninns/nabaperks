import Link from "next/link"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { PageTitle } from "@/components/brand"
import { LaunchReadinessPanel } from "@/components/merchant/launch-readiness-panel"
import { LaunchPanelSkeleton } from "@/components/merchant/loading-skeletons"
import { CardPanel } from "@/components/merchant/launch/card-panel"
import { QrPanel } from "@/components/merchant/launch/qr-panel"
import { RewardsPanel } from "@/components/merchant/launch/rewards-panel"
import { VenuePanel } from "@/components/merchant/launch/venue-panel"
import { Button } from "@/components/ui/button"
import { getCurrentMerchant } from "@/lib/auth/session"
import {
  buildLaunchReadiness,
  LAUNCH_SETUP_STEP_LABELS,
  type LaunchReadinessTab,
} from "@/lib/merchant/launch-readiness"
import { getQrSetup } from "@/lib/merchant/qr-code"

export const dynamic = "force-dynamic"

const LAUNCH_TABS = [
  { id: "card", label: LAUNCH_SETUP_STEP_LABELS.card },
  { id: "rewards", label: LAUNCH_SETUP_STEP_LABELS.rewards },
  { id: "venue", label: LAUNCH_SETUP_STEP_LABELS.venue },
  { id: "qr", label: LAUNCH_SETUP_STEP_LABELS.qr },
] as const satisfies ReadonlyArray<{ id: LaunchReadinessTab; label: string }>

type LaunchPageProps = {
  searchParams: Promise<{
    tab?: string
    saved?: string
    error?: string
    created?: string
    enabled?: string
    disabled?: string
  }>
}

type LaunchSearchParams = Awaited<LaunchPageProps["searchParams"]>

export default async function LaunchPage({ searchParams }: LaunchPageProps) {
  const params = await searchParams
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  const { activeCard, activeRewardPoolItemCount, qrCode, location } =
    await getQrSetup()

  const launchReadiness = buildLaunchReadiness({
    activeCard,
    activeRewardPoolItemCount,
    qrCode,
    location,
  })

  // Live merchants land on their launch kit; everyone else opens the next
  // unfinished step. An explicit `?tab=` always wins so deep links stay stable.
  const defaultTab: LaunchReadinessTab = launchReadiness.launchReady
    ? "qr"
    : (launchReadiness.nextStep?.tab ?? "card")
  const requested = params.tab
  const activeTab: LaunchReadinessTab = isTabId(requested)
    ? requested
    : defaultTab

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Merchant setup"
        title={
          launchReadiness.launchReady
            ? "You're live"
            : "Bring your venue to life"
        }
        description={
          launchReadiness.launchReady
            ? "Customers can scan, join, and collect stamps. Your launch kit is below, with the bits you can still adjust."
            : "Four setup steps and you're live. We always point you at what's left."
        }
        actions={
          launchReadiness.launchReady ? (
            <Button asChild variant="secondary">
              <Link href="/app/launch?tab=qr">Open launch kit</Link>
            </Button>
          ) : undefined
        }
      />

      <LaunchReadinessPanel
        readiness={launchReadiness}
        showHeader={false}
        activeTab={activeTab}
      />

      {/* Keyed by tab so each tab switch re-suspends and streams only the panel
          body — the title and readiness spine above stay put. */}
      <Suspense
        key={activeTab}
        fallback={<LaunchPanelSkeleton tab={activeTab} />}
      >
        <LaunchActivePanel activeTab={activeTab} params={params} />
      </Suspense>
    </div>
  )
}

function LaunchActivePanel({
  activeTab,
  params,
}: {
  activeTab: LaunchReadinessTab
  params: LaunchSearchParams
}) {
  return (
    <div className="grid gap-5">
      {activeTab === "card" ? (
        <CardPanel params={params} />
      ) : activeTab === "rewards" ? (
        <RewardsPanel params={params} />
      ) : activeTab === "venue" ? (
        <VenuePanel />
      ) : (
        <QrPanel params={params} />
      )}
    </div>
  )
}

function isTabId(value: string | undefined): value is LaunchReadinessTab {
  return LAUNCH_TABS.some((tab) => tab.id === value)
}

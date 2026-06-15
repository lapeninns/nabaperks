import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ArrowRight02Icon,
  CheckmarkBadge04Icon,
} from "@hugeicons/core-free-icons"

import { Icon, PageTitle } from "@/components/brand"
import { LaunchReadinessPanel } from "@/components/merchant/launch-readiness-panel"
import { CardPanel } from "@/components/merchant/launch/card-panel"
import { QrPanel } from "@/components/merchant/launch/qr-panel"
import { VenuePanel } from "@/components/merchant/launch/venue-panel"
import { Button } from "@/components/ui/button"
import { getCurrentMerchant } from "@/lib/auth/session"
import {
  buildLaunchReadiness,
  type LaunchReadinessStep,
} from "@/lib/merchant/launch-readiness"
import { getQrSetup } from "@/lib/merchant/qr-code"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

const TABS = [
  { id: "card", label: "Your card and reward" },
  { id: "venue", label: "Your venue" },
  { id: "qr", label: "Print your QR" },
] as const

type TabId = (typeof TABS)[number]["id"]

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
  const defaultTab: TabId = launchReadiness.launchReady
    ? "qr"
    : (launchReadiness.nextStep?.tab ?? "card")
  const requested = params.tab
  const activeTab: TabId = isTabId(requested) ? requested : defaultTab

  const activePanel =
    activeTab === "card" ? (
      <CardPanel params={params} />
    ) : activeTab === "venue" ? (
      <VenuePanel />
    ) : (
      <QrPanel params={params} />
    )

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
            ? "Customers can scan, join, and collect. Your launch kit is below, with the bits you can still adjust."
            : "Four stamps and you're live. We always point you at the one thing left to do."
        }
        actions={
          launchReadiness.launchReady ? (
            <Button asChild variant="secondary">
              <Link href="/app/launch?tab=qr">Open launch kit</Link>
            </Button>
          ) : undefined
        }
      />

      <LaunchReadinessPanel readiness={launchReadiness} showHeader={false} />

      <div className="grid gap-3">
        {launchReadiness.steps.map((step, index) => {
          const firstOfTab = launchReadiness.steps.findIndex(
            (candidate) => candidate.tab === step.tab
          )

          if (step.tab === activeTab) {
            // The active step expands into its full panel, rendered once even
            // when two steps (card + reward) share the same destination tab.
            return index === firstOfTab ? (
              <div key={step.tab} className="grid gap-5">
                {activePanel}
              </div>
            ) : null
          }

          return <LaunchStepRow key={step.id} index={index} step={step} />
        })}
      </div>
    </div>
  )
}

/** A collapsed step in the launch rail — one line that deep-links to its tab. */
function LaunchStepRow({
  index,
  step,
}: {
  index: number
  step: LaunchReadinessStep
}) {
  return (
    <Link
      href={step.href}
      aria-label={`${step.label} — ${step.ready ? "ready" : "to do"}`}
      className={cn(
        "group flex items-center gap-3 rounded-lg border-2 bg-card px-4 py-3 shadow-xs transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/35",
        step.ready ? "border-ink" : "border-dashed border-ink/35"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-8 flex-none place-items-center rounded-full border-2",
          step.ready
            ? "border-ink bg-stamp text-stamp-foreground"
            : "border-dashed border-ink/40 bg-background font-mono text-sm font-bold text-muted-foreground"
        )}
      >
        {step.ready ? (
          <Icon icon={CheckmarkBadge04Icon} size={16} strokeWidth={2.5} />
        ) : (
          index + 1
        )}
      </span>
      <span className="grid flex-1 gap-0.5">
        <span className="text-sm font-extrabold">{step.label}</span>
        <span className="text-xs leading-5 text-muted-foreground">
          {step.summary}
        </span>
      </span>
      <Icon
        icon={ArrowRight02Icon}
        size={18}
        className="flex-none text-muted-foreground transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  )
}

function isTabId(value: string | undefined): value is TabId {
  return TABS.some((tab) => tab.id === value)
}

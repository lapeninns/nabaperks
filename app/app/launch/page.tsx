import Link from "next/link"
import { redirect } from "next/navigation"

import { MonoTag, PageTitle } from "@/components/brand"
import { CardPanel } from "@/components/merchant/launch/card-panel"
import { QrPanel } from "@/components/merchant/launch/qr-panel"
import { StaffPanel } from "@/components/merchant/launch/staff-panel"
import { getCurrentMerchant } from "@/lib/auth/session"
import { buildLaunchReadiness } from "@/lib/merchant/launch-readiness"
import { getQrSetup } from "@/lib/merchant/qr-code"
import { listStaffMembers } from "@/lib/merchant/staff-members"
import { listStations } from "@/lib/merchant/stations"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

const TABS = [
  { id: "card", label: "Card & rewards" },
  { id: "staff", label: "Staff & station" },
  { id: "qr", label: "QR & print" },
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

  // Readiness drives the per-tab status chips and the default tab. Panels fetch
  // their own detailed data; this summary mirrors the QR launch gate.
  const [
    { activeCard, activeRewardPoolItemCount, qrCode },
    staffMembers,
    stations,
  ] = await Promise.all([getQrSetup(), listStaffMembers(), listStations()])

  const launchReadiness = buildLaunchReadiness({
    activeCard,
    activeRewardPoolItemCount,
    qrCode,
    staffMembers,
    stations,
  })
  const ready = launchReadiness.tabs
  const completed = Object.values(ready).filter(Boolean).length
  const firstIncomplete = launchReadiness.nextStep?.tab ?? "card"
  const requested = params.tab
  const activeTab: TabId = isTabId(requested) ? requested : firstIncomplete

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Merchant setup"
        title="Launch checklist"
        description="Everything to go live, in one place: build the card, set up who stamps and where, then generate and print the venue QR."
        actions={
          <MonoTag tone={completed === TABS.length ? "leaf" : "ink"}>
            {completed} of {TABS.length} ready
          </MonoTag>
        }
      />

      <nav
        aria-label="Launch steps"
        className="flex flex-wrap gap-1 rounded-full border-2 border-ink bg-card p-1"
      >
        {TABS.map((tab, index) => {
          const active = tab.id === activeTab

          return (
            <Link
              key={tab.id}
              href={`/app/launch?tab=${tab.id}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-bold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/35",
                active
                  ? "bg-ink text-paper"
                  : "text-ink-soft hover:bg-accent hover:text-foreground"
              )}
            >
              <span className="font-mono text-xs">{index + 1}</span>
              <span>{tab.label}</span>
              <span
                aria-hidden
                className={cn(
                  "size-2 rounded-full",
                  ready[tab.id]
                    ? "bg-reward"
                    : active
                      ? "bg-paper/50"
                      : "bg-ink/30"
                )}
              />
            </Link>
          )
        })}
      </nav>

      {activeTab === "card" ? (
        <CardPanel params={params} />
      ) : activeTab === "staff" ? (
        <StaffPanel />
      ) : (
        <QrPanel params={params} />
      )}
    </div>
  )
}

function isTabId(value: string | undefined): value is TabId {
  return TABS.some((tab) => tab.id === value)
}

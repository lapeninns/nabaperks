import Link from "next/link"
import {
  ArrowRight02Icon,
  CheckmarkBadge04Icon,
  Download01Icon,
  PrinterIcon,
} from "@hugeicons/core-free-icons"

import { Icon, PageTitle } from "@/components/brand"
import { QrFrame } from "@/components/loyalty/qr-frame"
import { RewardSeal } from "@/components/loyalty/reward-seal"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { LaunchReadinessPanel } from "@/components/merchant/launch-readiness-panel"
import { Disclosure } from "@/components/merchant/launch/disclosure"
import { LoyaltyCardForm } from "@/components/merchant/loyalty-card-form"
import { VenueLocationForm } from "@/components/merchant/launch/venue-location-form"
import { Button } from "@/components/ui/button"
import {
  LAUNCH_PREVIEW_MOCK,
  launchPreviewState,
  mockLaunchReadiness,
  type LaunchPreviewStateId,
} from "@/lib/dev/launch-preview"
import type { LaunchReadinessStep } from "@/lib/merchant/launch-readiness"
import { cn } from "@/lib/utils"

/**
 * Dev-only screenshot harness for the redesigned launch hub. Renders the real
 * spine and forms against mock props (the QR step is a layout mirror, since the
 * live panel reads Supabase). Kept visually identical to `app/app/launch/page`.
 */
export function LaunchPreviewScreen({
  stateId,
}: {
  stateId: LaunchPreviewStateId
}) {
  const state = launchPreviewState(stateId)
  const readiness = mockLaunchReadiness(state.flags)
  const activeTab = state.activeTab

  const activePanel =
    activeTab === "card" ? (
      <MockCardPanel />
    ) : activeTab === "venue" ? (
      <MockVenuePanel />
    ) : (
      <MockQrKit />
    )

  return (
    <div className="mx-auto grid max-w-[1060px] gap-6 p-6">
      <PageTitle
        eyebrow="Merchant setup"
        title={
          readiness.launchReady ? "You're live" : "Bring your venue to life"
        }
        description={
          readiness.launchReady
            ? "Customers can scan, join, and collect. Your launch kit is below, with the bits you can still adjust."
            : "Four stamps and you're live. We always point you at the one thing left to do."
        }
        actions={
          readiness.launchReady ? (
            <Button asChild variant="secondary">
              <Link href="/app/launch?tab=qr">Open launch kit</Link>
            </Button>
          ) : undefined
        }
      />

      <LaunchReadinessPanel readiness={readiness} showHeader={false} />

      <div className="grid gap-3">
        {readiness.steps.map((step, index) => {
          const firstOfTab = readiness.steps.findIndex(
            (candidate) => candidate.tab === step.tab
          )

          if (step.tab === activeTab) {
            return index === firstOfTab ? (
              <div key={step.tab} className="grid gap-5">
                {activePanel}
              </div>
            ) : null
          }

          return <PreviewStepRow key={step.id} index={index} step={step} />
        })}
      </div>
    </div>
  )
}

function PreviewStepRow({
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

function MockCardPanel() {
  return (
    <div className="grid gap-5">
      <LoyaltyCardForm
        merchantName={LAUNCH_PREVIEW_MOCK.merchantName}
        locationName={LAUNCH_PREVIEW_MOCK.locationName}
        initialValues={{
          cardId: "card-mock-1",
          cardName: LAUNCH_PREVIEW_MOCK.cardName,
          stampsRequired: String(LAUNCH_PREVIEW_MOCK.stampsRequired),
          rewardTerms: LAUNCH_PREVIEW_MOCK.rewardTerms,
          minSpendPence: "",
          isActive: true,
        }}
        rewardPoolItems={[
          {
            id: "reward-mock-1",
            rewardName: "Free filter coffee",
            rewardTerms:
              "Any filter coffee on the house. Valid from the next UK business day.",
            minSpendPence: "",
            weight: "1",
            displayOrder: "1",
            isActive: false,
          },
        ]}
      />
    </div>
  )
}

function MockVenuePanel() {
  return (
    <div className="grid max-w-2xl gap-4">
      <VenueLocationForm
        initialValues={{
          venueName: LAUNCH_PREVIEW_MOCK.locationName,
          addressLine1: "1 High Street",
          addressLine2: "",
          addressCity: "London",
          addressPostcode: "E1 6AN",
          geofenceRadiusMeters: "150",
          requireGeofence: false,
        }}
        geocoded={{ latitude: 51.5155, longitude: -0.0722 }}
      />
    </div>
  )
}

function MockQrKit() {
  return (
    <div className="grid gap-5">
      <div className="grid gap-6 rounded-lg border-2 border-ink bg-card p-6 shadow-md lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="grid h-fit content-start gap-4">
          <QrFrame label="Scanner-safe QR code preview">
            <MockQrGlyph />
          </QrFrame>
          <div className="flex items-center gap-3 rounded-lg border-2 border-reward bg-reward/10 px-3 py-2">
            <RewardSeal state="redeemed" size="sm" label="QR is live" />
            <span className="font-mono text-xs font-bold tracking-[0.06em] text-reward uppercase">
              Live · accepting scans
            </span>
          </div>
        </div>

        <div className="grid content-start gap-5">
          <PageTitle
            eyebrow="Step 4 · Print"
            title={LAUNCH_PREVIEW_MOCK.cardName}
            description="Customers scan this permanent code to join, collect today's stamp, and unlock a surprise reward."
            titleClassName="sm:text-3xl"
          />

          <div className="grid gap-2 rounded-lg border-2 border-ink bg-secondary/50 p-4">
            <p className="text-sm font-bold">Shareable URL</p>
            <p className="font-mono text-sm break-all text-muted-foreground">
              {LAUNCH_PREVIEW_MOCK.shareUrl}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary">Copy link</Button>
              <Button variant="outline">Open URL</Button>
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border-2 border-ink bg-background p-4">
            <div className="flex items-center gap-2">
              <Icon icon={PrinterIcon} size={18} />
              <p className="text-sm font-extrabold">Print the counter poster</p>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              A4 print piece for tills, tables, and entrance boards. Put it
              where customers pay, then scan it once yourself before the first
              customer.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button>
                <Icon icon={Download01Icon} size={16} />
                Download poster
              </Button>
              <Button variant="outline">Preview poster</Button>
            </div>
          </div>

          <Disclosure label="More print assets">
            <p className="text-xs leading-5 text-muted-foreground">
              Same QR, smaller formats for tills and windows — till card PNG and
              sticker PNG.
            </p>
          </Disclosure>

          <Disclosure label="How customers use this">
            <ol className="grid list-decimal gap-2 pl-5 text-sm leading-6 text-muted-foreground">
              <li>New customers scan the QR and join with their phone.</li>
              <li>
                Existing customers scan and tap to add today&apos;s stamp.
              </li>
              <li>On the final visit the reward unseals.</li>
            </ol>
          </Disclosure>

          <Button variant="outline" className="w-fit">
            Disable QR
          </Button>
        </div>
      </div>

      <StatusBanner tone="success" title="QR code enabled.">
        The permanent <code>/q/{"{qr_id}"}</code> resolver, share URL, and
        downloads remain unchanged.
      </StatusBanner>
    </div>
  )
}

/** A static QR-looking glyph so the print step screenshots convincingly. */
function MockQrGlyph() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="aspect-square w-full rounded-lg bg-white"
      role="img"
      aria-label="QR code placeholder"
    >
      <rect width="100" height="100" fill="#ffffff" />
      <g fill="#111111">
        <path d="M8 8h22v22H8zM14 14v10h10V14z" />
        <path d="M70 8h22v22H70zM76 14v10h10V14z" />
        <path d="M8 70h22v22H8zM14 76v10h10V76z" />
        <rect x="40" y="10" width="6" height="6" />
        <rect x="52" y="10" width="6" height="6" />
        <rect x="40" y="22" width="6" height="6" />
        <rect x="58" y="40" width="6" height="6" />
        <rect x="46" y="46" width="6" height="6" />
        <rect x="70" y="46" width="6" height="6" />
        <rect x="82" y="52" width="6" height="6" />
        <rect x="40" y="58" width="6" height="6" />
        <rect x="52" y="64" width="6" height="6" />
        <rect x="70" y="70" width="6" height="6" />
        <rect x="82" y="76" width="6" height="6" />
        <rect x="64" y="82" width="6" height="6" />
        <rect x="46" y="82" width="6" height="6" />
      </g>
    </svg>
  )
}

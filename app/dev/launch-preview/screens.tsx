import Link from "next/link"
import { Download01Icon, PrinterIcon } from "@hugeicons/core-free-icons"

import { Icon, PageTitle } from "@/components/brand"
import { QrFrame } from "@/components/loyalty/qr-frame"
import { RewardSeal } from "@/components/loyalty/reward-seal"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { LaunchReadinessPanel } from "@/components/merchant/launch-readiness-panel"
import { Disclosure } from "@/components/merchant/launch/disclosure"
import {
  LoyaltyCardForm,
  RewardPoolForm,
} from "@/components/merchant/loyalty-card-form"
import { VenueLocationForm } from "@/components/merchant/launch/venue-location-form"
import { Button } from "@/components/ui/button"
import {
  LAUNCH_PREVIEW_MOCK,
  launchPreviewState,
  mockLaunchReadiness,
  type LaunchPreviewStateId,
} from "@/lib/dev/launch-preview"
import { DEFAULT_REWARD_POOL_ITEMS } from "@/lib/merchant/default-reward-pool"

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
    ) : activeTab === "rewards" ? (
      <MockRewardsPanel />
    ) : activeTab === "billing" ? (
      <MockBillingPanel />
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
            ? "Customers can scan, join, and collect stamps. Your launch kit is below, with the bits you can still adjust."
            : `${readiness.total} setup checks and you're live. We always point you at what's left.`
        }
        actions={
          readiness.launchReady ? (
            <Button asChild variant="secondary">
              <Link href="/app/launch?tab=qr">Open launch kit</Link>
            </Button>
          ) : undefined
        }
      />

      <LaunchReadinessPanel
        readiness={readiness}
        showHeader={false}
        activeTab={activeTab}
      />

      <div className="grid gap-5">{activePanel}</div>
    </div>
  )
}

/**
 * Named venue-geofence scenarios for the agent browser proof. `geofence-on`
 * renders the draggable pin map (require_geofence true + Old Crown Girton pilot
 * coordinates 52.2425913, 0.0814946 + radius 100); `geofence-off` renders the
 * same form with the map suppressed. The pin starts as `geocoded` so a drag can
 * be proven to flip the hidden source to `merchant_pin`.
 */
export function VenueGeofenceScenarioPreview({
  scenario,
}: {
  scenario: "geofence-on" | "geofence-off"
}) {
  const requireGeofence = scenario === "geofence-on"

  return (
    <div className="mx-auto grid max-w-2xl gap-4 p-6">
      <VenueLocationForm
        initialValues={{
          venueName: LAUNCH_PREVIEW_MOCK.merchantName,
          addressLine1: "High Street",
          addressLine2: "",
          addressCity: "Girton",
          addressPostcode: "CB3 0QH",
          geofenceRadiusMeters: "100",
          requireGeofence,
        }}
        geocoded={{ latitude: 52.2425913, longitude: 0.0814946 }}
        pinSource="geocoded"
      />
    </div>
  )
}

function MockCardPanel() {
  return (
    <div className="grid gap-5">
      <LoyaltyCardForm
        merchantName={LAUNCH_PREVIEW_MOCK.merchantName}
        locationName={LAUNCH_PREVIEW_MOCK.locationName}
        activeRewardCount={DEFAULT_REWARD_POOL_ITEMS.length}
        initialValues={{
          cardId: "card-mock-1",
          cardName: LAUNCH_PREVIEW_MOCK.cardName,
          stampsRequired: String(LAUNCH_PREVIEW_MOCK.stampsRequired),
          rewardTerms: LAUNCH_PREVIEW_MOCK.rewardTerms,
          isActive: true,
        }}
      />
    </div>
  )
}

function MockRewardsPanel() {
  return (
    <div className="grid gap-5">
      <RewardPoolForm
        loyaltyCardId="card-mock-1"
        cardName={LAUNCH_PREVIEW_MOCK.cardName}
        continueHref="/app/launch?tab=qr"
        continueLabel="your launch kit"
        rewardPoolItems={DEFAULT_REWARD_POOL_ITEMS.map((item, index) => ({
          id: `reward-mock-${index + 1}`,
          rewardName: item.rewardName,
          rewardTerms: item.rewardTerms,
          weight: String(item.weight),
          displayOrder: String(item.displayOrder),
          isActive: item.isActive,
        }))}
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

function MockBillingPanel() {
  return (
    <div className="grid gap-5">
      <div className="surface-card grid gap-5 p-6">
        <PageTitle
          eyebrow="Step 5 of 5 · Billing"
          title="Add a card to activate"
          description="This is the final setup step. Start checkout to add your card and activate the 30-day free trial."
          titleClassName="sm:text-3xl"
        />
        <dl className="grid gap-0 text-sm">
          <MockPlanRow label="Free trial" value="30 days" />
          <MockPlanRow label="Then" value="GBP 29 / month" />
          <MockPlanRow label="Billed" value="Per location" />
        </dl>
        <p className="rounded-lg bg-secondary px-4 py-3 text-sm leading-6 text-secondary-foreground">
          A card is required before you go live. Stripe starts the subscription
          with 30 days free, then billing begins after the trial.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button>Start checkout</Button>
          <Button variant="secondary" disabled>
            Open Stripe portal
          </Button>
        </div>
      </div>
    </div>
  )
}

function MockPlanRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-dashed border-ink/15 py-2.5 last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-bold">{value}</dd>
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

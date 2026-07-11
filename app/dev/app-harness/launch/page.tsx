import Link from "next/link"
import { notFound } from "next/navigation"

import { PageTitle } from "@/components/brand"
import { SetupBillingActivationCard } from "@/components/merchant/account/billing-activation-card"
import { LaunchReadinessPanel } from "@/components/merchant/launch-readiness-panel"
import { BirthdayRewardPanel } from "@/components/merchant/launch/birthday-panel"
import { BillingActivationAssetPreview } from "@/components/merchant/launch/billing-activation-asset-preview"
import { birthdayRewardTemplateForBusinessType } from "@/lib/merchant/birthday-reward-template"
import {
  LoyaltyCardForm,
  RewardPoolForm,
  type RewardPoolItemValues,
} from "@/components/merchant/loyalty-card-form"
import { QrPanelLive } from "@/components/merchant/launch/qr-panel-live"
import { VenueLocationForm } from "@/components/merchant/launch/venue-location-form"
import { Button } from "@/components/ui/button"
import { buildLaunchReadiness } from "@/lib/merchant/launch-readiness"
import type { LaunchHubTab } from "@/lib/merchant/launch-readiness"
import { resolveLaunchHeaderModel } from "@/lib/merchant/launch-header-copy"
import {
  CARD_CADENCE_PRESETS,
  rewardPresetsForBusinessType,
} from "@/lib/merchant/reward-presets"

import { HARNESS_MERCHANT } from "../fixtures"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const LOCATION_NAME = "Old Crown Girton"

/**
 * Launch (Setup) harness — variant "setup" (no sidebar/tab-bar; the setup shell
 * header instead). The real {@link LaunchReadinessPanel} renders above the
 * active tab, then each tab mounts the REAL presentational seam the live panel
 * renders (the async panels self-fetch, so their client children are mounted
 * directly with DB-free fixtures):
 *   - venue   → {@link VenueLocationForm}
 *   - card    → {@link LoyaltyCardForm}
 *   - rewards → {@link RewardPoolForm}
 *   - qr      → {@link QrPanelLive}
 */
export default async function LaunchHarnessPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; state?: string; pool?: string }>
}) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const params = searchParams ? await searchParams : {}
  const activeTab = resolveTab(params.tab)
  // Header-state selector so the needsBilling + launchReady header copy and the
  // jump-CTA suppression render DB-free:
  //   default → QR not live, billing pending (nextStep = qr — the mixed rail the
  //             launch specs pin);
  //   billing → QR live, billing the only pending step (needsBilling);
  //   live    → QR live + billing not required (launchReady).
  const state =
    params.state === "billing" || params.state === "live"
      ? params.state
      : "default"
  const rewardPoolItems = resolveHarnessRewardPool(params.pool)
  const activeRewardPoolItemCount = rewardPoolItems.filter(
    (item) => item.isActive
  ).length

  const readiness = buildLaunchReadiness({
    activeCard: {
      id: "card_harness",
      card_name: "Mystery Visit Card",
      reward_name: "Mystery reward",
      stamps_required: 3,
    },
    activeRewardPoolItemCount,
    qrCode: {
      id: "qr_harness",
      qr_id: "old-crown-girton",
      destination_type: "join",
      is_active: state !== "default",
    },
    location: {
      id: "loc_harness",
      name: LOCATION_NAME,
      address: "12 High Street, Girton, Cambridge, CB3 0QH",
      latitude: 52.2399,
      longitude: 0.0826,
      geofence_radius_meters: 150,
      require_geofence: false,
      geocoded_at: "2026-06-20T10:00:00.000Z",
    },
    billing: { requiresBilling: state !== "live", status: null },
  })

  // Heading / context / description / header-CTA come from the same pure helper
  // the real /app/launch uses, so the harness header stays faithful to it.
  const header = resolveLaunchHeaderModel(readiness, activeTab)

  return (
    <div className="grid min-w-0 gap-2 overflow-x-clip sm:gap-6">
      {/* Mirrors /app/launch: visible mobile setup context above the rail. */}
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
          actions={
            header.actionTab === "qr" ? (
              <Button asChild variant="secondary">
                <Link href="/app/launch?tab=qr">Open venue QR</Link>
              </Button>
            ) : header.actionTab === "billing" ? (
              <Button asChild>
                <Link href="/app/launch?tab=billing">Proceed to billing</Link>
              </Button>
            ) : undefined
          }
        />
      </div>

      <LaunchReadinessPanel
        readiness={readiness}
        showHeader={false}
        activeTab={activeTab}
      />

      <div className="grid min-w-0 gap-3 sm:gap-5">
        {activeTab === "card" ? (
          <LoyaltyCardForm
            merchantName={HARNESS_MERCHANT.business_name}
            activeRewardCount={activeRewardPoolItemCount}
            initialValues={{
              cardId: "card_harness",
              cardName: "Mystery Visit Card",
              stampsRequired: "3",
              rewardTerms: "A surprise reward on the house after 3 visits.",
              isActive: true,
            }}
            cadencePresets={CARD_CADENCE_PRESETS}
          />
        ) : activeTab === "rewards" ? (
          <div className="grid min-w-0 gap-3 sm:gap-5">
            <RewardPoolForm
              loyaltyCardId="card_harness"
              cardName="Mystery Visit Card"
              rewardPoolItems={rewardPoolItems}
              continueHref="/app/launch?tab=qr"
              continueLabel="your venue QR"
              presets={rewardPresetsForBusinessType("pub")}
            />
            <BirthdayRewardPanel
              loyaltyCardId="card_harness"
              enabled={false}
              rewardName={null}
              rewardTerms={null}
              template={birthdayRewardTemplateForBusinessType("pub")}
            />
          </div>
        ) : activeTab === "qr" ? (
          <QrPanelLive
            activeCardName="Mystery Visit Card"
            qrCodeId="qr_harness"
            isActive={readiness.tabs.qr}
            scansAvailable={readiness.launchReady}
            shareUrl="https://nabaperks.com/q/old-crown-girton"
            hasVenueAddress
            returnHref="/app/launch?tab=qr"
          />
        ) : activeTab === "billing" ? (
          <div className="grid min-w-0 items-start gap-3 xl:grid-cols-[minmax(20rem,0.7fr)_minmax(0,1.3fr)] xl:gap-5">
            {state === "billing" ? (
              <BillingActivationAssetPreview
                venueName={LOCATION_NAME}
                cardName="Mystery Visit Card"
                stampsRequired={3}
                qrCodeId="qr_harness"
              />
            ) : null}
            <SetupBillingActivationCard
              annualBillingAvailable
              billingReturnTo="/app/launch?tab=billing"
            />
          </div>
        ) : (
          <VenueLocationForm
            initialValues={{
              addressLine1: "12 High Street",
              addressLine2: "",
              addressCity: "Girton, Cambridge",
              addressPostcode: "CB3 0QH",
              geofenceRadiusMeters: "150",
              requireGeofence: false,
            }}
            geocoded={{ latitude: 52.2399, longitude: 0.0826 }}
            pinSource="geocoded"
          />
        )}
      </div>
    </div>
  )
}

function resolveTab(value: string | undefined): LaunchHubTab {
  if (
    value === "venue" ||
    value === "card" ||
    value === "rewards" ||
    value === "qr" ||
    value === "billing"
  ) {
    return value
  }
  return "card"
}

const READY_REWARD_POOL: readonly RewardPoolItemValues[] = [
  {
    id: "rwd_1",
    rewardName: "Free hot drink",
    rewardTerms: "Any size, on the house.",
    weight: "3",
    displayOrder: "1",
    isActive: true,
  },
  {
    id: "rwd_2",
    rewardName: "Slice of cake",
    rewardTerms: "Pick from the counter selection.",
    weight: "2",
    displayOrder: "2",
    isActive: true,
  },
  {
    id: "rwd_3",
    rewardName: "10% off the bill",
    rewardTerms: "One visit, food only.",
    weight: "1",
    displayOrder: "3",
    isActive: true,
  },
]

function resolveHarnessRewardPool(
  state: string | undefined
): RewardPoolItemValues[] {
  if (state === "empty") return []
  if (state === "two")
    return READY_REWARD_POOL.slice(0, 2).map((item) => ({ ...item }))
  if (state === "existing") {
    return [
      {
        id: "rwd_existing_free_starter",
        rewardName: "Free starter",
        rewardTerms:
          "One starter up to GBP 8 with any main meal. Valid once issued.",
        weight: "1",
        displayOrder: "1",
        isActive: true,
      },
    ]
  }

  return READY_REWARD_POOL.map((item) => ({ ...item }))
}

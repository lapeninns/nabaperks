import Link from "next/link"
import { notFound } from "next/navigation"

import { PageTitle } from "@/components/brand"
import { LaunchReadinessPanel } from "@/components/merchant/launch-readiness-panel"
import { LoyaltyCardForm, RewardPoolForm } from "@/components/merchant/loyalty-card-form"
import { QrPanelLive } from "@/components/merchant/launch/qr-panel-live"
import { VenueLocationForm } from "@/components/merchant/launch/venue-location-form"
import { Button } from "@/components/ui/button"
import { buildLaunchReadiness } from "@/lib/merchant/launch-readiness"
import type { LaunchHubTab } from "@/lib/merchant/launch-readiness"
import {
  CARD_CADENCE_PRESETS,
  PUB_REWARD_PRESETS,
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
  searchParams?: Promise<{ tab?: string }>
}) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const params = searchParams ? await searchParams : {}
  const activeTab = resolveTab(params.tab)

  // Pure, DB-free readiness: venue+card+rewards ready, QR not yet live, billing
  // pending — exercises the readiness rail's mixed done/pending stamp states.
  const readiness = buildLaunchReadiness({
    activeCard: {
      id: "card_harness",
      card_name: "Mystery Visit Card",
      reward_name: "Mystery reward",
      stamps_required: 3,
    },
    activeRewardPoolItemCount: 3,
    qrCode: {
      id: "qr_harness",
      qr_id: "old-crown-girton",
      destination_type: "join",
      is_active: false,
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
    billing: { requiresBilling: true, status: null },
  })

  return (
    <div className="grid min-w-0 gap-2 overflow-x-clip sm:gap-6">
      <h1 className="sr-only sm:hidden">Bring your venue to life</h1>
      <div className="hidden sm:grid">
        <PageTitle
          eyebrow="Merchant setup"
          title="Bring your venue to life"
          description={`${readiness.total} setup checks and you're live. Create your QR once the earlier steps are done.`}
          actions={
            <Button asChild variant="secondary">
              <Link href="/app/launch?tab=qr">Open venue QR</Link>
            </Button>
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
            locationName={LOCATION_NAME}
            activeRewardCount={3}
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
          <RewardPoolForm
            loyaltyCardId="card_harness"
            cardName="Mystery Visit Card"
            rewardPoolItems={[
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
            ]}
            continueHref="/app/launch?tab=qr"
            continueLabel="your venue QR"
            presets={PUB_REWARD_PRESETS}
          />
        ) : activeTab === "qr" ? (
          <QrPanelLive
            activeCardName="Mystery Visit Card"
            qrCodeId="qr_harness"
            isActive
            shareUrl="https://nabaperks.com/q/old-crown-girton"
            hasVenueAddress
            returnHref="/app/launch?tab=qr"
          />
        ) : (
          <VenueLocationForm
            initialValues={{
              venueName: LOCATION_NAME,
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
    value === "qr"
  ) {
    return value
  }
  return "card"
}

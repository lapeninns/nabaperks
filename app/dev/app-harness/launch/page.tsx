import { notFound } from "next/navigation"
import { headers } from "next/headers"

import {
  openCustomerPortalAction,
  startCheckoutAction,
} from "@/app/app/billing/actions"
import type { BirthdayRewardActionState } from "@/app/app/card/actions"
import { PageTitle } from "@/components/brand"
import { SetupBillingActivationCard } from "@/components/merchant/account/billing-activation-card"
import { BillingPanelView } from "@/components/merchant/account/billing-panel-view"
import { LaunchReadinessPanel } from "@/components/merchant/launch-readiness-panel"
import { BirthdayRewardPanel } from "@/components/merchant/launch/birthday-panel"
import { LaunchFlowFooter } from "@/components/merchant/launch/launch-flow-footer"
import { birthdayRewardTemplateForBusinessType } from "@/lib/merchant/birthday-reward-template"
import {
  LoyaltyCardForm,
  RewardPoolForm,
  type RewardPoolItemValues,
} from "@/components/merchant/loyalty-card-form"
import { QrPanel } from "@/components/merchant/launch/qr-panel"
import type { DistributionChannel } from "@/components/merchant/launch/qr-redesign-concept"
import { QrRedesignConcept } from "@/components/merchant/launch/qr-redesign-concept-harness"
import { VenueLocationForm } from "@/components/merchant/launch/venue-location-form"
import {
  buildLaunchReadiness,
  resolveLaunchBillingHref,
  resolveLaunchFlowCta,
} from "@/lib/merchant/launch-readiness"
import type { LaunchHubTab } from "@/lib/merchant/launch-readiness"
import { resolveLaunchHeaderModel } from "@/lib/merchant/launch-header-copy"
import {
  CARD_CADENCE_PRESETS,
  rewardPresetsForBusinessType,
} from "@/lib/merchant/reward-presets"
import { QR_POSTER_TEMPLATE_IDS } from "@/lib/qr/poster-templates"
import { renderPosterQrCodePng } from "@/lib/qr/assets"

import { HARNESS_MERCHANT } from "../fixtures"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const LOCATION_NAME = "Old Crown Girton"
const HARNESS_ACTIVE_CARD = {
  id: "card_harness",
  card_name: "Mystery Visit Card",
  reward_name: "Mystery reward",
  stamps_required: 3,
} as const
const HARNESS_LOCATION = {
  id: "loc_harness",
  name: LOCATION_NAME,
  address: "12 High Street, Girton, Cambridge, CB3 0QH",
  latitude: 52.2399,
  longitude: 0.0826,
  geofence_radius_meters: 150,
  require_geofence: false,
  geocoded_at: "2026-06-20T10:00:00.000Z",
} as const
const HARNESS_QR = {
  id: "qr_harness",
  qr_id: "old-crown-girton",
  destination_type: "join",
  is_active: true,
} as const

async function saveHarnessBirthdayReward(
  _state: BirthdayRewardActionState,
  formData: FormData
): Promise<BirthdayRewardActionState> {
  "use server"
  const enabled = formData.get("enabled") === "on"
  return {
    fields: {
      loyaltyCardId: String(formData.get("loyaltyCardId") ?? ""),
      enabled,
      rewardName: String(formData.get("rewardName") ?? ""),
      rewardTerms: String(formData.get("rewardTerms") ?? ""),
    },
    saved: true,
    message: enabled ? "Birthday treat saved." : "Birthday treat switched off.",
  }
}

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
  searchParams?: Promise<{
    tab?: string
    state?: string
    pool?: string
    concept?: string
    channel?: string
    poster?: string
  }>
}) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const params = searchParams ? await searchParams : {}
  const activeTab = resolveTab(params.tab)
  const state = resolveHarnessState(params.state)
  const rewardPoolItems = resolveHarnessRewardPool(
    params.pool ?? (state === "default" ? "two" : undefined)
  )
  const activeRewardPoolItemCount = rewardPoolItems.filter(
    (item) => item.isActive
  ).length
  const qrCode =
    state === "paused"
      ? { ...HARNESS_QR, is_active: false }
      : state === "lapsed" || state === "live"
        ? HARNESS_QR
        : null
  const billing = {
    requiresBilling: true,
    status:
      state === "qr" || state === "live" || state === "paused"
        ? "active"
        : state === "lapsed"
          ? "past_due"
          : null,
  }

  const readiness = buildLaunchReadiness({
    activeCard: HARNESS_ACTIVE_CARD,
    activeRewardPoolItemCount,
    qrCode,
    location: HARNESS_LOCATION,
    billing,
  })
  const billingHref = resolveLaunchBillingHref(readiness)
  const setup = {
    merchant: {
      ...HARNESS_MERCHANT,
      business_slug: "old-crown-girton",
      business_type: "pub",
      email: "owner@example.test",
      requires_billing: true,
      pub_google_review:
        "https://search.google.com/local/writereview?placeid=ChIJr-Lmrdt22EcRpM90SQtZug4",
      locals: "Girton",
    },
    location: HARNESS_LOCATION,
    activeCard: HARNESS_ACTIVE_CARD,
    activeRewardPoolItemCount,
    qrCode,
  }
  const conceptShareUrl =
    params.concept === "redesign" ? await resolveHarnessShareUrl() : null
  const conceptQrDataUrl = conceptShareUrl
    ? `data:image/png;base64,${(
        await renderPosterQrCodePng(conceptShareUrl, 720)
      ).toString("base64")}`
    : null

  // Heading / context / description / header-CTA come from the same pure helper
  // the real /app/launch uses, so the harness header stays faithful to it.
  const header = resolveLaunchHeaderModel(readiness)

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
              presets={rewardPresetsForBusinessType("pub")}
            />
            <BirthdayRewardPanel
              loyaltyCardId="card_harness"
              enabled={false}
              rewardName={null}
              rewardTerms={null}
              template={birthdayRewardTemplateForBusinessType("pub")}
              saveAction={saveHarnessBirthdayReward}
            />
          </div>
        ) : activeTab === "qr" &&
          params.concept === "redesign" &&
          qrCode &&
          conceptShareUrl &&
          conceptQrDataUrl ? (
          <QrRedesignConcept
            activeCardName={HARNESS_ACTIVE_CARD.card_name}
            venueName={LOCATION_NAME}
            shareUrl={conceptShareUrl}
            qrDataUrl={conceptQrDataUrl}
            channel={resolveDistributionChannel(params.channel)}
            template={resolvePosterTemplate(params.poster)}
          />
        ) : activeTab === "qr" ? (
          <QrPanel
            setup={setup}
            readiness={readiness}
            params={{ channel: params.channel, poster: params.poster }}
            billingHref={billingHref}
            returnHref="/app/launch?tab=qr"
            workspaceHref={`/dev/app-harness/launch?state=${state}&tab=qr`}
          />
        ) : activeTab === "billing" ? (
          billing.status === "active" ? (
            <BillingPanelView
              billing={{
                status: "active",
                stripe_subscription_status: "active",
                stripe_customer_id: "cus_harness",
                billing_interval: "day",
                unit_amount: 6999,
                currency: "gbp",
                current_period_end: "2026-08-11T00:00:00.000Z",
              }}
              outcome={null}
              mode="setup"
              checkoutAction={startCheckoutAction}
              portalAction={openCustomerPortalAction}
              billingReturnTo="/app/launch?tab=billing"
            />
          ) : (
            <SetupBillingActivationCard billingReturnTo="/app/launch?tab=billing" />
          )
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
        <LaunchFlowFooter cta={resolveLaunchFlowCta(activeTab, readiness)} />
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

type LaunchHarnessState =
  | "default"
  | "billing"
  | "lapsed"
  | "paused"
  | "qr"
  | "live"

function resolveHarnessState(value: string | undefined): LaunchHarnessState {
  if (
    value === "billing" ||
    value === "lapsed" ||
    value === "paused" ||
    value === "qr" ||
    value === "live"
  ) {
    return value
  }

  return "default"
}

function resolveDistributionChannel(
  value: string | undefined
): DistributionChannel {
  return value === "digital" ? "digital" : "print"
}

function resolvePosterTemplate(value: string | undefined) {
  return (
    QR_POSTER_TEMPLATE_IDS.find((template) => template === value) ?? "window"
  )
}

async function resolveHarnessShareUrl() {
  const requestHeaders = await headers()
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host")
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http"
  const origin = host ? `${protocol}://${host}` : "http://127.0.0.1:3146"
  return `${origin}/q/old-crown-girton`
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

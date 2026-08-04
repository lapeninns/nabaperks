import { Suspense } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { DiscountTag01Icon } from "@hugeicons/core-free-icons"

import { EmptyState, Eyebrow, MonoTag, PageTitle } from "@/components/brand"
import { Disclosure } from "@/components/merchant/launch/disclosure"
import { OfferCampaignPanelSkeleton } from "@/components/merchant/loading-skeletons"
import {
  OfferActionNotice,
  OfferCampaignPanel,
} from "@/components/merchant/offer-campaign-panel"
import { OFFER_BENEFIT_PRESETS } from "@/components/merchant/offers/offer-benefit-preview"
import { formatOfferDate } from "@/components/merchant/offers/offer-rules-summary"
import { Button } from "@/components/ui/button"
import { getCurrentMerchant } from "@/lib/auth/session"
import { getServerEnv } from "@/lib/env/server"
import {
  getActiveOfferCampaign,
  loadOfferCampaignMetrics,
  type OfferCampaignMetrics,
} from "@/lib/merchant/offer-campaigns"
import {
  OFFERS_HOME_PATH,
  OFFERS_NEW_PATH,
  offerCampaignQrPath,
} from "@/lib/merchant/offer-nav"
import { createSupabaseServerClient } from "@/lib/supabase/server"

import { loadOfferDeskContext } from "./actions"

/**
 * The Offers hub. One venue runs at most one non-terminal offer, so this screen
 * is either the empty state that explains the three benefit presets, or the
 * management panel for the campaign that exists — plus a short read-only
 * history of offers that have ended.
 *
 * Offers is an ordinary merchant feature with no rollout gate: the venue's own
 * session is the whole of the authorisation, and every campaign row is read
 * through it.
 *
 * The campaign, its counts and the ended history are several round trips, so
 * they stream behind {@link OfferCampaignPanelSkeleton} while the title and any
 * post-action notice paint immediately. The "Create an offer" call to action
 * therefore lives in the empty state rather than the page header: whether it
 * should be offered at all depends on the campaign that has not loaded yet.
 */

export const dynamic = "force-dynamic"

const ENDED_HISTORY_LIMIT = 3

type OffersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function MerchantOffersPage({
  searchParams,
}: OffersPageProps) {
  const merchant = await getCurrentMerchant()
  if (!merchant) {
    redirect("/app/onboarding")
  }

  const desk = await loadOfferDeskContext()

  const params = await searchParams

  return (
    <div className="grid min-w-0 gap-6">
      <PageTitle
        eyebrow="Offers"
        title="Bring new customers in"
        description="Run one promotional offer at a time. People who are not yet members scan your campaign QR, join, and get the benefit straight away."
      />

      <OfferActionNotice
        notice={firstValue(params.notice)}
        error={firstValue(params.error)}
      />

      <Suspense fallback={<OfferCampaignPanelSkeleton />}>
        <OffersDesk
          merchantId={merchant.id}
          stampsRequired={desk.stampsRequired}
        />
      </Suspense>
    </div>
  )
}

async function OffersDesk({
  merchantId,
  stampsRequired,
}: {
  merchantId: string
  stampsRequired: number
}) {
  const [campaign, history] = await Promise.all([
    getActiveOfferCampaign(merchantId),
    loadEndedOfferCampaigns(merchantId),
  ])

  const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL

  return (
    <>
      {campaign ? (
        <OfferCampaignPanel
          campaign={campaign}
          claimUrl={
            campaign.claimToken
              ? `${appUrl}/offer/${campaign.claimToken}`
              : null
          }
          qrHref={offerCampaignQrPath(campaign.id)}
          qrImageHref={`${offerCampaignQrPath(campaign.id)}.png`}
          returnTo={OFFERS_HOME_PATH}
          stampsRequired={stampsRequired}
        />
      ) : (
        <OffersEmptyState />
      )}

      {history.length > 0 ? <OfferHistory campaigns={history} /> : null}
    </>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function OffersEmptyState() {
  return (
    <div className="grid gap-5">
      <EmptyState
        icon={DiscountTag01Icon}
        title="No offer running"
        description="Choose what new members get, set the dates, and print the campaign QR. Nothing goes live until you publish it."
        actions={
          <Button asChild>
            <Link href={OFFERS_NEW_PATH}>Create an offer</Link>
          </Button>
        }
      />

      <section className="grid gap-3" aria-label="What an offer can give">
        <Eyebrow>What an offer can give</Eyebrow>
        <ul className="grid gap-2 sm:grid-cols-3">
          {OFFER_BENEFIT_PRESETS.map((preset) => (
            <li
              key={preset.kind}
              className="grid content-start gap-1.5 rounded-lg border-[1.5px] border-border bg-card p-4"
            >
              <span className="text-sm font-semibold text-foreground">
                {preset.title}
              </span>
              <span className="text-xs leading-5 text-muted-foreground">
                {preset.description}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs leading-5 text-muted-foreground">
          Offers are for people who are not yet members. Customers who already
          hold your loyalty card cannot claim one.
        </p>
      </section>
    </div>
  )
}

// ─── Ended offers ─────────────────────────────────────────────────────────────

type EndedOfferCampaign = {
  id: string
  name: string | null
  bonusStampCount: number | null
  discountPercent: number | null
  startsOn: string
  endsOn: string
  endedAt: string | null
  metrics: OfferCampaignMetrics
}

function OfferHistory({
  campaigns,
}: {
  campaigns: readonly EndedOfferCampaign[]
}) {
  // Read-only history below a live campaign and its counts: worth keeping, not
  // worth a screen. Folded by default, and the count is on the summary so the
  // merchant knows whether opening it is worth the tap.
  return (
    <Disclosure
      label={`Recent ended offers (up to ${ENDED_HISTORY_LIMIT})`}
      className="min-w-0"
    >
      <ul className="grid gap-2">
        {campaigns.map((campaign) => (
          <li
            key={campaign.id}
            className="grid gap-2 rounded-lg border-[1.5px] border-border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          >
            <div className="grid gap-1">
              <span className="text-sm font-semibold text-foreground">
                {endedHeadline(campaign)}
              </span>
              <span className="text-xs leading-5 text-muted-foreground">
                Ran {formatOfferDate(campaign.startsOn)} to{" "}
                {formatOfferDate(campaign.endsOn)} ·{" "}
                {campaign.metrics.claims.toLocaleString("en-GB")} claimed ·{" "}
                {campaign.metrics.passRedemptions.toLocaleString("en-GB")} pass
                redemptions
              </span>
            </div>
            <MonoTag tone="ink">Ended</MonoTag>
          </li>
        ))}
      </ul>
      <p className="text-xs leading-5 text-muted-foreground">
        Ended offers are read-only. Their links no longer work, but any pass
        already issued keeps its own terms until its end date.
      </p>
    </Disclosure>
  )
}

function endedHeadline(campaign: EndedOfferCampaign): string {
  if (campaign.name) return campaign.name

  const parts: string[] = []
  if (campaign.bonusStampCount) {
    parts.push(
      `${campaign.bonusStampCount} welcome ${campaign.bonusStampCount === 1 ? "stamp" : "stamps"}`
    )
  }
  if (campaign.discountPercent) {
    parts.push(`${campaign.discountPercent}% off`)
  }
  return parts.length > 0 ? parts.join(" and ") : "Offer"
}

async function loadEndedOfferCampaigns(
  merchantId: string
): Promise<readonly EndedOfferCampaign[]> {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from("offer_campaigns")
    .select(
      "id, name, bonus_stamp_count, discount_percent, starts_on, ends_on, ended_at"
    )
    .eq("merchant_id", merchantId)
    .eq("status", "ended")
    .order("ended_at", { ascending: false })
    .limit(ENDED_HISTORY_LIMIT)

  const rows = data ?? []
  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      name: row.name,
      bonusStampCount: row.bonus_stamp_count,
      discountPercent: row.discount_percent,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
      endedAt: row.ended_at,
      metrics: await loadOfferCampaignMetrics(row.id),
    }))
  )
}

function firstValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value
  return Array.isArray(value) && typeof value[0] === "string" ? value[0] : null
}

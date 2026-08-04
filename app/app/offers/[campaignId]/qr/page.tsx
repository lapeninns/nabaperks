import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft02Icon, Download04Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { StatusBanner } from "@/components/loyalty/status-banner"
import {
  OfferActionNotice,
  OfferCampaignPanel,
} from "@/components/merchant/offer-campaign-panel"
import { Button } from "@/components/ui/button"
import { getCurrentMerchant } from "@/lib/auth/session"
import { getServerEnv } from "@/lib/env/server"
import { getActiveOfferCampaign } from "@/lib/merchant/offer-campaigns"
import { OFFERS_HOME_PATH, offerCampaignQrPath } from "@/lib/merchant/offer-nav"

import { loadOfferDeskContext } from "../../actions"

/**
 * The campaign QR at counter size: the one screen a merchant holds up, prints,
 * or photographs for a poster.
 *
 * The code encodes the confidential claim link, and the link shown underneath it
 * comes from `resolveOfferClaimLink` — the same resolver the image route uses,
 * so what a customer scans and what the merchant reads can never disagree. When
 * no candidate matches the stored hash there is nothing safe to display, and the
 * screen says so instead of rendering a code that leads nowhere.
 */

export const dynamic = "force-dynamic"

type CampaignQrPageProps = {
  params: Promise<{ campaignId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function OfferCampaignQrPage({
  params,
  searchParams,
}: CampaignQrPageProps) {
  const merchant = await getCurrentMerchant()
  if (!merchant) {
    redirect("/app/onboarding")
  }

  const desk = await loadOfferDeskContext()

  const { campaignId } = await params
  const query = await searchParams
  const campaign = await getActiveOfferCampaign(merchant.id)
  if (!campaign || campaign.id !== campaignId) {
    notFound()
  }

  const claimUrl = campaign.claimToken
    ? `${getServerEnv().NEXT_PUBLIC_APP_URL}/offer/${campaign.claimToken}`
    : null
  const qrPath = offerCampaignQrPath(campaign.id)
  const venueName = merchant.business_name ?? "Your venue"

  return (
    <div className="grid min-w-0 gap-6">
      <div>
        <Button asChild variant="ghost">
          <Link href={OFFERS_HOME_PATH}>
            <Icon icon={ArrowLeft02Icon} size={16} />
            Back to offers
          </Link>
        </Button>
      </div>

      <OfferActionNotice
        notice={firstValue(query.notice)}
        error={firstValue(query.error)}
      />

      {claimUrl ? (
        <section
          aria-label="Campaign QR code"
          className="grid justify-items-center gap-5 rounded-lg border-2 border-ink bg-ink p-6 text-paper sm:p-10"
        >
          <div className="grid justify-items-center gap-2 text-center">
            <p className="mono-meta tracking-[0.2em] text-paper/70">
              Scan to claim
            </p>
            <h2 className="max-w-[18ch] text-2xl leading-tight font-extrabold text-balance sm:text-3xl">
              {venueName}
            </h2>
            {campaign.name ? (
              <p className="max-w-[28ch] text-sm leading-6 text-balance text-paper/85">
                {campaign.name}
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border-2 border-ink bg-white p-4 shadow-[8px_8px_0_var(--w-shadow-color)] sm:p-6">
            {/* eslint-disable-next-line @next/next/no-img-element -- merchant-scoped, no-store QR bytes */}
            <img
              src={`${qrPath}.png`}
              alt={`Campaign QR code for ${venueName}`}
              width={720}
              height={720}
              className="aspect-square h-auto w-[min(80vmin,30rem)] rounded-lg bg-white"
            />
          </div>

          <div className="grid max-w-md justify-items-center gap-2 text-center">
            <p className="text-sm leading-6 text-balance text-paper/85">
              Anyone who scans this can claim the offer, so show it only where
              you want it claimed. People who already hold your loyalty card
              cannot claim.
            </p>
            <p className="font-mono text-[11px] leading-5 break-all text-paper/60">
              {claimUrl.replace(/^https?:\/\//, "")}
            </p>
            <Button asChild variant="secondary">
              <a href={`${qrPath}.png?download=1`} download>
                <Icon icon={Download04Icon} size={16} />
                Download the image
              </a>
            </Button>
          </div>
        </section>
      ) : (
        <StatusBanner tone="warning" title="There is no code to show">
          We can&apos;t produce a QR for this offer that customers would be able
          to use. Rotate the link below to issue a working one, then reprint
          anything carrying the old code.
        </StatusBanner>
      )}

      <OfferCampaignPanel
        campaign={campaign}
        claimUrl={claimUrl}
        qrHref={qrPath}
        qrImageHref={`${qrPath}.png`}
        returnTo={qrPath}
        stampsRequired={desk.stampsRequired}
        showQrLink={false}
        showShareRow={false}
      />
    </div>
  )
}

function firstValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value
  return Array.isArray(value) && typeof value[0] === "string" ? value[0] : null
}

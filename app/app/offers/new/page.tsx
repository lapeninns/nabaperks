import Link from "next/link"
import { redirect } from "next/navigation"

import { PageTitle } from "@/components/brand"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { OfferCampaignForm } from "@/components/merchant/offer-campaign-form"
import { Button } from "@/components/ui/button"
import { getCurrentMerchant } from "@/lib/auth/session"
import { addUkCalendarDays, ukTodayIso } from "@/lib/customer/uk-calendar"
import { getActiveOfferCampaign } from "@/lib/merchant/offer-campaigns"
import { OFFERS_HOME_PATH } from "@/lib/merchant/offer-nav"
import { OFFER_CAMPAIGN_MAX_DURATION_DAYS } from "@/lib/offers/constants"

import { loadOfferDeskContext, type OfferCreatorStep } from "../actions"

/**
 * The three-step creator. `?step=` is the address of the step, so a refresh, a
 * bookmark or the back button all land where the merchant was; the form keeps
 * the address bar in step as it moves.
 *
 * A venue may hold only one non-terminal campaign, so arriving here with one
 * already published is a dead end — send the merchant back to the hub where the
 * management controls are. A draft is different: drafting again supersedes it,
 * which is how a merchant changes their mind before publishing.
 */

export const dynamic = "force-dynamic"

const CREATOR_STEPS: readonly OfferCreatorStep[] = [
  "benefits",
  "rules",
  "review",
]

type NewOfferPageProps = {
  searchParams: Promise<{ step?: string | string[] }>
}

export default async function NewOfferPage({
  searchParams,
}: NewOfferPageProps) {
  const merchant = await getCurrentMerchant()
  if (!merchant) {
    redirect("/app/onboarding")
  }

  const desk = await loadOfferDeskContext()

  const active = await getActiveOfferCampaign(merchant.id)
  if (active && active.status !== "draft") {
    redirect(OFFERS_HOME_PATH)
  }

  const params = await searchParams
  const today = ukTodayIso()

  return (
    <div className="grid max-w-5xl min-w-0 gap-6">
      <PageTitle
        eyebrow="Offers"
        title="Create an offer"
        description="Three steps: choose what new members get, set the rules, then review exactly what a customer will see before you publish."
      />

      {desk.stampsRequired < 1 ? (
        <div className="grid gap-4">
          <StatusBanner tone="warning" title="Build your loyalty card first">
            An offer gives new members stamps on your card or a discount pass,
            so Nabaperks needs one active card before it can create an offer.
          </StatusBanner>
          <Button asChild className="w-fit">
            <Link href="/app/launch?tab=card">Go to the card builder</Link>
          </Button>
        </div>
      ) : (
        <OfferCampaignForm
          merchantName={merchant.business_name ?? ""}
          stampsRequired={desk.stampsRequired}
          rewardName={desk.rewardName}
          today={today}
          latestEndDate={addUkCalendarDays(
            today,
            OFFER_CAMPAIGN_MAX_DURATION_DAYS - 1
          )}
          initialStep={resolveStep(params.step)}
        />
      )}
    </div>
  )
}

function resolveStep(value: string | string[] | undefined): OfferCreatorStep {
  const raw = typeof value === "string" ? value : value?.[0]
  return CREATOR_STEPS.find((step) => step === raw) ?? "benefits"
}

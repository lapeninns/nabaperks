import { PageTitle } from "@/components/brand"
import { HomeActivitySnippet } from "@/components/customer/home-activity-snippet"
import { HomeBirthdayPrompt } from "@/components/customer/home-birthday-prompt"
import { HomeCardTile } from "@/components/customer/home-card-tile"
import { HomeEmptyState } from "@/components/customer/home-empty-state"
import { HomeRedeemBanner } from "@/components/customer/home-redeem-banner"
import { HomeSummaryStrip } from "@/components/customer/home-summary-strip"
import { getCustomerHomeDashboard } from "@/lib/customer/home"
import { getCurrentCustomer } from "@/lib/customer/identity"
import { listCustomerOfferPasses } from "@/lib/customer/offer-pass"
import { groupOfferPassesByMembership } from "@/lib/customer/offer-pass-view"

export const metadata = {
  title: "My Nabaperks",
}

/** Shared empty rail, so a card without passes allocates nothing per render. */
const NO_OFFER_PASSES = Object.freeze([])

export default async function HomeDashboardPage() {
  // Discount passes are read beside the dashboard rather than inside it: a pass
  // is its own record against a venue, not a field of the loyalty card, and
  // `HomeCard` deliberately carries no pass data. One indexed read serves every
  // tile, so this is a single extra query, not one per card.
  const [{ cards, summary, topRedeemable, recentActivity }, offerPasses] =
    await Promise.all([getCustomerHomeDashboard(), listCustomerOfferPasses()])
  const passesByMembership = groupOfferPassesByMembership(offerPasses)
  // getCurrentCustomer is React.cache'd (already loaded upstream), so this is a
  // free read of the stored DOB.
  const customer = await getCurrentCustomer()
  const needsBirthday = !customer?.dateOfBirth && cards.length > 0

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="My Nabaperks"
        title="Your cards"
        description="Every card you've collected. Tap one to see its stamps and rewards."
      />

      {cards.length === 0 ? (
        <HomeEmptyState />
      ) : (
        <>
          <HomeSummaryStrip summary={summary} />
          <HomeRedeemBanner topRedeemable={topRedeemable} />
          {needsBirthday ? <HomeBirthdayPrompt /> : null}
          <div className="grid gap-4">
            {cards.map((card) => (
              <HomeCardTile
                key={card.membershipId}
                card={card}
                offerPasses={
                  passesByMembership.get(card.membershipId) ?? NO_OFFER_PASSES
                }
              />
            ))}
          </div>
          <HomeActivitySnippet items={recentActivity} />
        </>
      )}
    </div>
  )
}

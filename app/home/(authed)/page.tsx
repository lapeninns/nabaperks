import { Eyebrow } from "@/components/brand"
import { HomeActivitySnippet } from "@/components/customer/home-activity-snippet"
import { HomeBirthdayPrompt } from "@/components/customer/home-birthday-prompt"
import { HomeCardTile } from "@/components/customer/home-card-tile"
import { HomeEmptyState } from "@/components/customer/home-empty-state"
import { HomeRedeemBanner } from "@/components/customer/home-redeem-banner"
import { homeSummaryLine } from "@/components/customer/home-summary-strip"
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
    <div className="grid gap-5">
      {/*
        The header used to be a full PageTitle — eyebrow, a text-3xl h1, and a
        two-line description — followed by a separate bordered summary band.
        Measured at 375x667 that stack plus the redeem banner put the first card
        tile ~503px down a ~609px viewport: no loyalty card was legible on first
        paint, on the screen whose entire proposition is "here are your stamps"
        (CUS 02#7, 02#9).

        Now one heading row: the h1 the page outline needs, at the size a tab
        title wants rather than a landing-page title, with the summary counts
        beside it as the eyebrow they always were. The PageTitle description
        ("Every card you've collected. Tap one to see its stamps and rewards.")
        is deliberately dropped — finding 02#7 calls for it, and the tiles
        below are self-evidently tappable cards.
      */}
      <div className="grid gap-1.5">
        <h1 className="text-xl leading-tight font-extrabold">Your cards</h1>
        {cards.length > 0 ? (
          <Eyebrow>{homeSummaryLine(summary)}</Eyebrow>
        ) : null}
      </div>

      {cards.length === 0 ? (
        <HomeEmptyState />
      ) : (
        <>
          <HomeRedeemBanner topRedeemable={topRedeemable} />
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
          {/* The birthday ask moves BELOW the wallet. It is optional data
              collection, and at full ReceiptCard weight above the cards it had
              the same visual authority as the member's stamps while pushing
              them further off screen (CUS 02#17). */}
          {needsBirthday ? <HomeBirthdayPrompt /> : null}
          <HomeActivitySnippet items={recentActivity} />
        </>
      )}
    </div>
  )
}

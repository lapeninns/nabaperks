import { PageTitle } from "@/components/brand"
import { HomeActivitySnippet } from "@/components/customer/home-activity-snippet"
import { HomeCardTile } from "@/components/customer/home-card-tile"
import { HomeEmptyState } from "@/components/customer/home-empty-state"
import { HomeRedeemBanner } from "@/components/customer/home-redeem-banner"
import { HomeSummaryStrip } from "@/components/customer/home-summary-strip"
import { getCustomerHomeDashboard } from "@/lib/customer/home"

export const metadata = {
  title: "My Nabaperks",
}

export default async function HomeDashboardPage() {
  const { cards, summary, topRedeemable, recentActivity } =
    await getCustomerHomeDashboard()

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="My Nabaperks"
        title="Your cards"
        description="Every loyalty card you've collected, in one place. Tap a card to add a stamp or redeem."
      />

      {cards.length === 0 ? (
        <HomeEmptyState />
      ) : (
        <>
          <HomeSummaryStrip summary={summary} />
          <HomeRedeemBanner topRedeemable={topRedeemable} />
          <div className="grid gap-4">
            {cards.map((card) => (
              <HomeCardTile key={card.membershipId} card={card} />
            ))}
          </div>
          <HomeActivitySnippet items={recentActivity} />
        </>
      )}
    </div>
  )
}
